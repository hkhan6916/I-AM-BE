const { Expo } = require('expo-server-sdk');
const Chat = require('../../models/chat/Chat');
const User = require('../../models/user/User');
const ChatSession = require('../../models/chat/ChatSession');

const expo = new Expo();

const sendNotificationToRecipiants = async (senderId, chatId, message) => {
  const notifications = [];

  const chat = await Chat.findById(chatId);
  const senderIndex = chat.participants.indexOf(senderId);
  if (senderIndex > -1) {
    chat.participants.splice(senderIndex, 1);
  }
  const sessions = await ChatSession.find({ chatId });

  sessions.forEach((session) => {
    if (session.userId !== senderId) {
      const sessionIndex = chat.participants.indexOf(session.userId);
      if (sessionIndex > -1) {
        chat.participants.splice(sessionIndex, 1);
      }
    }
  });

  const recipiants = await User.find({ _id: { $in: chat.participants } });

  for (let i = 0; i < recipiants.length; i += 1) {
    notifications.push({
      to: recipiants[i].notificationToken,
      sound: 'default',
      title: `${recipiants[i].firstName} ${recipiants[i].lastName}`,
      body: message,
      data: { message, ...{ pushToken: recipiants[i].notificationToken } },
    });
    if (!Expo.isExpoPushToken(recipiants[i].notificationToken)) {
      console.error(`Push token ${recipiants[i].notificationToken} is not a valid Expo push token`);
    }
  }

  const chunks = expo.chunkPushNotifications(notifications);

  chunks.forEach(async (chunk) => {
    console.log(chunk);
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.log(error);
    }
  });

  return { success: true, message: 'sent' };
};

const sendNotificationToSingleUser = async ({ userId, title, messageBody }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User does not exist');
  }
  if (!Expo.isExpoPushToken(user.notificationToken)) {
    throw new Error(`Push token ${user.notificationToken} is not a valid Expo push token`);
  }
  const chunk = expo.chunkPushNotifications([{
    to: user.notificationToken,
    sound: 'default',
    title,
    body: messageBody,
    data: {},
  }]);
  await expo.sendPushNotificationsAsync(chunk[0]);

  return { success: true, message: 'sent' };
};

module.exports = {
  sendNotificationToRecipiants,
  sendNotificationToSingleUser,
};
