const User = require('../../models/user/User');

const searchUser = async (username, offset) => {
  const users = await User.find({ username: { $regex: username, $options: 'i' } }, 'username firstName lastName profileVideoUrl profileGifUrl').skip(offset).limit(5);
  // const user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
  if (!users.length) {
    throw new Error('no users found');
  }

  return users;
};

const getSingleUser = async (id) => {
  const user = await User.findById(id);
  // const user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
  if (!user) {
    throw new Error('no user found');
  }

  return user;
};

const sendFriendRequest = async (userId, recipientId) => {
  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new Error('user does not exist');
  }

  if (recipient.friendRequests.includes(recipientId)) {
    throw new Error('Request already sent');
  }

  recipient.friendRequests = ([...recipient.friendRequests, userId]);

  recipient.save();

  return 'request sent';
};

const acceptFriendRequest = async (userId, requesterId) => {
  const requester = await User.findById(requesterId);
  const user = await User.findById(userId);

  if (!requester || !user) {
    throw new Error('user does not exist');
  }

  if (user.connections.includes(requesterId)) {
    throw new Error('Request already accepted');
  }

  user.friendRequests = user.friendRequests.filter((e) => e !== requesterId);
  user.connections = ([...user.connections, requesterId]);
  requester.connections = ([...requester.connections, userId]);

  user.save();
  requester.save();

  return 'request accepted';
};

module.exports = {
  searchUser,
  getSingleUser,
  sendFriendRequest,
  acceptFriendRequest,
};
