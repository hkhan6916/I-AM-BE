const User = require('../../models/user/User');
const Connections = require('../../models/user/Connections');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');

// todo delete this when no longer needed
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

  const requestSent = await Connections.findOne({
    requesterId: user._id,
    receiverId: otherUserRecord._id,
  });

  const requestReceived = await Connections.findOne({
    requesterId: otherUserRecord._id,
    receiverId: user._id,
  });

  const otherUser = {
    ...otherUserRecord.toObject(),
    profileVideoHeaders: getFileSignedHeaders(otherUserRecord.profileVideoUrl),
    isFriend: !!requestSent?.accepted || !!requestReceived?.accepted,
    requestSent: !!requestSent,
    requestReceived: !!requestReceived,
  };
  return {
    otherUser,
    user,
  };
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
  // const recipient = await User.findById(recipientId);
  // const user = await User.findById(userId);
  // if (!recipient || !user) {
  //   throw new Error('User or recipient does not exist.');
  // }

  // if (recipient._id === user._id) {
  //   throw new Error('Cannot send a request to the same user.');
  // }

  // if (user.friendRequestsReceived.includes(recipientId)) {
  //   return user;
  // }
  // if (recipient.friendRequestsReceived.includes(userId)) {
  //   throw new Error('Request already sent');
  // }
  // recipient.friendRequestsReceived = ([...recipient.friendRequestsReceived, userId]);
  // user.friendRequestsSent = ([...user.friendRequestsSent, recipientId]);

  // recipient.save();
  // user.save();

  // return user;

  const recipient = await User.findById(recipientId);
  const user = await User.findById(userId);
  if (!recipient || !user) {
    throw new Error('User or recipient does not exist.');
  }

  if (recipient._id === user._id) {
    throw new Error('Cannot send a request to the same user.');
  }

  const requestAlreadySent = await Connections.findOne({
    $and:
       [{ requesterId: user._id }, { receiverId: recipient._id }],
  });
  if (requestAlreadySent) {
    return requestAlreadySent;
  }

  const requestAlreadyReceived = await Connections.findOne({
    $and:
    [{ requesterId: recipient._id }, { receiverId: user._id }],
  });
  if (requestAlreadyReceived) {
    return requestAlreadyReceived;
  }

  const newRequest = await Connections.create({
    requesterId: user._id,
    receiverId: recipient._id,
    accepted: false,
  });

  return newRequest;
};

const acceptFriendRequest = async (userId, requesterId) => {
  const requester = await User.findById(requesterId);
  const user = await User.findById(userId);

  if (!requester || !user) {
    throw new Error('User does not exist.');
  }

  const request = await Connections.findOne({
    requesterId: requester._id, receiverId: user._id,
  });

  if (!request) {
    throw new Error('Request does not exist.');
  }

  if (request.accepted) {
    throw new Error('Request already accepted');
  }

  request.accepted = true;

  request.save();

  // TODO get other user posts and return them

  return requester;

  // if (user.connections.includes(requesterId)) {
  //   throw new Error('Request already accepted');
  // }

  // if (!user.friendRequestsReceived.includes(requesterId)) {
  //   throw new Error('Request does not exist.');
  // }

  // const requesterRequestIndex = requester.friendRequestsSent.indexOf(userId);
  // const acceptorRequestIndex = user.friendRequestsReceived.indexOf(requesterId);
  // // remove requests from both receiver and requester of friend request
  // if (acceptorRequestIndex !== -1 && requesterRequestIndex !== -1) {
  //   user.friendRequestsReceived.splice(acceptorRequestIndex, 1);
  //   requester.friendRequestsSent.splice(requesterRequestIndex, 1);
  // }

  // user.connections = ([...user.connections, requesterId]);
  // requester.connections = ([...requester.connections, userId]);

  // user.save();
  // requester.save();

  // return user;
};

const rejectFriendRequest = async (userId, requesterId) => {
  // const user = await User.findById(userId);

  // if (!user) {
  //   throw new Error('User does not exist..');
  // }

  // if (user.connections.includes(requesterId)) {
  //   throw new Error('Request already accepted.');
  // }
  // if (!user.friendRequestsReceived.includes(requesterId)) {
  //   throw new Error('Request does not exist.');
  // }

  // const acceptorRequestIndex = user.friendRequestsReceived.indexOf(requesterId);
  // // remove requests from both receiver and requester of friend request
  // if (acceptorRequestIndex !== -1) {
  //   user.friendRequestsReceived.splice(acceptorRequestIndex, 1);
  // }

  // user.save();

  // return user;

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist..');
  }

  const request = await Connections.findOneAndDelete({ requesterId, recipientId: userId });

  if (!request) {
    throw new Error('Request does not exist.');
  }

  if (request.accepted) {
    throw new Error('Request already accepted.');
  }

  await Connections.findOneAndDelete({ requesterId, recipientId: userId });

  return { rejected: true };
};

const recallFriendRequest = async (userId, recipientId) => {
  // const recipient = await User.findById(recipientId);
  // const user = await User.findById(userId);
  // if (!recipient || !user) {
  //   throw new Error('User does not exist.');
  // }

  // if (user.connections.includes(recipientId)) {
  //   return user;
  // }

  // if (!user.friendRequestsSent.includes(recipientId)) {
  //   throw new Error('Request does not exist.');
  // }

  // const requesterRequestIndex = user.friendRequestsSent.indexOf(recipientId);
  // const recipientRequestIndex = recipient.friendRequestsReceived.indexOf(userId);
  // // remove requests from both receiver and requester
  // if (recipientRequestIndex !== -1 && requesterRequestIndex !== -1) {
  //   user.friendRequestsSent.splice(requesterRequestIndex, 1);
  //   recipient.friendRequestsReceived.splice(recipientRequestIndex, 1);
  // }
  // user.save();
  // recipient.save();

  // return user;

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist..');
  }

  const request = await Connections.findOneAndDelete({ requesterId: user._id, recipientId });

  if (!request) {
    throw new Error('Request does not exist.');
  }

  if (request.accepted) {
    throw new Error('Request already accepted.');
  }

  await Connections.findOneAndDelete({ requesterId: user._id, recipientId });

  return { recalled: true };
};

const removeConnection = async (userId, friendId) => {
  // const connection = await User.findById(friendId);
  // const user = await User.findById(userId);

  // if (!connection || !user) {
  //   throw new Error('User does not exist.');
  // }

  // if (!user.connections.includes(friendId)
  // || !connection.connections.includes(userId)) {
  //   throw new Error('Not connected to this user.');
  // }

  // const connectionConnectionIndex = connection.connections.indexOf(userId);
  // const userConnectionIndex = user.connections.indexOf(friendId);

  // if (userConnectionIndex !== -1 && connectionConnectionIndex !== -1) {
  //   user.connections.splice(userConnectionIndex, 1);
  //   connection.connections.splice(connectionConnectionIndex, 1);
  // }

  // user.save();
  // connection.save();

  // return user;

  const friend = await User.findById(friendId);
  const user = await User.findById(userId);

  if (!friend || !user) {
    throw new Error('User does not exist.');
  }

  const connection = await Connections.findOneAndDelete({
    $or:
       [{
         requesterId: user._id,
         receiverId: friend._id,
         accepted: true,
       }, {
         requesterId: friend._id,
         receiverId: user._id,
         accepted: true,
       }],
  });

  if (!connection) {
    throw new Error('User connection does not exist.');
  }

  return { deleted: true };
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
