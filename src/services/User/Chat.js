const { ObjectId } = require('mongoose').Types;
const Chat = require('../../models/chat/Chat');

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
    { $limit: 10 },
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
        as: 'secondUser',
      },
    },
    {
      $unwind:
         {
           path: '$secondUser',
           preserveNullAndEmptyArrays: true,
         },
    },
    {
      $project: {
        secondUser: 1,
      },
    },
  ]);

  return chats;
};

module.exports = { getUserChats };
