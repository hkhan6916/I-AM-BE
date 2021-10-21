const Posts = require('../../models/posts/Posts');

const getUserPosts = async (userId) => {
  const posts = await Posts.find({ userId });

  if (!posts) {
    throw new Error('no posts could be found');
  }
  return posts;
};

module.exports = {
  getUserPosts,
};
