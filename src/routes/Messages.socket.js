const User = require('../models/user/User');
const Messages = require('../models/chat/Message');
const socketAuth = require('../middleware/socketAuth');
const {
  getNameDate, get12HourTime, createChatSession, deleteChatSession,
} = require('../helpers');
const { sendNotificationToRecipiants } = require('../services/Notifications/Notifications');
const { notify } = require('./User');

module.exports = (io, pid) => {
  io.use((socket, next) => socketAuth(socket, next)).on('connection', (socket) => {
    socket.on('disconnect', () => {
      deleteChatSession(socket.user._id, socket.chatId);
      socket.emit('userLeftRoom', { userId: socket.user._id });
    });

    socket.on('joinRoom', async ({ chatId, userId }) => {
      createChatSession(userId, chatId);
      socket.join(chatId);
      socket.emit('joinRoomSuccess', { chatId });
      socket.to(chatId).emit('userJoinedRoom', { userId });
      const user = await User.findById(userId);

      socket.user = user;
      socket.chatId = chatId;
    });

    socket.on('sendMessage', async ({
      body, chatId, senderId, mediaUrl, mediaType, mediaHeaders, notifyUser,
    }) => {
      console.log(pid);
      const message = new Messages({
        body,
        chatId,
        senderId,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        mediaHeaders: mediaHeaders || null,
        stringDate: getNameDate(new Date()),
        stringTime: get12HourTime(new Date()),
      });
      message.save();
      if (!socket.user) {
        const user = await User.findById(senderId);

        socket.user = user;
      }
      if (notifyUser && typeof socket.userReadStatusUpdated !== 'boolean') {
        socket.userReadStatusUpdated = notifyUser;
      }
      console.log(socket.userReadStatusUpdated);
      const {
        firstName, lastName, username, _id,
      } = socket.user;

      socket.to(chatId).emit('receiveMessage', {
        body,
        chatId,
        senderId,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        mediaHeaders: mediaHeaders || null,
        stringDate: getNameDate(new Date()),
        stringTime: get12HourTime(new Date()),
        user: {
          firstName,
          lastName,
          username,
          _id,
        },
      });
      await sendNotificationToRecipiants(senderId, chatId, body);
    });
  });
};
