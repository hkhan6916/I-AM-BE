const User = require('../../models/user/User');

const sendFriendRequest = async (userId, recipientId) => {
  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new Error('user does not exist');
  }

  if (recipient.friendRequests.includes(recipientId)) {
    console.log(recipient);
    throw new Error('Request already sent');
  }
  console.log(recipient);

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
  console.log(requester, user);

  return 'request accepted';
};

module.exports = {
  sendFriendRequest,
  acceptFriendRequest,
};
