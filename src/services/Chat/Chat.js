const { ObjectId } = require('mongoose').Types;
const { io } = require('socket.io-client');
const Messages = require('../../models/chat/Message');
const Chat = require('../../models/chat/Chat');
const User = require('../../models/user/User');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');
const uploadFile = require('../../helpers/uploadFile');
const getNameDate = require('../../helpers/getNameDate');
const get12HourTime = require('../../helpers/get12HourTime');

const getChatMessages = async (chatId, offset, userId) => {
  const messages = await Messages.aggregate([
    {
      $match: {
        chatId: ObjectId(chatId),
      },
    },
    {
      $lookup: {
        from: 'users',
        let: { senderId: '$senderId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$senderId'],
              },
            },
          },
          { $limit: 1 },
          {
            $project: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              username: 1,
            },
          },
        ],
        as: 'user',
      },
    },
    {
      $unwind:
       {
         path: '$user',
         preserveNullAndEmptyArrays: true,
       },
    },
    { $sort: { createdAt: -1 } },
    { $skip: offset || 0 },
    { $limit: 15 },
    // { $sort: { createdAt: 1 } },
  ]);

  messages.forEach((message) => {
    const arr = message.mediaUrl ? message.mediaUrl.split('/') : null;
    const mediaKey = arr ? arr[arr.length - 1] : null;

    if (mediaKey) {
      if (message.mediaType === 'image') {
        message.mediaHeaders = getFileSignedHeaders(message.mediaUrl);
      }
      if (message.mediaType === 'video') {
        message.mediaUrl = getCloudfrontSignedUrl(mediaKey);
        message.thumbnailHeaders = getFileSignedHeaders(message.thumbnailUrl);
      }
    }
  });

  // mark user as having read latest messages in the chat
  if (!offset) {
    const chat = await Chat.findById(chatId);
    const userIsAlreadyUptoDate = chat.upToDateUsers.find((id) => id === userId);
    if (!userIsAlreadyUptoDate) {
      chat.upToDateUsers = [...chat.upToDateUsers, userId];
      const user = await User.findById(userId);

      user.unreadChatsCount = user.unreadChatsCount > 0 ? user.unreadChatsCount - 1 : user.unreadChatsCount;
      user.save();
    }
    chat.save();
  }

  return messages;
};

const createChat = async (participants, hostId) => {
  if (participants?.length !== 2) {
    throw new Error(`Chat room must have 2 participants but got ${participants.length}`);
  }

  const sortedParticipants = participants.sort();

  const exists = await Chat.findOne({ participants: sortedParticipants });
  if (exists) {
    const users = await User.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              {
                $not: { $eq: ['$_id', ObjectId(hostId)] },
              },
              {
                $in: [{ $toString: '$_id' }, participants],
              },
            ],
          },
        },
      },
      { $limit: 1 },
    ]);

    if (!users.length) {
      throw new Error('Participant does not exist.');
    }

    return { _id: exists._id, participants: sortedParticipants, users };
  }
  const users = await User.aggregate([
    {
      $match: {
        $expr: {
          $and: [
            {
              $not: { $eq: ['$_id', ObjectId(hostId)] },
            },
            {
              $in: [{ $toString: '$_id' }, participants],
            },
          ],
        },
      },
    },
    { $limit: 1 },
  ]);

  if (!users.length) {
    throw new Error('Participant does not exist.');
  }

  const chat = new Chat({
    participants: sortedParticipants,
    upToDateUsers: [hostId],
  });

  chat.save();
  const receiver = await User.findById(users[0]._id);
  receiver.unreadChatsCount += 1;

  receiver.save();
  return { _id: chat._id, participants: sortedParticipants, users };
};

const checkChatExists = async (participants, userId) => {
  const sortedParticipants = participants.sort();

  const chat = await Chat.findOne({ participants: sortedParticipants });
  if (!chat) {
    // throw new Error('Chat does not exist');
    return null;
  }

  if (!chat.participants.includes(userId)) return null;
  // throw new Error('User is not a participant in this chat');
  chat.participants = chat.participants.filter((id) => id !== userId);

  const users = await User.find({ _id: { $in: chat.participants } }, { firstName: 1, lastName: 1, username: 1 });

  return { ...chat.toObject(), users };
};

const updateChatUpToDateUsers = async (userId, chatId, userIsOnline) => {
  if (!userId || !chatId) return false;
  const chat = await Chat.findById(chatId);
  const user = await User.findById(userId);
  if (userIsOnline) {
    const userIsUptoDate = chat.upToDateUsers.find((id) => id === userId.toString());
    if (!userIsUptoDate) {
      user.unreadChatsCount -= 1;
      chat.upToDateUsers = [...chat.upToDateUsers, userId];
    }
  } else {
    const userWasPreviouslyUptoDate = chat.upToDateUsers.find((id) => id === userId.toString());
    if (userWasPreviouslyUptoDate) { // makes sure we don't increment unreadChatsCount on every new message, only once
      user.unreadChatsCount += 1; // increase number of unread chats for user as they have new messages now
      chat.upToDateUsers = chat.upToDateUsers.filter((id) => id !== userId); // mark the user as no longer upto date
    }
  }
  user.save();
  chat.save();
  return true;
};

const uploadFileAndSendMessage = async (message, file) => {
  if (!message) throw new Error('No message provided');
  if (!file) throw new Error('No file provided');

  const socket = io(process.env.NODE_ENV === 'development'
    ? 'ws://192.168.5.101:5000'
    : 'wss://magnet-be.herokuapp.com', {
    auth: {
      token: message?.auth,
    },
    withCredentials: true,
    transports: ['websocket'],
  });

  if (file.name.includes('mediaThumbnail')) {
    const { fileUrl, fileHeaders, signedUrl } = await uploadFile(file);
    const newMessage = new Messages({
      thumbnailUrl: fileUrl,
      stringDate: getNameDate(new Date()),
      stringTime: get12HourTime(new Date()),
      chatId: message.chatId,
      senderId: message.senderId,
      mediaType: 'video',
      body: message.body,
      ready: false,
    });
    newMessage.save();
    return {
      fileUrl,
      fileHeaders,
      signedUrl,
      ...message,
      ...newMessage.toObject(),
    };
  }
  if (message._id) { // mark as ready as media now uploaded.
    const { fileUrl, fileHeaders, signedUrl } = await uploadFile(file);
    const existingMessage = await Messages.findById(message._id);
    existingMessage.mediaUrl = fileUrl;
    existingMessage.ready = true;
    existingMessage.save();
    const existingMessageObj = existingMessage.toObject();
    const user = await User.findById(existingMessage.senderId);
    socket.emit('forwardServerSideMessage', {
      chatId: existingMessageObj.chatId.toString(),
      message: {
        ...existingMessageObj,
        thumbnailHeaders: getFileSignedHeaders(existingMessageObj.thumbnailUrl),
        mediaUrl: signedUrl,
        mediaHeaders: fileHeaders,
        online: message.online === 'true', // can only send string via background upload
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          _id: user._id,
        },
      },
    });

    return {
      fileUrl, fileHeaders, signedUrl, ...message,
    };
  }

  const {
    fileUrl, fileHeaders, signedUrl, fileType,
  } = await uploadFile(file);
  const newMessage = new Messages({
    mediaUrl: fileUrl,
    stringDate: getNameDate(new Date()),
    stringTime: get12HourTime(new Date()),
    chatId: message.chatId,
    senderId: message.senderId,
    mediaType: fileType,
    body: message.body,
    ready: true,
  });
  newMessage.save();
  const user = await User.findById(message.senderId);

  socket.emit('forwardServerSideMessage', {
    chatId: newMessage.toObject().chatId.toString(),
    message: {
      ...message,
      ...newMessage.toObject(),
      mediaUrl: fileUrl,
      mediaHeaders: fileHeaders,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        _id: user._id,
      },
    },
  });
  return {
    mediaUrl: fileUrl,
    mediaHeaders: fileHeaders,
    signedUrl,
    ...message,
    ...newMessage.toObject(),
  };
};

const cancelMessageUpload = async (messageId, userId) => {
  if (!messageId || !userId) throw new Error('messageId or userId missing');
  const message = await Messages.findById(messageId);
  if (message.senderId.toString() !== userId) {
    throw new Error('Message does not belong to this user.');
  }
  await Messages.findByIdAndDelete(messageId);
  return 'deleted';
};

const failMessageUpload = async (messageId, userId) => {
  if (!messageId || !userId) throw new Error('messageId or userId missing');
  const message = await Messages.findById(messageId);
  if (message.senderId.toString() !== userId) {
    throw new Error('Message does not belong to this user.');
  }
  message.failed = true;
  message.save();
  return 'Marked message as failed';
};

module.exports = {
  getChatMessages, createChat, checkChatExists, updateChatUpToDateUsers, uploadFileAndSendMessage, cancelMessageUpload, failMessageUpload,
};
