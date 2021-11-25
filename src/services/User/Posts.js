const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const { calculateAge } = require('../../helpers');

const getUserPosts = async (userId, offset) => {
  // const posts = await Posts.find({ userId }, {}, { skip: parseInt(offset, 10), limit: 10 });

  // if (posts.length) {
  //   posts.forEach((post) => {
  //     calculateAge(post);
  //   });
  // }
  // return posts;

  // posts.forEach((post) => {
  //   post = { ...post, belonging: 'true' };
  //   console.log(post);
  //   calculateAge(post);
  // });

  // return posts;

  const posts = await Posts.aggregate([
    {
      $match: {
        $expr: { $eq: ['$userId', ObjectId(userId)] },
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
  ]);
  if (!Array.isArray(posts)) {
    throw new Error('Could not fetch posts');
  }

  if (!posts.length) {
    throw new Error('No posts found');
  }
  posts.forEach((post) => {
    post.belongsToUser = true;

    calculateAge(post);
  });

  return posts;
};

module.exports = {
  getUserPosts,
};
