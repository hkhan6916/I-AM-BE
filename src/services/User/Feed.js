const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const PostLikes = require('../../models/user/PostLikes');
const Connections = require('../../models/user/Connections');
const User = require('../../models/user/User');
const { calculateAge } = require('../../helpers');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const getFileSignedUrl = require('../../helpers/getCloudfrontSignedUrl');

const sortByDate = (posts) => posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const aggregateFeed = async ({
  userId, feedTimelineOffset, friendsInterestsOffset,
  connectionsAsSenderOffset, connectionsAsReceiverOffset, user,
}) => {
  if (!user) {
    throw new Error('User could not be found.');
  }

  const connectionsAsSender = connectionsAsSenderOffset > user.numberOfFriendsAsRequester ? []
    : await Connections.find({
      requesterId: user._id,
      accepted: true,
    }, 'receiverId', { skip: connectionsAsSenderOffset, limit: 20 });

  const connectionsAsReceiver = connectionsAsReceiverOffset > user.numberOfFriendsAsReceiver || user.followersMode ? []
    : await Connections.find({
      receiverId: user._id,
      accepted: true,
    }, 'requesterId', { skip: connectionsAsReceiverOffset, limit: 20 });

  const connections = [
    ...connectionsAsReceiver.map((connection) => connection.requesterId),
    ...connectionsAsSender.map((connection) => connection.receiverId),
  ];

  if (!connections.length) return [];

  /**
   * Gets the feed based on what a user's friends have posted.
   *
   * 1. Gets all posts using userId by looping through connections/friends list.
   * 2. Gets any post using the repostPostId in case the post is a repost.
   * 3. Also gets the user as for the repost.
   * 4. Also gets the user for the current parent post.
   * 5. Goes through the current user's PostLikes record and checks if they've liked this parent
   *    post. returns true or false for the liked field
   */
  // const friendsPostsBasedFeed = [];
  const friendsPostsBasedFeed = await Posts.aggregate([
    {
      $match: {
        userId: { $in: connections },
        hidden: { $eq: false },
        ready: { $ne: false },
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: feedTimelineOffset || 0 },
    { $limit: 7 },
    {
      $lookup: { // get the post if it's a reposted post
        from: 'posts',
        let: { repostPostId: '$repostPostId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$repostPostId'],
              },
            },
          },
          {
            $lookup: { // get the author of the reposted post
              from: 'users',
              let: { id: '$userId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$terminated', false] }],
                      // $eq: ['$_id', '$$id'],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profileGifUrl: 1,
                    profileImageUrl: 1,
                    flipProfileVideo: 1,
                    firstName: 1,
                    lastName: 1,
                    jobTitle: 1,
                  },
                },
              ],
              as: 'postAuthor',
            },
          },
          {
            $addFields: {
              belongsToUser: {
                $cond: {
                  if: { $eq: ['$userId', ObjectId(userId)] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          { $unwind: { path: '$postAuthor', preserveNullAndEmptyArrays: true } },
        ],
        as: 'repostPostObj',
      },
    }, {
      $lookup: { // get the author of the main post, not the reposted post
        from: 'users',
        let: { id: '$userId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$terminated', false] }],
                // $eq: ['$_id', '$$id']
              },
            },
          },
          {
            $project: {
              profileGifUrl: 1,
              profileImageUrl: 1,
              username: 1,
              firstName: 1,
              lastName: 1,
              flipProfileVideo: 1,
              jobTitle: 1,
            },
          },
        ],
        as: 'postAuthor',
      },
    },
    {
      $lookup: { // check if the user has liked the post already
        from: 'postlikes',
        let: { likedBy: ObjectId(userId), postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$likedBy', '$$likedBy'] }, { $eq: ['$postId', '$$postId'] }] } } },
          { $limit: 1 },
          {
            $project: {
              _id: 1,
              likedBy: 1,
              postId: 1,
            },
          },
        ],
        as: 'liked',
      },
    },
    { $unwind: { path: '$postAuthor', preserveNullAndEmptyArrays: true } },
    {
      $unwind:
       {
         path: '$liked',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $unwind:
       {
         path: '$repostPostObj',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $project: {
        _id: 1,
        body: 1,
        mediaUrl: 1,
        thumbnailUrl: 1,
        mediaKey: 1,
        gif: 1,
        generatedImageUrl: 1,
        gifPreview: 1,
        mediaMimeType: 1,
        mediaType: 1,
        mediaIsSelfie: 1,
        repostPostId: 1,
        repostPostObj: 1,
        userId: 1,
        likes: 1,
        private: 1,
        postAuthor: 1,
        edited: 1,
        createdAt: 1,
        height: 1,
        width: 1,
        numberOfComments: 1,
        belongsToUser: {
          $cond: {
            if: { $eq: ['$userId', ObjectId(userId)] },
            then: true,
            else: false,
          },
        },
        liked: {
          $cond: {
            if: { $ne: [{ $type: '$liked' }, 'missing'] },
            then: true,
            else: false,
          },
        },
      },
    },
  ]);

  /* This is to get the ids of all the friendsPostsBasedFeed posts
  so we don't get the same posts again in below aggregation. */
  const alreadyFetchedPostIds = friendsPostsBasedFeed.map((post) => post._id.toString());

  /**
   * Gets the feed based on what a user's friends have liked.
   *
   * 1. Goes through the PostLikes records for all the friends of a user
   * 2. Using the friend's PostLikes records, it gets all posts the friends have liked
   * 3. Gets any child posts incase the posts are reposts of existing posts.
   * 4. Gets the postAuthor for the child posts.
   * 5. Gets data about the friend who liked the parent post.
   * 6. Checks if the user has liked the post already.
   * 7. Gets the postAuthor for this parent post
   *
   */
  const friendsInterestsBasedFeed = await PostLikes.aggregate([
    {
      $match: {
        likedBy: { $in: connections }, // search for users friends post lkes
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: friendsInterestsOffset || 0 },
    { $limit: 7 },
    {
      $lookup: { // get the posts for each like
        from: 'posts',
        let: { likedBy: '$likedBy', postId: '$postId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $cond: { // return null if already fetched in the above timeline feed or the post belongs to same user or the post is hidden due to reports, or the post is not ready since media needs uploading
                  if: {
                    $or: [{
                      $in: [
                        { $toString: '$_id' }, alreadyFetchedPostIds],
                    },
                    { $ne: ['$hidden', false] }, { $ne: ['$ready', true] },
                    { $eq: ['$userId', ObjectId(userId)] }],
                  },
                  then: null,
                  else: { $eq: ['$_id', '$$postId'] },
                },
              },
            },
          },
          {
            $lookup: { // get the reposted post if reposted
              from: 'posts',
              let: { id: '$repostPostId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $cond: {
                        if: { $eq: ['$userId', ObjectId(userId)] },
                        then: null,
                        else: { $eq: ['$_id', '$$id'] },
                      },
                    },
                  },
                },
                {
                  $lookup: { // get the author of the reposted post
                    from: 'users',
                    let: { id: '$userId' },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$terminated', false] }],
                          },
                        },
                      },
                      {
                        $project: {
                          _id: 1,
                          username: 1,
                          profileGifUrl: 1,
                          profileImageUrl: 1,
                          flipProfileVideo: 1,
                          firstName: 1,
                          lastName: 1,
                          jobTitle: 1,
                        },
                      },
                    ],
                    as: 'postAuthor',
                  },
                },
                {
                  $addFields: {
                    belongsToUser: {
                      $cond: {
                        if: { $eq: ['$userId', ObjectId(userId)] },
                        then: true,
                        else: false,
                      },
                    },
                  },
                },
                { $unwind: { path: '$postAuthor', preserveNullAndEmptyArrays: true } },
              ],
              as: 'repostPostObj',
            },
          },
          {
            $lookup: { // get the friend who liked the post in the first place
              from: 'users',
              let: { friendToFind: '$$likedBy' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $cond: {
                        if: { $not: { $in: [{ $toString: '$_id' }, alreadyFetchedPostIds] } },
                        then: {
                          $and: [{ $eq: ['$_id', '$$friendToFind'] }, { $eq: ['$terminated', false] }],
                        },
                        else: {},
                      },
                    },
                  },
                },
                {
                  $project: {
                    username: 1,
                    firstName: 1,
                    lastName: 1,
                    profileGifUrl: 1,
                    profileImageUrl: 1,
                    flipProfileVideo: 1,
                  },
                },
              ],
              as: 'likedBy',
            },
          },
          {
            $lookup: { // check if current user has already liked the post
              from: 'postlikes',
              let: { likedBy: ObjectId(userId) },
              pipeline: [
                { $match: { $expr: { $and: [{ $eq: ['$likedBy', '$$likedBy'] }, { $eq: ['$postId', '$$postId'] }] } } },
                { $limit: 1 },
                {
                  $project: {
                    _id: 1,
                    likedBy: 1,
                    postId: 1,
                  },
                },
              ],
              as: 'liked',
            },
          },
          { // get the author of the main post, not the reposted post
            $lookup: {
              from: 'users',
              let: { id: '$userId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$terminated', false] }],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profileGifUrl: 1,
                    profileImageUrl: 1,
                    flipProfileVideo: 1,
                    firstName: 1,
                    lastName: 1,
                    jobTitle: 1,
                  },
                },
              ],
              as: 'postAuthor',
            },
          },
          {
            $unwind:
             {
               path: '$postAuthor',
               preserveNullAndEmptyArrays: true,
             },
          },
          {
            $unwind:
             {
               path: '$liked',
               preserveNullAndEmptyArrays: true,
             },
          },
          {
            $unwind:
             {
               path: '$likedBy',
               preserveNullAndEmptyArrays: true,
             },
          },
          {
            $unwind:
             {
               path: '$repostPostObj',
               preserveNullAndEmptyArrays: true,
             },
          },
        ],
        as: 'friendsInterestsBasedPost',
      },
    },
    {
      $unwind:
       {
         path: '$friendsInterestsBasedPost',
         preserveNullAndEmptyArrays: false,
       },
    },
    {
      $replaceRoot: {
        newRoot: {
          $cond: {
            if: { $ne: [{ $type: '$friendsInterestsBasedPost' }, 'missing'] },
            then: '$friendsInterestsBasedPost',
            else: {},
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        body: 1,
        mediaUrl: 1,
        thumbnailUrl: 1,
        gif: 1,
        generatedImageUrl: 1,
        gifPreview: 1,
        mediaMimeType: 1,
        mediaType: 1,
        mediaIsSelfie: 1,
        repostPostId: 1,
        repostPostObj: 1,
        mediaKey: 1,
        userId: 1,
        likes: 1,
        private: 1,
        postAuthor: 1,
        edited: 1,
        createdAt: 1,
        likedBy: 1,
        height: 1,
        width: 1,
        numberOfComments: 1,
        belongsToUser: {
          $cond: {
            if: { $eq: ['$userId', ObjectId(userId)] },
            then: true,
            else: false,
          },
        },
        liked: {
          $cond: {
            if: { $ne: [{ $type: '$liked' }, 'missing'] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $redact: {
        $cond: {
          if: { $eq: ['$liked', null] },
          then: '$$PRUNE',
          else: '$$DESCEND',
        },
      },
    },
  ]);

  const initialFeed = [
    ...friendsPostsBasedFeed,
    ...friendsInterestsBasedFeed,
  ];

  const sortedFeed = sortByDate(initialFeed);

  const nonDuplicatePostIds = [];
  const feed = sortedFeed.reduce((prevFeed, currentPost) => {
    if (currentPost && !nonDuplicatePostIds.includes(currentPost._id.toString())) {
      nonDuplicatePostIds.push(currentPost._id.toString());
      calculateAge(currentPost);
      if (currentPost.repostPostObj) {
        calculateAge(currentPost.repostPostObj);
      }

      if (currentPost.repostPostObj?.mediaUrl) {
        if (currentPost.repostPostObj.mediaType === 'video') {
          currentPost.repostPostObj.mediaUrl = getFileSignedUrl(currentPost.repostPostObj.mediaKey);
          currentPost.repostPostObj.thumbnailHeaders = getFileSignedHeaders(currentPost.repostPostObj.thumbnailUrl);
        } else {
          const headers = getFileSignedHeaders(currentPost.repostPostObj.mediaUrl);
          currentPost.repostPostObj.mediaHeaders = headers;
        }
      }
      if (currentPost.repostPostObj?.postAuthor) {
        currentPost.repostPostObj.postAuthor.profileGifHeaders = getFileSignedHeaders(currentPost.repostPostObj.postAuthor.profileGifUrl);
        currentPost.repostPostObj.postAuthor.profileImageHeaders = getFileSignedHeaders(currentPost.repostPostObj.postAuthor.profileImageUrl);
      }
      if (currentPost.postAuthor?.profileGifUrl) {
        currentPost.postAuthor.profileGifHeaders = getFileSignedHeaders(currentPost.postAuthor.profileGifUrl);
      }
      if (currentPost.postAuthor?.profileImageUrl) {
        currentPost.postAuthor.profileImageHeaders = getFileSignedHeaders(currentPost.postAuthor.profileImageUrl);
      }
      if (currentPost.mediaUrl) {
        if (currentPost.mediaType === 'video') {
          currentPost.thumbnailHeaders = getFileSignedHeaders(currentPost.thumbnailUrl);
          currentPost.mediaUrl = getFileSignedUrl(currentPost.mediaKey);
        } else {
          const headers = getFileSignedHeaders(currentPost.mediaUrl);
          currentPost.mediaHeaders = headers;
        }
      }
      prevFeed.push(currentPost);
    }
    return prevFeed;
  }, []);

  return { feed, connectionsAsSenderOffset, connectionsAsReceiverOffset };
};

const getUserFeed = async ({
  userId, feedTimelineOffset, friendsInterestsOffset,
  connectionsAsSenderOffset, connectionsAsReceiverOffset,
}) => {
  let currentConnectionsAsSenderOffset = connectionsAsSenderOffset || 0;
  let currentConnectionsAsReceiverOffset = connectionsAsReceiverOffset || 0;
  const user = await User.findById(userId);

  if (!user.profileImageUrl && !user.profileVideoUrl) {
    throw new Error('User profile is not complete.');
  }
  let aggregateResult = await aggregateFeed({
    userId,
    feedTimelineOffset,
    friendsInterestsOffset,
    connectionsAsSenderOffset,
    connectionsAsReceiverOffset,
    user,
  });

  // while - no feed from above aggregation call and connections offsets are less than 200 and less than number of connections user has
  while (!aggregateResult.feed?.length && ((currentConnectionsAsSenderOffset < 200 && currentConnectionsAsSenderOffset < user.numberOfFriendsAsRequester) || (currentConnectionsAsReceiverOffset < 200 && currentConnectionsAsReceiverOffset < user.numberOfFriendsAsReceiver))) {
    aggregateResult = await aggregateFeed({
      userId,
      feedTimelineOffset,
      friendsInterestsOffset,
      connectionsAsSenderOffset: currentConnectionsAsSenderOffset,
      connectionsAsReceiverOffset: currentConnectionsAsReceiverOffset,
      user,
    });
    if (aggregateResult.feed?.length) {
      break;
    }

    currentConnectionsAsSenderOffset += 20;
    currentConnectionsAsReceiverOffset += 20;
  }
  return aggregateResult.feed?.length && aggregateResult.feed[0]?._id ? {
    feed: aggregateResult.feed,
    connectionsAsSenderOffset,
    connectionsAsReceiverOffset,
  } : { feed: [] };
};
module.exports = {
  getUserFeed,
};
