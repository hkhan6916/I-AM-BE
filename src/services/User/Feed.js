const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const User = require('../../models/user/User');
const getPostAge = require('../../helpers/getPostAge');

const getUserFeed = async (userId, offset) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User could not be found.');
  }

  const offsetInt = parseInt(offset, 10);

  const feed = await Posts.aggregate([
    {
      $match: {
        userId: { $in: user.connections.map((id) => ObjectId(id)) },
      },
    },
    { $sort: { createdAt: 1 } },
    { $limit: 10 },
    { $skip: offsetInt },
    {
      $lookup: {
        from: 'users',
        let: { id: '$userId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$id'] } } },
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
      $lookup: {
        from: 'userlikes',
        let: { id: userId },
        pipeline: [
          { $match: { $expr: { $eq: ['$likedBy', '$$id'] } } },
          {
            $project: {
              _id: 1,
              posts: 1,
            },
          },
        ],
        as: 'liked',
      },
    },
    { $unwind: '$postAuthor' },
    { $unwind: '$liked' },
    {
      $project: {
        _id: 1,
        body: 1,
        mediaUrl: 1,
        mediaMimeType: 1,
        mediaType: 1,
        mediaOrientation: 1,
        mediaIsSelfie: 1,
        userId: 1,
        likes: 1,
        private: 1,
        postAuthor: 1,
        liked: {
          $cond: {
            if: { $in: [{ $toString: '$_id' }, '$liked.posts'] },
            then: true,
            else: false,
          },
        },
      },
    },
  ]);

  if (feed.length) {
    feed.forEach((post) => {
      getPostAge(post);
    });
  }

  return feed;
};

module.exports = {
  getUserFeed,
};
