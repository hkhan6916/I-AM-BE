const ChatSession = require('../models/chat/ChatSession');

module.exports = async (userId, chatId) => {
  const session = await ChatSession.findOneAndDelete({ userId, chatId });
  return session;
};
