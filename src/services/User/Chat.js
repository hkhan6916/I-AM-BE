const { ObjectId } = require('mongoose').Types;
const Chat = require('../../models/chat/Chat');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');

const getUserChats = async (userId, offset) => {
  const chats = await Chat.aggregate([
    {
      $match: {
        $expr: {
          $in: [userId, '$participants'],
        },
      },
    },
    { $sort: { createdAt: -1 } },
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
    }
  });
  return chats;
};

module.exports = { getUserChats };
