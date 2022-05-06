const User = require('../../models/user/User');

const updateNotificationToken = async (userId, notificationToken) => {
  const user = await User.findById(userId);
  user.notificationToken = notificationToken;
  user.save();
  return 'Notification token updated.';
};

const deleteNotificationToken = async (userId) => {
  const user = await User.findById(userId);
  if (user) {
    user.notificationToken = '';
    user.save();
  }
  return 'Notification token deleted.';
};

module.exports = {
  updateNotificationToken,
  deleteNotificationToken,
};
