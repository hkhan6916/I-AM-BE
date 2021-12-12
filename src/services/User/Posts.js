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

    calculateAge(post);
  });

  return posts;
};

module.exports = {
  getUserPosts,
};
