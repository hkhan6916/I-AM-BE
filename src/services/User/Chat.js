const { ObjectId } = require('mongoose').Types;
const Chat = require('../../models/chat/Chat');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const Messages = require('../../models/chat/Message');

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
    }
  });
  return chats;
};

const deleteUserMessage = async (messageId, userId) => { // just here, don't need it as won't be allowing users to delete messages
  const message = await Messages.findById(messageId);
  if (message?.userId.toString() !== userId) throw new Error('Message does not belong to user.');
  await Messages.findByIdAndDelete(messageId);
  return 'delete';
};

module.exports = { getUserChats, deleteUserMessage };
