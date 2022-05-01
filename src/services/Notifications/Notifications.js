const { Expo } = require('expo-server-sdk');
const Chat = require('../../models/chat/Chat');
const User = require('../../models/user/User');

const expo = new Expo();

const sendNotificationToRecipiants = async (senderId, chatId, message) => {
  const notifications = [];
  const chat = await Chat.findById(chatId);

  // TODO remove sessions and implement a navigation listener on the frontend to prevent notifcations is user in chat
  const recipients = await User.find({ _id: { $in: chat.participants } });
  const sender = await User.findById(senderId);
  for (let i = 0; i < recipients.length; i += 1) {
    if (recipients[i]._id.toString() !== senderId) {
      notifications.push({
        to: recipients[i].notificationToken,
        sound: 'default',
        title: `${sender.firstName} ${sender.lastName}`,
        body: message,
        data: { message, chatId, ...{ pushToken: recipients[i].notificationToken } },
      });
      if (!Expo.isExpoPushToken(recipients[i].notificationToken)) {
        console.error(`Push token ${recipients[i].notificationToken} is not a valid Expo push token`);
      }
    }
  }

  const chunks = expo.chunkPushNotifications(notifications);

  chunks.forEach(async (chunk) => {
    try {
      await expo.sendPushNotificationsAsync(chunk);
      console.log(chunk);
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
    categoryIdentifier: 'chat_message',
  }]);
  await expo.sendPushNotificationsAsync(chunk[0]);

  return { success: true, message: 'sent' };
};

module.exports = {
  sendNotificationToRecipiants,
  sendNotificationToSingleUser,
};
