const User = require('../../models/user/User');

const updateNotificationToken = async (userId, notificationToken) => {
  const user = await User.findById(userId);
  user.notificationToken = notificationToken;
  user.save();
  return 'Notification token updated.';
};

module.exports = {
  updateNotificationToken,
};
