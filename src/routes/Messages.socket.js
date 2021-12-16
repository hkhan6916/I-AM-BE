const User = require('../models/user/User');
const Messages = require('../models/chat/Message');
const socketAuth = require('../middleware/socketAuth');
const { getNameDate, get12HourTime } = require('../helpers');

module.exports = (io) => {
  io.use((socket, next) => socketAuth(socket, next)).on('connection', (socket) => {
    socket.on('disconnect', () => {

    });

    socket.on('joinRoom', async ({ chatId, userId }) => {
      socket.join(chatId);
      socket.emit('joinRoomSuccess', { chatId });
      const user = await User.findById(userId);

      socket.user = user;
    });

    socket.on('sendMessage', async ({
      body, chatId, senderId, mediaUrl, mediaType,
    }) => {
      const message = new Messages({
        body,
        chatId,
        senderId,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        stringDate: getNameDate(new Date()),
        stringTime: get12HourTime(new Date()),
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
        stringDate: getNameDate(new Date()),
        // stringTime: get12HourTime(new Date()),
        user: {
          firstName,
          lastName,
          username,
          _id,
        },
      });

      // TODO: send notification
    });
  });
};
