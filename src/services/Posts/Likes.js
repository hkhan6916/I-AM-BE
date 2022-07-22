const Posts = require('../../models/posts/Posts');
const PostLikes = require('../../models/user/PostLikes');

/**
########## => Like System
*/
const addLikeToPost = async (postId, userId) => {
  setTimeout(async () => {
    const post = await Posts.findById(postId);

    if (!post) {
      throw new Error('Post does not exist.');
    }

    if (post.userId.toString() === userId) {
      throw new Error('Cannot like this post as it belongs to the same user.');
    }

    const likedPost = await PostLikes.findOne({ likedBy: userId, postId });
    if (likedPost) {
      throw new Error('User has already liked this post.');
    }

    const like = new PostLikes({
      likedBy: userId,
      postId,
    });

    post.likes += 1;
    post.save();
    like.save();

    return 'Post has been liked';
  }, 500);
};

const removeLikeFromPost = async (postId, userId) => {
  setTimeout(async () => {
    const post = await Posts.findById(postId);
    if (!post) {
      throw new Error('Post does not exist.');
    }
    const likedPost = await PostLikes.findOneAndDelete({ likedBy: userId, postId });
    if (!likedPost) {
      throw new Error('User has not liked this post yet.');
    }

    if (post.likes > 0) {
      post.likes -= 1;
      post.save();
    }
    return 'Post like has been removed';
  }, 500);
};

module.exports = {
  addLikeToPost,
  removeLikeFromPost,
};
