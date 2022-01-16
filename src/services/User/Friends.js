const { ObjectId } = require('mongoose').Types;
const User = require('../../models/user/User');
const Connections = require('../../models/user/Connections');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');

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
    numberOfFriends: otherUserRecord.friendsAsReceiver + otherUserRecord.numberOfFriendsAsRequester,
  };
  return {
    otherUser,
    user,
  };
};

const getUserFriends = async (userId, offset) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User does not exist.');
  }

  const friendsAsSender = await Connections.aggregate([
    {
      $match: { requesterId: user._id, accepted: true },
    },
    { $skip: offset || 0 },
    { $limit: 15 },
    {
      $lookup: {
        from: 'users',
        let: { friendId: '$receiverId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$$friendId', '$_id'] },
            },
          },
        ],
        as: 'friends',
      },
    },
    {
      $unwind:
       {
         path: '$friends',
         preserveNullAndEmptyArrays: true,
       },
    },
    { $replaceRoot: { newRoot: '$friends' } },
    {
      $project: {
        firstName: 1,
        lastName: 1,
        username: 1,
        email: 1,
        profileVideoUrl: 1,
        profileGifUrl: 1,
      },
    },
  ]);

  const friendsAsReceiver = await Connections.aggregate([
    {
      $match: { receiverId: user._id, accepted: true },
    },
    { $skip: offset || 0 },
    { $limit: 15 },
    {
      $lookup: {
        from: 'users',
        let: { friendId: '$requesterId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$$friendId', '$_id'] },
            },
          },
        ],
        as: 'friends',
      },
    }, {
      $unwind:
       {
         path: '$friends',
         preserveNullAndEmptyArrays: true,
       },
    },
    { $replaceRoot: { newRoot: '$friends' } },
    {
      $project: {
        firstName: 1,
        lastName: 1,
        username: 1,
        email: 1,
        profileVideoUrl: 1,
        profileGifUrl: 1,
      },
    },
  ]);

  const friends = [...friendsAsSender, ...friendsAsReceiver];

  if (!Array.isArray(friends)) {
    throw new Error('Could not fetch friends.');
  }

  friends.forEach((friend) => {
    friend.profileGifHeaders = getFileSignedHeaders(friend.profileGifUrl);
  });

  return friends;
};

const getUserFriendRequests = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('No user found.');
  }

  const receivedRecords = await Connections.aggregate([
    {
      $match: {
        receiverId: ObjectId(userId),
        accepted: false,
      },
    },
    {
      $lookup: {
        from: 'users',
        let: { requesterId: '$requesterId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$requesterId'],
              },
            },
          },
        ],
        as: 'user',
      },
    },
    {
      $unwind:
       {
         path: '$user',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $replaceRoot: { newRoot: '$user' },
    },
  ]);

  const sentRecords = await Connections.aggregate([
    {
      $match: {
        requesterId: ObjectId(userId),
        accepted: false,
      },
    },
    {
      $lookup: {
        from: 'users',
        let: { receiverId: '$receiverId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$receiverId'],
              },
            },
          },
        ],
        as: 'user',
      },
    },
    {
      $unwind:
       {
         path: '$user',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $replaceRoot: { newRoot: '$user' },
    },
  ]);

  if (!Array.isArray(sentRecords)) {
    throw new Error('Could not fetch sent requests.');
  }

  if (!Array.isArray(receivedRecords)) {
    throw new Error('Could not fetch received requests.');
  }

  const received = receivedRecords.map((request) => ({
    ...request,
    profileGifHeaders: getFileSignedHeaders(request.profileGifUrl),
  }));

  const sent = sentRecords.map((request) => ({
    ...request,
    profileGifHeaders: getFileSignedHeaders(request.profileGifUrl),
  }));

  return { sent, received };
};

const sendFriendRequest = async (userId, receiverId) => {
  const receiver = await User.findById(receiverId);
  const user = await User.findById(userId);
  if (!receiver || !user) {
    throw new Error('User or receiver does not exist.');
  }

  if (receiver._id === user._id) {
    throw new Error('Cannot send a request to the same user.');
  }

  const requestAlreadySent = await Connections.findOne({
    $and:
       [{ requesterId: user._id }, { receiverId: receiver._id }],
  });
  if (requestAlreadySent) {
    return requestAlreadySent;
  }

  const requestAlreadyReceived = await Connections.findOne({
    $and:
    [{ requesterId: receiver._id }, { receiverId: user._id }],
  });
  if (requestAlreadyReceived) {
    return requestAlreadyReceived;
  }

  const newRequest = await Connections.create({
    requesterId: user._id,
    receiverId: receiver._id,
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
  requester.numberOfFriendsAsRequester += 1;
  user.numberOfFriendsAsReceiver += 1;
  requester.save();
  user.save();
  request.save();

  // TODO get other user posts and return them

  return requester;
};

const rejectFriendRequest = async (userId, requesterId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist..');
  }

  const request = await Connections.findOneAndDelete({ requesterId, receiverId: user._id });

  if (!request) {
    throw new Error('Request does not exist.');
  }

  if (request.accepted) {
    throw new Error('Request already accepted.');
  }

  await Connections.findOneAndDelete({ requesterId, receiverId: user._id });

  return { rejected: true };
};

const recallFriendRequest = async (userId, receiverId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist..');
  }

  const request = await Connections.findOneAndDelete({ requesterId: user._id, receiverId });

  if (!request) {
    throw new Error('Request does not exist.');
  }

  if (request.accepted) {
    throw new Error('Request already accepted.');
  }

  await Connections.findOneAndDelete({ requesterId: user._id, receiverId });

  return { recalled: true };
};

const removeConnection = async (userId, friendId) => {
  const friend = await User.findById(friendId);
  const user = await User.findById(userId);

  if (!friend || !user) {
    throw new Error('User does not exist.');
  }

  const connectionAsRequester = await Connections.findOneAndDelete({
    requesterId: user._id,
    accepted: true,
  });
  if (connectionAsRequester) {
    friend.numberOfFriendsAsReceiver -= 1;
    user.numberOfFriendsAsRequester -= 1;
    friend.save();
    user.save();
  }
  const connectionAsReceiver = await Connections.findOneAndDelete({
    receiverId: user._id,
    accepted: true,
  });

  if (!connectionAsReceiver) {
    throw new Error('User connection does not exist.');
  }

  friend.numberOfFriendsAsRequester -= 1;
  user.numberOfFriendsAsReceiver -= 1;
  friend.save();
  user.save();

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
};
