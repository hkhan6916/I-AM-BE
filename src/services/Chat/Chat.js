const { ObjectId } = require('mongoose').Types;
const Messages = require('../../models/chat/Message');
const Chat = require('../../models/chat/Chat');
const User = require('../../models/user/User');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');

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
      message.mediaHeaders = getFileSignedHeaders(message.mediaUrl);
      message.mediaUrl = getCloudfrontSignedUrl(mediaKey);
    }
  });

  // mark user as having read latest messages in the chat
  if (!offset) {
    const chat = await Chat.findById(chatId);
    const userIsAlreadyUptoDate = chat.upToDateUsers.find((id) => id === userId);
    chat.upToDateUsers = userIsAlreadyUptoDate ? chat.upToDateUsers : [...chat.upToDateUsers, userId];
    chat.save();
  }

  return messages;
};

const createChat = async (participants, hostId) => {
  if (participants?.length !== 2) {
    throw new Error(`Chat room must have 2 participants but got ${participants.length}`);
  }

  const sortedParticpants = participants.sort();

  const exists = await Chat.findOne({ participants: sortedParticpants });
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

    return { _id: exists._id, participants: sortedParticpants, users };
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
    participants: sortedParticpants,
  });

  chat.save();
  return { _id: chat._id, participants: sortedParticpants, users };
};

const checkChatExists = async (participants) => {
  const sortedParticpants = participants.sort();

  const exists = await Chat.findOne({ participants: sortedParticpants });

  return exists || null;
};

const updateChatUpToDateUsers = async (userId, chatId, userIsOnline) => {
  if (!userId || !chatId) return false;
  const chat = await Chat.findById(chatId);
  if (userIsOnline) {
    const shouldUpdate = chat.upToDateUsers.find((id) => id !== userId.toString());
    chat.upToDateUsers = shouldUpdate ? [...chat.upToDateUsers, userId] : chat.upToDateUsers;
  } else {
    const index = chat.upToDateUsers.indexOf(userId);
    if (index > -1) {
      chat.upToDateUsers.splice(index, 1); // 2nd parameter means remove one item only
    }
  }
  chat.save();
  return true;
};

module.exports = {
  getChatMessages, createChat, checkChatExists, updateChatUpToDateUsers,
};
