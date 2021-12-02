const Chat = require('../models/chat/Chat');
const Messages = require('../models/chat/Message');
const socketAuth = require('../middleware/socketAuth');

module.exports = (io) => {
  io.use((socket, next) => socketAuth(socket, next)).on('connection', (socket) => {
    socket.on('disconnect', () => {
      console.log('Disconnected');
    });

    socket.on('createRoom', ({ participants }) => {
      if (participants.length !== 2) {
        throw new Error(`Chat room must have 2 participants got ${participants.length}`);
      }
      const chat = new Chat({
        participants,
      });
      chat.save();
      socket.join(chat._id);
      socket.emit('createRoomSuccess', { chat });
    });

    socket.on('joinRoom', ({ roomId }) => {
      socket.join(roomId);
      socket.emit('joinRoomSuccess', { roomId });
    });

    socket.on('sendMessage', ({
      body, chatId, senderId, mediaUrl,
    }) => {
      console.log('message');
      const message = new Messages({
        body,
        chatId,
        senderId,
        mediaUrl: mediaUrl || null,
      });
      message.save();
      // this is what we want in production.
      //   socket.to(chatId).emit('receiveMessage', {
      //     body, chatId, senderId, mediaUrl,
      //   });
      socket.emit('receiveMessage', {
        body, chatId, senderId, mediaUrl,
      });

      // TODO: send notification
    });
  });
};
