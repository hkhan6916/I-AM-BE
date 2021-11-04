const Posts = require('../../models/posts/Posts');
const UserLikes = require('../../models/user/Likes');

const { uploadFile } = require('../../helpers');

/**
 ########## => Post creation,deletion and manipulation
 */

const createPost = async ({
  user, file, body, mediaOrientation, mediaIsSelfie,
}) => {
  if (!body && !file) {
    throw new Error('Media or post body required.');
  }

  const post = new Posts({
    body: body || '',
    userId: user.id,
  });
  if (file) {
    const mediaUrl = await uploadFile(file);
    post.mediaOrientation = mediaOrientation;
    post.mediaUrl = mediaUrl;
    post.mediaMimeType = file.mimetype;
    post.mediaType = file.mimetype.split('/')[0];
    post.mediaIsSelfie = mediaIsSelfie;
  }

  post.save();
  return {
    post,
  };
};

const repostPost = async ({
  userId, postId, body,
}) => {
  const post = await Posts.findById(postId);

  if (!post) {
    throw new Error('No post found to repost.');
  }

  if (post.repostPostId) {
    throw new Error('Cannot repost a reposted post.');
  }

  const repostedPost = new Posts({
    userId,
    body,
    repostPostId: postId,
  });

  repostedPost.save();
  return {
    repostedPost,
  };
};

// update post
// delete post

/**
########## => Like System
*/
const addLikeToPost = async (postId, userId) => {
  const post = await Posts.findById(postId);
  if (!post) {
    throw new Error('Post does not exist.');
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
  createPost,
  addLikeToPost,
  removeLikeFromPost,
  repostPost,
};
