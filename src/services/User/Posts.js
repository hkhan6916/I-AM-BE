const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const Connections = require('../../models/user/Connections');
const User = require('../../models/user/User');
const { calculateAge } = require('../../helpers');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');

const getUserPosts = async (userId, offset) => {
  const posts = await Posts.aggregate([
    {
      $match: {
        $expr: { $eq: ['$userId', ObjectId(userId)] },
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: offset || 0 },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'postAuthor',
      },
    },
    {
      $lookup: {
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
                    flipProfileVideo: 1,
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
    { $unwind: { path: '$postAuthor', preserveNullAndEmptyArrays: true } },
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
        mediaMimeType: 1,
        mediaType: 1,
        mediaKey: 1,
        gif: 1,
        mediaIsSelfie: 1,
        repostPostId: 1,
        repostPostObj: 1,
        userId: 1,
        likes: 1,
        private: 1,
        postAuthor: 1,
        edited: 1,
        ready: 1,
        cancelled: 1,
        createdAt: 1,
        height: 1,
        width: 1,
        liked: {
          $cond: {
            if: { $ne: [{ $type: '$liked' }, 'missing'] },
            then: true,
            else: false,
          },
        },
        belongsToUser: {
          $cond: {
            if: { $eq: ['$userId', ObjectId(userId)] },
            then: true,
            else: false,
          },
        },
      },
    },
  ]);
  if (!Array.isArray(posts)) {
    throw new Error('Could not fetch posts');
  }

  if (!posts.length) {
    throw new Error('No posts found');
  }
  posts.forEach(async (post) => {
    post.belongsToUser = true;
    if (post.mediaType === 'video') {
      post.mediaUrl = getCloudfrontSignedUrl(post.mediaKey);
      post.thumbnailHeaders = getFileSignedHeaders(post.thumbnailUrl);
    } else {
      const headers = getFileSignedHeaders(post.mediaUrl);
      post.mediaHeaders = headers;
    }
    if (post.repostPostObj) {
      calculateAge(post.repostPostObj);

      if (post.repostPostObj.mediaType === 'video') {
        post.repostPostObj.mediaUrl = getCloudfrontSignedUrl(post.repostPostObj.mediaKey);
        post.repostPostObj.thumbnailHeaders = getFileSignedHeaders(post.repostPostObj.thumbnailUrl);
      } else {
        const headers = getFileSignedHeaders(post.repostPostObj?.mediaUrl);
        post.repostPostObj.mediaHeaders = headers;
      }
      if (post.repostPostObj.postAuthor) {
        const headers = getFileSignedHeaders(post.repostPostObj.postAuthor.profileGifUrl);
        post.repostPostObj.postAuthor.profileGifHeaders = headers;
      }
    }

    if (post.postAuthor?.profileGifUrl) {
      const headers = getFileSignedHeaders(post.postAuthor.profileGifUrl);
      post.postAuthor.profileGifHeaders = headers;
    }
    calculateAge(post);
  });

  return posts;
};

const getOtherUserPosts = async (userId, offset, authUserId) => {
  const belongsToUser = userId === authUserId;
  const otherUser = await User.findById(userId);
  if (otherUser.terminated) {
    throw new Error('This user does not exist.');
  }
  if (!otherUser) {
    throw new Error('User does not exist.');
  }

  if (otherUser.private && !belongsToUser) {
    const isConnectedAsSender = await Connections.findOne({
      requesterId: ObjectId(userId), receiverId: ObjectId(authUserId),
    });
    const isConnectedAsReceiver = await Connections.findOne({
      requesterId: ObjectId(authUserId), receiverId: ObjectId(userId),
    });

    if (!isConnectedAsSender && !isConnectedAsReceiver) {
      throw new Error('User is private and not a contact.');
    }
  }

  const posts = await Posts.aggregate([
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ['$userId', ObjectId(userId)] },
            { $ne: ['$hidden', true] },
            { $ne: ['$ready', false] },
          ],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: offset || 0 },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'postAuthor',
      },
    },
    {
      $lookup: {
        from: 'posts',
        let: { id: '$repostPostId' },
        pipeline: [
          {
            $match: {
              $expr: {
                // $eq: ['$_id', '$$id'],
                $cond: { // return null if already fetched in the above timeline feed or the post belongs to same user or the post is hidden due to reports, or the post is not ready since media needs uploading
                  if: {
                    $or: [
                      { $eq: ['$hidden', true] },
                      { $eq: ['$ready', false] },
                    ],
                  },
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
                    flipProfileVideo: 1,
                    belongsToUser: {
                      $cond: {
                        if: { $eq: ['$userId', ObjectId(userId)] },
                        then: true,
                        else: false,
                      },
                    },
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
    { $unwind: { path: '$postAuthor', preserveNullAndEmptyArrays: true } },
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
        mediaMimeType: 1,
        mediaType: 1,
        mediaKey: 1,
        gif: 1,
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
  if (!Array.isArray(posts)) {
    throw new Error('Could not fetch posts');
  }

  if (!posts.length) {
    throw new Error('No posts found');
  }
  posts.forEach(async (post) => {
    post.belongsToUser = belongsToUser;
    if (post.mediaType === 'video') {
      post.mediaUrl = getCloudfrontSignedUrl(post.mediaKey);
      post.thumbnailHeaders = getFileSignedHeaders(post.thumbnailUrl);
    } else {
      const headers = getFileSignedHeaders(post.mediaUrl);
      post.mediaHeaders = headers;
    }
    if (post.repostPostObj) {
      calculateAge(post.repostPostObj);

      if (post.repostPostObj.mediaType === 'video') {
        post.repostPostObj.mediaUrl = getCloudfrontSignedUrl(post.repostPostObj.mediaKey);
        post.repostPostObj.thumbnailHeaders = getFileSignedHeaders(post.repostPostObj.thumbnailUrl);
      } else {
        const headers = getFileSignedHeaders(post.repostPostObj?.mediaUrl);
        post.repostPostObj.mediaHeaders = headers;
      }
      if (post.repostPostObj.postAuthor) {
        const headers = getFileSignedHeaders(post.repostPostObj.postAuthor.profileGifUrl);
        post.repostPostObj.postAuthor.profileGifHeaders = headers;
      }
    }

    if (post.postAuthor?.profileGifUrl) {
      const headers = getFileSignedHeaders(post.postAuthor.profileGifUrl);
      post.postAuthor.profileGifHeaders = headers;
    }
    calculateAge(post);
  });

  return posts;
};

const getUserSearchFeed = async (offset = 0, userId) => {
  const posts = await Posts.aggregate([
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ['$ready', true] },
            { $ne: ['$userId', ObjectId(userId)] },
            { $ne: ['$mediaKey', ''] },
            { $or: [{ $eq: [{ $type: '$gif' }, 'missing'] }, { $eq: ['$gif', ''] }] },
          ],
        },
      },
    },
    { $sort: { likes: -1 } },
    {
      $lookup: {
        from: 'users',
        let: { userId: '$userId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$userId'],
              },
            },
          },
          {
            $project: {
              _id: 1,
              username: 1,
              profileGifUrl: 1,
              flipProfileVideo: 1,
              firstName: 1,
              lastName: 1,
            },
          },
        ],
        as: 'postAuthor',
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
        mediaKey: 1,
        gif: 1,
        mediaIsSelfie: 1,
        repostPostId: 1,
        repostPostObj: 1,
        userId: 1,
        likes: 1,
        private: 1,
        postAuthor: 1,
        createdAt: 1,
        height: 1,
        width: 1,
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
    { $skip: offset },
    { $limit: 20 },
  ]);

  posts.forEach((post) => {
    if (post.mediaType === 'video') {
      post.mediaUrl = getCloudfrontSignedUrl(post.mediaKey);
      post.thumbnailHeaders = getFileSignedHeaders(post.thumbnailUrl);
    } else {
      const headers = getFileSignedHeaders(post.mediaUrl);
      post.mediaHeaders = headers;
    }

    if (post.postAuthor?.profileGifUrl) {
      const headers = getFileSignedHeaders(post.postAuthor.profileGifUrl);
      post.postAuthor.profileGifHeaders = headers;
    }
    calculateAge(post);
  });
  return posts;
};

module.exports = {
  getUserPosts,
  getOtherUserPosts,
  getUserSearchFeed,
};
