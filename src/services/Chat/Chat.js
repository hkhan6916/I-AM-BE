const { ObjectId } = require('mongoose').Types;
const Messages = require('../../models/chat/Message');
const Chat = require('../../models/chat/Chat');
const User = require('../../models/user/User');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');

const getChatMessages = async (chatId, offset) => {
  const messages = await Messages.aggregate([
    {
      $match: {
        chatId,
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
              profileGifUrl: 1,
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
    { $limit: 10 },
  ]);

  const profileGifHeaders = [];

  messages.forEach((message) => {
    const date = new Date(message.createdAt);

    const ageDifMs = Date.now() - date;
    const ageDate = new Date(ageDifMs);

    const showYear = Math.abs(ageDate.getUTCFullYear() - 1970) >= 1;

    const year = date.getFullYear();
    const month = date.toLocaleString('default', { month: 'long' });
    const day = date.getDate();

    if (showYear) {
      message.date = `${month} ${day} ${year}`;
    } else {
      message.date = `${month} ${day}`;
    }
    const headerExists = profileGifHeaders.find(
      (header) => toString(header.userId) === toString(message.user._id),
    );

    if (!headerExists) {
      const header = getFileSignedHeaders(message.user.profileGifUrl);
      profileGifHeaders.push({
        userId: message.user._id,
        profileGifHeader: header,
      });
      message.user.profileGifHeaders = header;
    } else {
      message.user.profileGifHeaders = headerExists.profileGifHeader;
    }
  });

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

module.exports = { getChatMessages, createChat };
