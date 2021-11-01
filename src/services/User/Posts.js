const Posts = require('../../models/posts/Posts');
const { getPostAge } = require('../../helpers');

const getUserPosts = async (userId, offset) => {
  const posts = await Posts.find({ userId }, {}, { skip: parseInt(offset, 10), limit: 10 });

  if (!Array.isArray(posts)) {
    throw new Error('Could not fetch posts');
  }

  if (!posts.length) {
    throw new Error('No posts found');
  }

  posts.forEach((post) => {
    getPostAge(post);
  });

  return posts;
};

module.exports = {
  getUserPosts,
};
