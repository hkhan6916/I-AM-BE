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
  connectionsAsSenderOffset, connectionsAsReceiverOffset,
}) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User could not be found.');
  }

  const connectionsAsSender = connectionsAsSenderOffset > user.numberOfFriendsAsRequester ? []
    : await Connections.find({
      requesterId: user._id,
      accepted: true,
    }, 'receiverId', { skip: connectionsAsSenderOffset, limit: 20 });

  const connectionsAsReceiver = connectionsAsReceiverOffset > user.numberOfFriendsAsReceiver ? []
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
        hidden: { $ne: true },
        ready: { $ne: false },
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: feedTimelineOffset || 0 },
    { $limit: 5 },
    {
      $lookup: { // get the post if it's a reposted post
        from: 'posts',
        let: { id: '$repostPostId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$id'],
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
                    firstName: 1,
                    lastName: 1,
                  },
                },
              ],
              as: 'postAuthor',
            },
          },
          {
            $unwind: '$postAuthor',
          },
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
              profileGifUrl: 1, username: 1, firstName: 1, lastName: 1,
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
            },
          },
        ],
        as: 'liked',
      },
    },
    { $unwind: '$postAuthor' },
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
        mediaMimeType: 1,
        mediaType: 1,
        mediaOrientation: 1,
        mediaIsSelfie: 1,
        repostPostId: 1,
        repostPostObj: 1,
        userId: 1,
        likes: 1,
        private: 1,
        postAuthor: 1,
        createdAt: 1,
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
  so we don't get the same posts again in below aggregation */
  const ids = [];
  friendsPostsBasedFeed.forEach((post) => {
    ids.push(post._id.toString());
  });

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
                        { $toString: '$_id' }, ids],
                    },
                    { $eq: ['$hidden', true] }, { $eq: ['$ready', false] },
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
                            // $eq: ['$_id', '$$id'],
                          },
                        },
                      },
                      {
                        $project: {
                          _id: 1,
                          username: 1,
                          profileGifUrl: 1,
                          firstName: 1,
                          lastName: 1,
                        },
                      },
                    ],
                    as: 'postAuthor',
                  },
                },
                {
                  $unwind: '$postAuthor',
                },
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
                        if: { $not: { $in: [{ $toString: '$_id' }, ids] } },
                        then: {
                          //  $eq: ['$_id', '$$friendToFind']
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
                { $match: { $expr: { $eq: ['$likedBy', '$$likedBy'] } } },
                { $limit: 1 },
                {
                  $project: {
                    _id: 1,
                    likedBy: 1,
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
                      // $eq: ['$_id', '$$id'],
                      $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$terminated', false] }],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profileGifUrl: 1,
                    firstName: 1,
                    lastName: 1,
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
          { $skip: friendsInterestsOffset || 0 },
          { $limit: 5 },
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
        mediaMimeType: 1,
        mediaType: 1,
        mediaOrientation: 1,
        mediaIsSelfie: 1,
        repostPostId: 1,
        repostPostObj: 1,
        mediaKey: 1,
        userId: 1,
        likes: 1,
        private: 1,
        postAuthor: 1,
        createdAt: 1,
        likedBy: 1,
        belongsToUser: {
          $cond: {
            if: { $eq: ['$userId', userId] },
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

  const feed = sortByDate(initialFeed);

  feed.forEach(async (post) => {
    if (post) {
      if (post.repostPostObj?.mediaUrl) {
        if (post.repostPostObj.mediaType === 'video') {
          post.repostPostObj.mediaUrl = getFileSignedUrl(post.repostPostObj.mediaKey);
          post.repostPostObj.thumbnailHeaders = getFileSignedHeaders(post.repostPostObj.thumbnailUrl);
        } else {
          const headers = getFileSignedHeaders(post.repostPostObj.mediaUrl);
          post.repostPostObj.mediaHeaders = headers;
        }
      }
      if (post.repostPostObj?.postAuthor) {
        const headers = getFileSignedHeaders(post.repostPostObj.postAuthor.profileGifUrl);
        post.repostPostObj.postAuthor.profileGifHeaders = headers;
      }
      if (post.postAuthor?.profileGifUrl) {
        const headers = getFileSignedHeaders(post.postAuthor.profileGifUrl);
        post.postAuthor.profileGifHeaders = headers;
      }
      if (post.mediaUrl) {
        if (post.mediaType === 'video') {
          post.thumbnailHeaders = getFileSignedHeaders(post.thumbnailUrl);
          post.mediaUrl = getFileSignedUrl(post.mediaKey);
        } else {
          const headers = getFileSignedHeaders(post.mediaUrl);
          post.mediaHeaders = headers;
        }
      }
    }
  });

  if (feed.length) {
    feed.forEach((post) => {
      calculateAge(post);
    });
  }
  return { feed, connectionsAsSenderOffset, connectionsAsReceiverOffset };
};

const getUserFeed = async ({
  userId, feedTimelineOffset, friendsInterestsOffset,
  connectionsAsSenderOffset, connectionsAsReceiverOffset,
}) => {
  const feed = await aggregateFeed({
    userId,
    feedTimelineOffset,
    friendsInterestsOffset,
    connectionsAsSenderOffset,
    connectionsAsReceiverOffset,
  });
  if (!feed.feed?.length) {
    const newFeed = await aggregateFeed({
      userId,
      feedTimelineOffset: 0,
      friendsInterestsOffset: 0,
      connectionsAsSenderOffset: connectionsAsSenderOffset + 20,
      connectionsAsReceiverOffset: connectionsAsReceiverOffset + 20,
    });

    return newFeed.feed?.length && newFeed.feed[0]?._id ? {
      feed: newFeed.feed,
      connectionsAsSenderOffset: connectionsAsSenderOffset + 20,
      connectionsAsReceiverOffset: connectionsAsReceiverOffset + 20,
    } : { feed: [] };
  }
  return feed.feed?.length && feed.feed[0]?._id ? {
    feed: feed.feed,
    connectionsAsSenderOffset,
    connectionsAsReceiverOffset,
  } : { feed: [] };
};
module.exports = {
  getUserFeed,
};
