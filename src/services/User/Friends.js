const { ObjectId } = require('mongoose').Types;
const User = require('../../models/user/User');
const Connections = require('../../models/user/Connections');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');
const { sendNotificationToSingleUser } = require('../Notifications/Notifications');

const searchUser = async (username, offset) => {
  const searchQuery = username.toLowerCase();

  const result = await User.aggregate([
    {
      $search: {
        index: 'user_search',
        compound: {
          should: [
            {
              autocomplete: {
                query: searchQuery,
                path: 'firstName',
              },
            },
            {
              autocomplete: {
                query: searchQuery,
                path: 'lastName',
              },
            },
            {
              autocomplete: {
                query: searchQuery,
                path: 'username',
              },
            },
            {
              autocomplete: {
                query: searchQuery,
                path: 'jobTitle',
              },
            },
          ],
        },
      },
    },
    { $skip: offset || 0 },
    { $limit: 10 },
  ]);

  const users = result.map((user) => ({
    ...user,
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

  const profileVideoKey = otherUserRecord.profileVideoUrl.substring(otherUserRecord.profileVideoUrl.lastIndexOf('profileVideos'));
  const otherUserObj = otherUserRecord.toObject();
  const otherUser = {
    ...otherUserObj,
    // profileVideoHeaders: getFileSignedHeaders(otherUserRecord.profileVideoUrl),
    profileVideoUrl: getCloudfrontSignedUrl(profileVideoKey),
    isFriend: !!requestSent?.accepted || !!requestReceived?.accepted,
    requestSent: !!requestSent,
    requestReceived: !!requestReceived,
    numberOfFriends: otherUserObj.numberOfFriendsAsRequester + otherUserObj.numberOfFriendsAsReceiver,
    isSameUser: user._id.toString() === otherUserRecord._id.toString(),
  };
  return {
    otherUser,
    user,
  };
};

const getUserFriends = async ({ userId, friendsAsSenderOffset, friendsAsReceiverOffset }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User does not exist.');
  }

  const receivedFriendRequests = await Connections.aggregate([
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
    { $limit: 5 },
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
    { $addFields: { accepted: false } },
  ]);

  const friendsAsSender = await Connections.aggregate([
    {
      $match: { requesterId: user._id, accepted: true },
    },
    { $skip: friendsAsSenderOffset || 0 },
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
      $unwind: '$friends',
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
    { $skip: friendsAsReceiverOffset || 0 },
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
      $unwind: '$friends',
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

  const friends = [...friendsAsSender, ...friendsAsReceiver].map((friend) => friend._id !== user._id && friend);

  if (!Array.isArray(friends)) {
    throw new Error('Could not fetch friends.');
  }

  friends.forEach((friend) => {
    friend.profileGifHeaders = getFileSignedHeaders(friend.profileGifUrl);
  });

  return {
    friends,
    requests: receivedFriendRequests,
    friendsAsSenderOffset: friendsAsSender.length + friendsAsSenderOffset,
    friendsAsReceiverOffset: friendsAsReceiver.length + friendsAsSenderOffset,
  };
};

const getOtherUserFriends = async ({ userId, otherUserId, offset }) => {
  const otherUser = await User.findById(otherUserId);
  if (!otherUser) {
    throw new Error('User does not exist.');
  }

  const friendsAsSender = await Connections.aggregate([
    {
      $match: { requesterId: otherUser._id, accepted: true },
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
      $unwind: '$friends',
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
      $match: { receiverId: otherUser._id, accepted: true },
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
      $unwind: '$friends',
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

  const friends = [...friendsAsSender, ...friendsAsReceiver].map((friend) => friend._id !== otherUser._id && friend);
  // check if user is private and whether the current user is friends with the other user
  if (otherUser.private && userId !== otherUserId && friends.filter((friend) => friend._id.toString() === userId).length <= 0) {
    throw new Error('User is private and not in the current users friend list.');
  }

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
    { $limit: 10 },
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
    { $limit: 10 },
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
  if (userId === receiverId) {
    throw new Error('Cannot send a request to the same user.');
  }
  const receiver = await User.findById(receiverId);
  const user = await User.findById(userId);
  if (!receiver || !user) {
    throw new Error('User or receiver does not exist.');
  }

  if (receiver._id === user._id) {
    throw new Error('Cannot send a request to the same user.');
  }

  const requestAlreadySent = await Connections.findOne({
    requesterId: user._id,
    receiverId: receiver._id,
  });
  if (requestAlreadySent) {
    return requestAlreadySent;
  }

  const requestAlreadyReceived = await Connections.findOne({
    requesterId: receiver._id,
    receiverId: user._id,
  });
  if (requestAlreadyReceived) {
    return requestAlreadyReceived;
  }
  if (receiver.private) {
    const newRequest = await Connections.create({
      requesterId: user._id,
      receiverId: receiver._id,
      accepted: false,
    });

    return newRequest;
  }
  const newRequest = await Connections.create({
    requesterId: user._id,
    receiverId: receiver._id,
    accepted: true,
  });

  user.numberOfFriendsAsRequester += 1;
  receiver.numberOfFriendsAsReceiver += 1;

  await sendNotificationToSingleUser({ userId: receiver._id, title: `${user.firstName} would like to add you`, messageBody: `${user.firstName} would like to add you as a contact` });

  receiver.save();
  user.save();

  return newRequest;
};

const acceptFriendRequest = async (userId, requesterId) => {
  const requester = await User.findById(requesterId);
  const user = await User.findById(userId);

  if (!requester || !user) {
    throw new Error('User does not exist.');
  }

  const request = await Connections.findOne({
    requesterId: requester._id, receiverId: user._id, accepted: false,
  });

  if (!request) {
    throw new Error('Request does not exist.');
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

  const request = await Connections.findOneAndDelete({ requesterId: user._id, receiverId, accepted: false });

  if (!request) {
    throw new Error('Request does not exist.');
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
    receiverId: friend._id,
    accepted: true,
  });
  if (connectionAsRequester) {
    friend.numberOfFriendsAsReceiver -= 1;
    user.numberOfFriendsAsRequester -= 1;
    friend.save();
    user.save();
    return { deleted: true };
  }
  const connectionAsReceiver = await Connections.findOneAndDelete({
    receiverId: user._id,
    requesterId: friend._id,
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
  getOtherUserFriends,
  getUserFriendRequests,
  sendFriendRequest,
  recallFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeConnection,
};
