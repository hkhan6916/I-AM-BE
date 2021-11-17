const Posts = require('../../models/posts/Posts');

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

module.exports = {
  createPost,
  repostPost,
};
