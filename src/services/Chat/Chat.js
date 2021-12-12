const { ObjectId } = require('mongoose').Types;
const Messages = require('../../models/chat/Message');
const Chat = require('../../models/chat/Chat');
const User = require('../../models/user/User');

const getChatMessages = async (chatId, offset) => {
  const messages = await Messages.aggregate([
    {
      $match: {
        chatId,
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: offset || 0 },
    { $limit: 10 },
  ]);

  messages.forEach((message) => {
    // check if message is over a year old
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
  });

  return messages;
};

const createChat = async (participants, hostId) => {
  if (participants?.length !== 2) {
    throw new Error(`Chat room must have 2 participants but got ${participants.length}`);
  }

  const exists = await Chat.find({ participants });
  //   if (exists) {}
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
    participants,
  });

  chat.save();
  return { _id: chat._id, participants, users: users[0] };
};

module.exports = { getChatMessages, createChat };
