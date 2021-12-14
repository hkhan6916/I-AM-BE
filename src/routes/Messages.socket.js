const User = require('../models/user/User');
const Messages = require('../models/chat/Message');
const socketAuth = require('../middleware/socketAuth');

module.exports = (io) => {
  io.use((socket, next) => socketAuth(socket, next)).on('connection', (socket) => {
    socket.on('disconnect', () => {
      socket.emit('disconnected');
    });

    socket.on('joinRoom', async ({ chatId, userId }) => {
      socket.join(chatId);
      socket.emit('joinRoomSuccess', { chatId });
      const user = await User.findById(userId);

      socket.user = user;
    });

    socket.on('sendMessage', async ({
      body, chatId, senderId, mediaUrl,
    }) => {
      const message = new Messages({
        body,
        chatId,
        senderId,
        mediaUrl: mediaUrl || null,
      });
      message.save();
      if (!socket.user) {
        const user = await User.findById(senderId);

        socket.user = user;
      }
      const {
        firstName, lastName, username, _id,
      } = socket.user;

      socket.to(chatId).emit('receiveMessage', {
        body,
        chatId,
        senderId,
        mediaUrl,
        user: {
          firstName, lastName, username, _id,
        },
      });

      // TODO: send notification
    });
  });
};
