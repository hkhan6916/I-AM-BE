const { ObjectId } = require('mongoose').Types;
const Chat = require('../../models/chat/Chat');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const Messages = require('../../models/chat/Message');
const User = require('../../models/user/User');

const getUserChats = async (userId, offset) => {
  const chats = await Chat.aggregate([
    {
      $match: {
        $expr: {
          $in: [userId, '$participants'],
        },
      },
    },
    { $skip: offset || 0 },
    { $limit: 20 },
    {
      $lookup: {
        from: 'users',
        let: { participants: '$participants' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $not: { $eq: ['$_id', ObjectId(userId)] },
                  },
                  {
                    $in: [{ $toString: '$_id' }, '$$participants'],
                  },
                ],
              },
            },
          },
          {
            $project: {
              firstName: 1,
              lastName: 1,
              profileGifUrl: 1,
              profileImageUrl: 1,
              flipProfileVideo: 1,
              username: 1,
            },
          },
        ],
        as: 'users',
      },
    },
    {
      $lookup: {
        from: 'messages',
        let: { chatId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$chatId', '$$chatId'],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          {
            $project: {
              body: 1,
              mediaType: 1,
              createdAt: 1,
            },
          },
        ],
        as: 'lastMessage',
      },
    },
    {
      $unwind:
       {
         path: '$lastMessage',
         preserveNullAndEmptyArrays: true,
       },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
    {
      $project: {
        users: 1,
        lastMessage: 1,
        upToDateUsers: 1,
      },
    },
  ]);
  chats.forEach((chat) => {
    if (chat.users.length) {
      chat.users[0].profileGifHeaders = getFileSignedHeaders(chat.users[0].profileGifUrl);
      chat.users[0].profileImageHeaders = getFileSignedHeaders(chat.users[0].profileImageUrl);
    }
  });
  return chats;
};

const getUserChat = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  const user = await User.findOne({ _id: userId }, {
    firstName: 1, lastName: 1, username: 1, _id: 1,
  });
  if (!chat) {
    throw new Error('Chat does not exist');
  }
  if (!chat.participants.includes(userId)) throw new Error('User is not a participant in this chat');
  const users = await User.find({ _id: { $in: chat.participants } }, {
    firstName: 1, lastName: 1, username: 1, _id: 1,
  });

  // In case the user who is sending the request is actually the first user in the list.
  if (users?.[0]?._id.toString() === userId) {
    return { ...chat.toObject(), users: [...users.filter((u) => u._id.toString() !== userId), user] };
  }

  return { ...chat.toObject(), users };
};

const deleteUserMessage = async (messageId, userId) => { // just here, don't need it as won't be allowing users to delete messages
  const message = await Messages.findById(messageId);
  if (message?.userId.toString() !== userId) throw new Error('Message does not belong to user.');
  await Messages.findByIdAndDelete(messageId);
  return 'delete';
};

module.exports = { getUserChats, deleteUserMessage, getUserChat };
