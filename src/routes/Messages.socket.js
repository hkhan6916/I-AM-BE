const User = require('../models/user/User');
const Messages = require('../models/chat/Message');
const socketAuth = require('../middleware/socketAuth');
const {
  getNameDate, get12HourTime,
} = require('../helpers');
const { sendNotificationToRecipiants } = require('../services/Notifications/Notifications');
const { updateChatUpToDateUsers } = require('../services/Chat/Chat');
const Chat = require('../models/chat/Chat');
const BlockedUsers = require('../models/user/BlockedUsers');

module.exports = (io, pid) => {
  io.use((socket, next) => socketAuth(socket, next)).on('connection', (socket) => {
    socket.on('disconnect', () => {
      // deleteChatSession(socket.user._id, socket.chatId);
      socket.userIsOnline = false;

      socket.to(socket.chatId).emit('userLeftRoom', { userId: socket.user._id });
    });

    socket.on('joinRoom', async ({ chatId, userId }) => {
      socket.userIsOnline = true;
      const chat = await Chat.findById(chatId);
      if (chat) {
        const otherUserId = await chat.participants.filter((id) => id !== userId)[0];
        const userIsBlocked = await BlockedUsers.findOne({ userId: otherUserId, blockedUserId: userId });
        const userHasBlocked = await BlockedUsers.findOne({ userId, blockedUserId: otherUserId });

        if (!userIsBlocked && !userHasBlocked) {
          socket.join(chatId);
          socket.emit('joinRoomSuccess', { chatId, userId });
          socket.to(chatId).emit('userJoinedRoom', { userId });

          const user = await User.findById(userId);

          socket.user = user;
          socket.chatId = chatId;
        } else {
          socket.emit(userHasBlocked ? 'userHasBlocked' : 'userIsBlocked');
          socket.disconnect();
        }
      }
    });

    socket.on('sendUserOnlineStatus', async ({ chatId, userId }) => {
      socket.to(chatId).emit('receiveUserOnlineStatus', { userId });
    });

    socket.on('forwardServerSideMessage', async ({ chatId, message }) => {
      socket.to(chatId).emit('receiveMessage', message);
      if (!message.online) {
        await sendNotificationToRecipiants(message.senderId, chatId, message.body || (message.mediaType ? `sent ${message.mediaType === 'video' ? 'a video' : 'an image'}` : null) || '');
      }
    });

    socket.on('sendMessage', async ({
      body, chatId, senderId, recipientId, mediaUrl, mediaType, mediaHeaders, online: userIsOnline, signedUrl, thumbnailUrl, thumbnailHeaders,
    }) => {
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
        await updateChatUpToDateUsers(recipientId, chatId, userIsOnline);
      }
      if (!socket.user) return;
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
