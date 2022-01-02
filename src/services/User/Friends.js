const User = require('../../models/user/User');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');

const resetUserFriendsList = async (id) => {
  const user = await User.findById(id);

  user.friendRequestsReceived = [];
  user.friendRequestsSent = [];
  user.connections = [];

  user.save();
};

const searchUser = async (username, offset) => {
  const userRecords = await (async () => {
    const searchQuery = username.toLowerCase();
    const result = await User.find({
      $text:
        { $search: searchQuery },
    }).skip(offset).limit(10);

    return result;
  })();

  if (!userRecords.length) {
    throw new Error('no users found');
  }

  const users = userRecords.map((user) => ({
    ...user.toObject(),
    profileGifHeaders: getFileSignedHeaders(user.profileGifUrl),
  }));

  return users;
};

const getSingleUser = async (otherUserId, userId) => {
  const otherUserRecord = await User.findById(otherUserId);
  const user = await User.findById(userId);
  if (!otherUserRecord) {
    throw new Error('no user found');
  }

  const otherUser = {
    ...otherUserRecord.toObject(),
    profileVideoHeaders: getFileSignedHeaders(otherUserRecord.profileVideoUrl),
  };
  return { otherUser, user };
};

const getUserFriends = async (userId, offset) => {
  const user = await User.findById(userId);
  const connections = await User.find({
    _id: {
      $in: user.connections,
    },
  }, 'firstName lastName username email profileVideoUrl profileGifUrl').skip(offset || 0).limit(20);
  if (!user) {
    throw new Error('No user found.');
  }

  if (!Array.isArray(connections)) {
    throw new Error('Could not fetch connections.');
  }

  connections.forEach((friend) => {
    friend.profileGifHeaders = getFileSignedHeaders(friend.profileGifUrl);
  });

  return connections;
};

const getUserFriendRequests = async (userId) => {
  const user = await User.findById(userId);
  const receivedRecords = await User.find({
    _id: {
      $in: user.friendRequestsReceived,
    },
  }, 'firstName lastName username email profileVideoUrl profileGifUrl');

  const sentRecords = await User.find({
    _id: {
      $in: user.friendRequestsSent,
    },
  }, 'firstName lastName username email profileVideoUrl profileGifUrl');

  if (!user) {
    throw new Error('No user found.');
  }

  if (!Array.isArray(sentRecords)) {
    throw new Error('Could not fetch sent requests.');
  }

  if (!Array.isArray(receivedRecords)) {
    throw new Error('Could not fetch received requests.');
  }

  const received = receivedRecords.map((request) => ({
    ...request.toObject(),
    profileGifHeaders: getFileSignedHeaders(request.profileGifUrl),
  }));

  const sent = sentRecords.map((request) => ({
    ...request.toObject(),
    profileGifHeaders: getFileSignedHeaders(request.profileGifUrl),
  }));

  return { sent, received };
};

const sendFriendRequest = async (userId, recipientId) => {
  const recipient = await User.findById(recipientId);
  const user = await User.findById(userId);
  if (!recipient || !user) {
    throw new Error('User or recipient does not exist.');
  }

  if (recipient._id === user._id) {
    throw new Error('Cannot send a request to the same user.');
  }

  if (user.friendRequestsReceived.includes(recipientId)) {
    return user;
  }
  if (recipient.friendRequestsReceived.includes(userId)) {
    throw new Error('Request already sent');
  }
  recipient.friendRequestsReceived = ([...recipient.friendRequestsReceived, userId]);
  user.friendRequestsSent = ([...user.friendRequestsSent, recipientId]);

  recipient.save();
  user.save();

  return user;
};

const acceptFriendRequest = async (userId, requesterId) => {
  const requester = await User.findById(requesterId);
  const user = await User.findById(userId);

  if (!requester || !user) {
    throw new Error('User does not exist.');
  }

  if (user.connections.includes(requesterId)) {
    throw new Error('Request already accepted');
  }

  if (!user.friendRequestsReceived.includes(requesterId)) {
    throw new Error('Request does not exist.');
  }

  const requesterRequestIndex = requester.friendRequestsSent.indexOf(userId);
  const acceptorRequestIndex = user.friendRequestsReceived.indexOf(requesterId);
  // remove requests from both receiver and requester of friend request
  if (acceptorRequestIndex !== -1 && requesterRequestIndex !== -1) {
    user.friendRequestsReceived.splice(acceptorRequestIndex, 1);
    requester.friendRequestsSent.splice(requesterRequestIndex, 1);
  }

  user.connections = ([...user.connections, requesterId]);
  requester.connections = ([...requester.connections, userId]);

  user.save();
  requester.save();

  return user;
};

const rejectFriendRequest = async (userId, requesterId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist..');
  }

  if (user.connections.includes(requesterId)) {
    throw new Error('Request already accepted.');
  }
  if (!user.friendRequestsReceived.includes(requesterId)) {
    throw new Error('Request does not exist.');
  }

  const acceptorRequestIndex = user.friendRequestsReceived.indexOf(requesterId);
  // remove requests from both receiver and requester of friend request
  if (acceptorRequestIndex !== -1) {
    user.friendRequestsReceived.splice(acceptorRequestIndex, 1);
  }

  user.save();

  return user;
};

const recallFriendRequest = async (userId, recipientId) => {
  const recipient = await User.findById(recipientId);
  const user = await User.findById(userId);
  if (!recipient || !user) {
    throw new Error('User does not exist.');
  }

  if (user.connections.includes(recipientId)) {
    return user;
  }

  if (!user.friendRequestsSent.includes(recipientId)) {
    throw new Error('Request does not exist.');
  }

  const requesterRequestIndex = user.friendRequestsSent.indexOf(recipientId);
  const recipientRequestIndex = recipient.friendRequestsReceived.indexOf(userId);
  // remove requests from both receiver and requester
  if (recipientRequestIndex !== -1 && requesterRequestIndex !== -1) {
    user.friendRequestsSent.splice(requesterRequestIndex, 1);
    recipient.friendRequestsReceived.splice(recipientRequestIndex, 1);
  }
  user.save();
  recipient.save();

  return user;
};

const removeConnection = async (userId, friendId) => {
  const connection = await User.findById(friendId);
  const user = await User.findById(userId);

  if (!connection || !user) {
    throw new Error('User does not exist.');
  }

  if (!user.connections.includes(friendId)
  || !connection.connections.includes(userId)) {
    throw new Error('Not connected to this user.');
  }

  const connectionConnectionIndex = connection.connections.indexOf(userId);
  const userConnectionIndex = user.connections.indexOf(friendId);

  if (userConnectionIndex !== -1 && connectionConnectionIndex !== -1) {
    user.connections.splice(userConnectionIndex, 1);
    connection.connections.splice(connectionConnectionIndex, 1);
  }

  user.save();
  connection.save();

  return user;
};

module.exports = {
  searchUser,
  getSingleUser,
  getUserFriends,
  getUserFriendRequests,
  sendFriendRequest,
  recallFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeConnection,
  resetUserFriendsList,
};
