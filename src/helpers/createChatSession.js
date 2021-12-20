const ChatSession = require('../models/chat/ChatSession');

module.exports = async (userId, chatId) => {
  const session = await ChatSession.findOne({ userId, chatId });
  if (session) {
    return session;
  }
  const newSession = new ChatSession({ userId, chatId });
  newSession.save();
  return newSession;
};
