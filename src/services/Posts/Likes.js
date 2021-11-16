const Posts = require('../../models/posts/Posts');
const UserLikes = require('../../models/user/Likes');

/**
########## => Like System
*/
const addLikeToPost = async (postId, userId) => {
  const post = await Posts.findById(postId);
  if (!post) {
    throw new Error('Post does not exist.');
  }

  if (post.userId === userId) {
    throw new Error('Cannot like this post as it belongs to the same user.');
  }

  const likedPosts = await UserLikes.findOne({ likedBy: userId });

  // First time liking a post
  if (!likedPosts) {
    const newLikedPosts = new UserLikes();
    newLikedPosts.posts = [postId];
    newLikedPosts.likedBy = userId;
    post.likes += 1;

    newLikedPosts.save();
    post.save();
    return 'Post has been liked.';
  }

  if (likedPosts.posts.length && likedPosts.posts.includes(postId)) {
    throw new Error('Already liked this post.');
  }

  likedPosts.posts.push(postId);
  post.likes += 1;
  likedPosts.save();
  post.save();
  return 'Post has been liked';
};

const removeLikeFromPost = async (postId, userId) => {
  const likedPosts = await UserLikes.findOne({ likedBy: userId });
  if (!likedPosts.posts.includes(postId)) {
    throw new Error('User has not liked this post yet.');
  }
  const post = await Posts.findById(postId);
  if (!post) {
    throw new Error('Post does not exist.');
  }
  const likeIndex = likedPosts.posts.indexOf(postId);

  likedPosts.posts.splice(likeIndex);

  post.likes -= 1;
  likedPosts.save();
  post.save();
  return 'Post like has been removed';
};

module.exports = {
  addLikeToPost,
  removeLikeFromPost,
};
