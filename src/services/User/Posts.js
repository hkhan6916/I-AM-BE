const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const { calculateAge } = require('../../helpers');
const getFileSignedHeaders = require('../../helpers/getFileSignedHeaders');

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
      $unwind: '$postAuthor',
    },
    {
      $unwind:
       {
         path: '$repostPostObj',
         preserveNullAndEmptyArrays: true,
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
    if (post.mediaUrl) {
      const headers = getFileSignedHeaders(post.mediaUrl);

      post.mediaHeaders = headers;
    }
    if (post.repostPostObj?.postAuthor) {
      const headers = getFileSignedHeaders(post.repostPostObj.postAuthor.profileGifUrl);
      post.repostPostObj.postAuthor.profileGifHeaders = headers;
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

};
