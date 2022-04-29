const User = require('../models/user/User');
const Messages = require('../models/chat/Message');
const socketAuth = require('../middleware/socketAuth');
const {
  getNameDate, get12HourTime, createChatSession, deleteChatSession,
} = require('../helpers');
const { sendNotificationToRecipiants } = require('../services/Notifications/Notifications');
const { updateChatUpToDateUsers } = require('../services/Chat/Chat');

module.exports = (io, pid) => {
  io.use((socket, next) => socketAuth(socket, next)).on('connection', (socket) => {
    socket.on('disconnect', () => {
      console.log('disconnect');
      deleteChatSession(socket.user._id, socket.chatId);
      socket.to(socket.chatId).emit('userLeftRoom', { userId: socket.user._id });
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

    socket.on('forwardServerSideMessage', async ({ chatId, message }) => {
      socket.to(chatId).emit('receiveMessage', message);
      if (!message.online) {
        await sendNotificationToRecipiants(message.senderId, chatId, message.body || (message.mediaType ? `sent ${message.mediaType}` : null) || '');
      }
    });

    socket.on('sendMessage', async ({
      body, chatId, senderId, recipientId, mediaUrl, mediaType, mediaHeaders, online: userIsOnline, signedUrl, thumbnailUrl, thumbnailHeaders, messageOverride,
    }) => {
      // const messageInfo = {
      //   body,
      //   chatId,
      //   senderId,
      //   mediaUrl: mediaUrl || null,
      //   thumbnailUrl: thumbnailUrl || null,
      //   mediaType: mediaType || null,
      //   mediaHeaders: mediaHeaders || null,
      //   stringDate: getNameDate(new Date()),
      //   stringTime: get12HourTime(new Date()),
      //   ready: true,
      // };
      // console.log({ test: { thumbnailUrl, thumbnailHeaders } });
      // if (!body && !mediaUrl) return;
      // if (messageOverride) {
      //   Object.keys(messageInfo).forEach((key) => {
      //     messageOverride[key] = messageInfo[key];
      //   });
      // }
      // const message = messageOverride || new Messages(messageInfo);
      const message = new Messages({
        body,
        chatId,
        senderId,
        mediaUrl: mediaUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        mediaType: mediaType || null,
        mediaHeaders: mediaHeaders || null,
        stringDate: getNameDate(new Date()),
        stringTime: get12HourTime(new Date()),
        ready: true,
      });
      message.save();
      if (!socket.user) {
        const user = await User.findById(senderId);

        socket.user = user;
      }
      if (userIsOnline !== socket.userIsOnline) {
        socket.userIsOnline = userIsOnline;
        updateChatUpToDateUsers(recipientId, socket.chatId, userIsOnline);
      }

      const {
        firstName, lastName, username, _id: userId,
      } = socket.user;

      socket.to(chatId).emit('receiveMessage', {
        body,
        chatId,
        senderId,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        mediaHeaders: mediaHeaders || null,
        signedMediaUrl: signedUrl || null,
        thumbnailUrl,
        thumbnailHeaders,
        stringDate: getNameDate(new Date()),
        stringTime: get12HourTime(new Date()),
        ready: true,
        _id: message.toObject()._id,
        user: {
          firstName,
          lastName,
          username,
          _id: userId,
        },
      });
      if (!userIsOnline) {
        await sendNotificationToRecipiants(senderId, chatId, body);
      }
    });
  });
};
