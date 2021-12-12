const Messages = require('../../models/chat/Message');

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

module.exports = { getChatMessages };
