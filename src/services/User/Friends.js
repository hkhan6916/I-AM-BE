const { ObjectId } = require('mongoose').Types;
const User = require('../../models/user/User');
const Connections = require('../../models/user/Connections');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');
const { sendNotificationToSingleUser } = require('../Notifications/Notifications');
const BlockedUsers = require('../../models/user/BlockedUsers');

const searchUser = async ({
  username, publicUsers, avoidSameUser, userId, offset,
}) => {
  const searchQuery = username.toLowerCase();
  if (!searchQuery) return [];
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

  // create array of user ids from above result of users found
  // get users contacts where receiver or requestor id in list of ids created
  // Check if user is in contact list and return even if private

  const userIds = result.map((user) => (user?._id));

  const userContactsIds = (await Connections.aggregate([
    {
      $match: {
        $expr: {
          $or: [{
            $and: [
              {
                $in: ['$receiverId', userIds],
              },
              {
                $eq: ['$requesterId', ObjectId(userId)],
              },
            ],
          }, {
            $and: [
              {
                $eq: ['$receiverId', ObjectId(userId)],
              },
              {
                $in: ['$requesterId', userIds],
              },
            ],
          }],
        },
      },
    },
    { $limit: 10 },
  ])).map((connection) => (connection.receiverId.toString() === userId ? connection.requesterId?.toString() : connection.receiverId?.toString()));
  const users = result.reduce((usersToReturn, user) => {
    if (user.profileVideoUrl && (!publicUsers || !user.private || (userContactsIds.find((id) => id === user._id.toString())))
    && (!avoidSameUser
      || userId !== user._id?.toString())
    ) {
      usersToReturn.push({
        ...user,
        profileGifHeaders: getFileSignedHeaders(user.profileGifUrl),
      });
    }
    return usersToReturn;
  }, []);

  return users;
};

const searchUserContacts = async (username, userId, offset) => {
  const searchQuery = username.toLowerCase();
  if (!searchQuery) return { users: [], nextOffset: (offset || 0) + 20 };

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
    {
      $lookup: {
        from: 'connections',
        let: { searchedUserId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  {
                    $and: [{
                      $eq: ['$requesterId', ObjectId(userId)],
                    },
                    {
                      $eq: ['$receiverId', '$$searchedUserId'],
                    },
                    {
                      $eq: ['$accepted', true],
                    },
                    ],
                  },
                  {
                    $and: [{
                      $eq: ['$requesterId', '$$searchedUserId'],
                    },
                    {
                      $eq: ['$receiverId', ObjectId(userId)],
                    }, {
                      $eq: ['$accepted', true],
                    }],
                  },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'connected',
      },
    },
    {
      $unwind:
       {
         path: '$connected',
         preserveNullAndEmptyArrays: true,
       },
    },
    { $skip: offset || 0 },
    { $limit: 20 },
  ]);
  // have to do this as no way to check if user is added as contacts in the search pipeline
  const users = result.reduce((usersToReturn, user) => {
    if (user.profileVideoUrl && user.connected) {
      usersToReturn.push({
        ...user,
        profileGifHeaders: getFileSignedHeaders(user.profileGifUrl),
      });
    }
    return usersToReturn;
  }, []);

  return { users, nextOffset: (offset || 0) + 20 };
};

const getSingleUser = async (otherUserId, userId) => {
  const otherUserRecord = (await User.aggregate([{
    $match: {
      _id: ObjectId(otherUserId),
    },
  },
  {
    $lookup: {
      from: 'blocked_users',
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: ['$userId', ObjectId(userId)],
                },
                {
                  $eq: ['$blockedUserId', ObjectId(otherUserId)],
                },
              ],
            },
          },
        },
        { $limit: 1 },
      ],
      as: 'blockedByUser',
    },
  },
  {
    $lookup: {
      from: 'blocked_users',
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: ['$blockedUserId', ObjectId(userId)],
                },
                {
                  $eq: ['$userId', ObjectId(otherUserId)],
                },
              ],
            },
          },
        },
        { $limit: 1 },
      ],
      as: 'blockedByThem',
    },
  },
  {
    $unwind:
     {
       path: '$blockedByUser',
       preserveNullAndEmptyArrays: true,
     },
  },
  {
    $unwind:
     {
       path: '$blockedByThem',
       preserveNullAndEmptyArrays: true,
     },
  },
  {
    $project: {
      _id: 1,
      username: 1,
      email: 1,
      profileGifUrl: 1,
      profileVideoUrl: 1,
      firstName: 1,
      lastName: 1,
      jobTitle: 1,
      flipProfileVideo: 1,
      followersMode: 1,
      numberOfFriendsAsRequester: 1,
      numberOfFriendsAsReceiver: 1,
      private: 1,
      blockedByUser: {
        $cond: {
          if: { $eq: [{ $type: '$blockedByUser' }, 'missing'] },
          then: false,
          else: true,
        },
      },
      blockedByThem: {
        $cond: {
          if: { $eq: [{ $type: '$blockedByThem' }, 'missing'] },
          then: false,
          else: true,
        },
      },
    },
  }]))[0];
  const user = await User.findById(userId);
  if (!user) throw new Error('User does not exist');

  if (!otherUserRecord) throw new Error('Other user does not exist');

  const requestSent = await Connections.findOne({
    requesterId: user._id,
    receiverId: otherUserRecord._id,
  });

  const requestReceived = await Connections.findOne({
    requesterId: otherUserRecord._id,
    receiverId: user._id,
  });

  const profileVideoKey = otherUserRecord.profileVideoUrl.substring(otherUserRecord.profileVideoUrl.lastIndexOf('profileVideos'));
  const otherUserObj = otherUserRecord;
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

  const receivedFriendRequests = (await Connections.aggregate([
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
    {
      $lookup: {
        from: 'blocked_users',
        let: { requesterId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ['$userId', ObjectId(userId)],
                  },
                  {
                    $eq: ['$blockedUserId', '$$requesterId'],
                  },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'blockedByUser',
      },
    },
    {
      $unwind:
       {
         path: '$blockedByUser',
         preserveNullAndEmptyArrays: true,
       },
    },
    { $addFields: { accepted: false } },
    {
      $project: {
        _id: 1,
        username: 1,
        email: 1,
        password: 1,
        profileGifUrl: 1,
        firstName: 1,
        lastName: 1,
        jobTitle: 1,
        flipProfileVideo: 1,
        blockedByUser: {
          $cond: {
            if: { $eq: [{ $type: '$blockedByUser' }, 'missing'] },
            then: false,
            else: true,
          },
        },
      },
    },
  ])).filter((request) => !request.blockedByUser);

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
        flipProfileVideo: 1,
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
        flipProfileVideo: 1,
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
        flipProfileVideo: 1,
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
        flipProfileVideo: 1,
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

const getUserFriendRequests = async (userId, sentOffset, receivedOffset) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('No user found.');
  }

  const receivedRecords = (await Connections.aggregate([
    {
      $match: {
        receiverId: ObjectId(userId),
        accepted: false,
      },
    },
    { $limit: 10 },
    { $skip: Number(receivedOffset) },
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
    {
      $lookup: {
        from: 'blocked_users',
        let: { requesterId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ['$userId', ObjectId(userId)],
                  },
                  {
                    $eq: ['$blockedUserId', '$$requesterId'],
                  },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'blockedByUser',
      },
    },
    {
      $unwind:
       {
         path: '$blockedByUser',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $project: {
        _id: 1,
        username: 1,
        email: 1,
        password: 1,
        profileGifUrl: 1,
        firstName: 1,
        lastName: 1,
        jobTitle: 1,
        flipProfileVideo: 1,
        blockedByUser: {
          $cond: {
            if: { $eq: [{ $type: '$blockedByUser' }, 'missing'] },
            then: false,
            else: true,
          },
        },
      },
    },
  ])).filter((request) => !request.blockedByUser);

  const sentRecords = await Connections.aggregate([
    {
      $match: {
        requesterId: ObjectId(userId),
        accepted: false,
      },
    },
    { $limit: 10 },
    { $skip: Number(sentOffset) },
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

/*  NOTE: Could use mongodb .collection(query).count() to correct user contact count if needed e.g.
  const count = await Connections.find({
    requesterId: userId,
  }).count();
*/

const sendFriendRequest = async (userId, receiverId) => {
  if (userId === receiverId) {
    throw new Error('Cannot send a request to the same user.');
  }
  const receiver = await User.findById(receiverId);
  const user = await User.findById(userId);
  if (!receiver || !user) {
    throw new Error('User or receiver does not exist.');
  }
  if (!user.profileVideoUrl) {
    throw new Error('User profile is not complete');
  }
  if (!receiver.profileVideoUrl) {
    throw new Error('Receiver profile is not complete');
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

  user.numberOfFriendsAsRequester += 1;
  receiver.numberOfFriendsAsReceiver += 1;

  const receiverIsBlocked = await BlockedUsers.findOne({ blockedUserId: receiverId, userId });

  const userIsBlocked = await BlockedUsers.findOne({ blockedUserId: userId, userId: receiverId });

  if (userIsBlocked || receiverIsBlocked) {
    const newRequest = await Connections.create({
      requesterId: user._id,
      receiverId: receiver._id,
      accepted: false,
    });

    return newRequest;
  }

  if (receiver.private) {
    const newRequest = await Connections.create({
      requesterId: user._id,
      receiverId: receiver._id,
      accepted: false,
    });

    await sendNotificationToSingleUser({ userId: receiver._id, title: `${user.firstName} would like to add you`, messageBody: `${user.firstName} would like to add you as a contact` });

    return newRequest;
  }
  const newRequest = await Connections.create({
    requesterId: user._id,
    receiverId: receiver._id,
    accepted: true,
  });

  // if (receiver.private) {
  // }

  receiver.save();
  user.save();

  return newRequest;
};

// NOTE: Could use mongodb .collection(query).count() to correct user contact count if needed example above sendfriendrequest
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

  const requesterIsBlocked = await BlockedUsers.findOne({ blockedUserId: requesterId, userId });
  if (requesterIsBlocked) throw new Error('Requester is blocked');
  const userIsBlocked = await BlockedUsers.findOne({ blockedUserId: userId, userId: requesterId });
  if (userIsBlocked) throw new Error('User is blocked');

  request.accepted = true;
  requester.numberOfFriendsAsRequester += 1;
  user.numberOfFriendsAsReceiver += 1;
  requester.save();
  user.save();
  request.save();

  return requester;
};

// NOTE: Could use mongodb .collection(query).count() to correct user contact count if needed example above sendfriendrequest
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

// NOTE: Could use mongodb .collection(query).count() to correct user contact count if needed example above sendfriendrequest
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

// NOTE: Could use mongodb .collection(query).count() to correct user contact count if needed example above sendfriendrequest
const removeConnection = async (userId, friendId, skipNotFoundError) => {
  const friend = await User.findById(friendId);
  const user = await User.findById(userId);

  if (!friend || !user) {
    throw new Error('User does not exist.');
  }

  const accepted = skipNotFoundError ? {} : { accepted: true };

  const connectionAsRequester = await Connections.findOneAndDelete({
    requesterId: user._id,
    receiverId: friend._id,
    ...accepted,
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
    ...accepted,
  });

  if (!connectionAsReceiver && !skipNotFoundError) {
    throw new Error('User connection does not exist.');
  }

  if (connectionAsReceiver) {
    friend.numberOfFriendsAsRequester -= 1;
    user.numberOfFriendsAsReceiver -= 1;
  }
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
  searchUserContacts,
};
