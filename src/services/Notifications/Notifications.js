const { Expo } = require('expo-server-sdk');
const Chat = require('../../models/chat/Chat');
const User = require('../../models/user/User');

const expo = new Expo();

const sendNotificationToRecipiants = async (senderId, chatId, message) => {
  const notifications = [];

  const chat = await Chat.findById(chatId);
  const senderIndex = chat.participants.indexOf(senderId);
  if (senderIndex > -1) {
    chat.participants.splice(senderIndex, 1);
  }
  const recipiants = await User.find().where('_id').in(chat.participants);

  for (let i = 0; i < recipiants.length; i += 1) {
    notifications.push({
      to: recipiants[i].notificationToken,
      sound: 'default',
      title: `${recipiants[i].firstName} ${recipiants[i].lastName}`,
      body: message,
      data: { ...message, ...{ pushToken: recipiants[i].notificationToken } },
    });
    if (!Expo.isExpoPushToken(recipiants[i].notificationToken)) {
      console.error(`Push token ${recipiants[i].notificationToken} is not a valid Expo push token`);
    }
  }

  const chunks = expo.chunkPushNotifications(notifications);
  chunks.forEach(async (chunk) => {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.log(error);
    }
  });

  return { success: true, message: 'sent' };
};

module.exports = {
  sendNotificationToRecipiants,
};
