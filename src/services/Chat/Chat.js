const { ObjectId } = require('mongoose').Types;
const { io } = require('socket.io-client');
const Messages = require('../../models/chat/Message');
const Chat = require('../../models/chat/Chat');
const User = require('../../models/user/User');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');
const getNameDate = require('../../helpers/getNameDate');
const get12HourTime = require('../../helpers/get12HourTime');

const getChatMessages = async (chatId, offset, userId) => {
  console.log('getting chat messages');
  console.log({ userId });
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
              jobTitle: 1,
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
    { $sort: { updatedAt: -1 } },
    { $skip: offset || 0 },
    { $limit: 15 },
    // { $sort: { createdAt: 1 } },
  ]);
  const filteredMessages = messages.filter((message) => {
    if (message?.ready || (message.senderId.toString() === userId && !message.ready)) {
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
      return message;
    }
  });

  // mark user as having read latest messages in the chat
  if (!offset) {
    console.log('marking messages as read');
    console.log({ chatId });
    const chat = await Chat.findById(chatId);
    console.log('line 79');
    if (!chat) throw new Error('Tried to mark new messages as read but the chat does not exist.');
    console.log('line 81');
    const userIsAlreadyUptoDate = chat.upToDateUsers.find((id) => id === userId);
    console.log('line 83');
    if (!userIsAlreadyUptoDate) {
      chat.upToDateUsers = [...chat.upToDateUsers, userId];
      console.log('line 86');
      const user = await User.findById(userId);
      console.log('line 88');

      user.unreadChatsCount = user.unreadChatsCount > 0 ? user.unreadChatsCount - 1 : user.unreadChatsCount;
      console.log('line 91');
      user.save();
      console.log('line 93');
    }
    console.log({ chat });
    chat.save();
    console.log('line 97');
  }

  return filteredMessages;
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

const uploadFileAndSendMessage = async (message) => {
  if (!message) throw new Error('No message provided');
  if (!message.mediaKey && !message.thumbnailKey) throw new Error('No file key provided');

  const Bucket = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;
  const socket = io(process.env.API_WEBSOCKET_URL, {
    auth: {
      token: message?.auth,
    },
    withCredentials: true,
    transports: ['websocket'],
  });

  // for videos only
  if (message.thumbnailKey) {
    const thumbnailUrl = `https://${Bucket}.s3.${region}.amazonaws.com/${message.thumbnailKey}`;
    const fileHeaders = getFileSignedHeaders(thumbnailUrl);
    const newMessage = new Messages({
      thumbnailUrl,
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
      fileUrl: thumbnailUrl,
      fileHeaders,
      ...message,
      ...newMessage.toObject(),
    };
  }
  // for videos only
  if (message._id) { // mark as ready as media now uploaded.
    const mediaUrl = `${process.env.CF_URL}/${message.mediaKey.replace(/ /g, '')}`;
    const mediaHeaders = getFileSignedHeaders(mediaUrl);
    const signedUrl = getCloudfrontSignedUrl(message.mediaKey);

    const existingMessage = await Messages.findById(message._id);
    if (!existingMessage) throw new Error('Message does not exist');
    existingMessage.mediaUrl = mediaUrl;
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
        mediaHeaders,
        online: message.online,
        recipientId: message.recipientId,
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          _id: user._id,
        },
      },
    });

    return {
      mediaUrl, mediaHeaders, signedUrl, ...message,
    };
  }

  // for images
  const mediaUrl = `https://${Bucket}.s3.${region}.amazonaws.com/${message.mediaKey.replace(/ /g, '')}`;
  const mediaHeaders = getFileSignedHeaders(mediaUrl);

  const newMessage = new Messages({
    mediaUrl,
    stringDate: getNameDate(new Date()),
    stringTime: get12HourTime(new Date()),
    chatId: message.chatId,
    senderId: message.senderId,
    mediaType: 'image',
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
      mediaUrl,
      mediaHeaders,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        _id: user._id,
      },
    },
  });
  return {
    mediaUrl,
    mediaHeaders,
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

const bulkFailMessageUpload = async (messageIds, userId) => {
  if (!messageIds?.length || !userId) throw new Error('messageIds or userId missing');

  const messages = await Messages.updateMany(
    { _id: { $in: messageIds }, senderId: userId },
    { $set: { failed: true, ready: false } },
  );

  return { messages };
};

module.exports = {
  getChatMessages, createChat, checkChatExists, updateChatUpToDateUsers, uploadFileAndSendMessage, cancelMessageUpload, failMessageUpload, bulkFailMessageUpload,
};
