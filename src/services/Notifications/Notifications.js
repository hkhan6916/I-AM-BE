const { Expo } = require('expo-server-sdk');

const expo = new Expo();

const User = require('../../models/user/User');

const sendNotificationToRecipiants = async (userData, chat, message) => {
  const notifications = [];

  const senderIndex = chat.participants.indexOf(userData?.phoneNumber);
  if (senderIndex > -1) {
    chat.participants.splice(senderIndex, 1);
  }
  const recipiants = await User.find().where('phoneNumber').in(chat.participants);
  console.log(message, userData);
  for (let i = 0; i < recipiants.length; i += 1) {
    notifications.push({
      to: recipiants[i].pushNotificationToken,
      sound: 'default',
      title: userData.phoneNumber,
      body: message.messageText,
      data: { ...message, ...{ pushToken: recipiants[i].pushNotificationToken } },
    });
    if (!Expo.isExpoPushToken(recipiants[i].pushNotificationToken)) {
      console.error(`Push token ${recipiants[i].pushNotificationToken} is not a valid Expo push token`);
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
