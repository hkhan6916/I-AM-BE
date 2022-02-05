const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const User = require('../../models/user/User');

const { uploadFile, deleteFile, tmpCleanup } = require('../../helpers');

/**
 ########## => Post creation,deletion and manipulation
 */

const createPost = async ({
  userId, file, body, mediaOrientation, mediaIsSelfie,
}) => {
  if (!body && !file) {
    throw new Error('Media or post body required.');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User does not exist.');
  }
  const post = new Posts({
    body: body || '',
    userId,
  });
  if (file) {
    const fileObj = await uploadFile(file);
    if (!fileObj.fileUrl) {
      throw new Error('File could not be uploaded.');
    }
    const mediaUrl = fileObj.fileUrl;
    post.mediaOrientation = mediaOrientation;
    post.mediaUrl = mediaUrl;
    post.mediaMimeType = file.mimetype.split('/')[1] || file.mimetype;
    post.mediaType = file.mimetype.split('/')[0];
    post.mediaIsSelfie = mediaIsSelfie;
    post.mediaKey = file.filename;
  }

  post.save();
  user.numberOfPosts += 1;
  user.save();
  return {
    post,
    user,
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
const updatePost = async ({
  file, body, mediaOrientation, mediaIsSelfie, removeMedia, postId,
}) => {
  if (!body && !file) {
    throw new Error('Media or post body required.');
  }
  const post = await Posts.findById(postId);
  const postObj = post.toObject();
  if (!post) {
    throw new Error('No post could be found.');
  }
  // we delete the old media from aws if new file is
  if (removeMedia || file) {
    await deleteFile(post.mediaKey);
  }
  // if user wants to remove any media from the post we nullify that old media
  if (removeMedia && !file) {
    postObj.mediaIsSelfie = null;
    postObj.mediaUrl = null;
    postObj.mediaMimeType = null;
    postObj.mediaType = null;
    postObj.mediaOrientation = null;
    postObj.mediaKey = null;
  }
  if (file && !removeMedia) {
    const fileObj = await uploadFile(file);
    if (!fileObj.fileUrl) {
      throw new Error('File could not be uploaded.');
    }
    const mediaUrl = fileObj.fileUrl;
    postObj.mediaOrientation = mediaOrientation;
    postObj.mediaUrl = mediaUrl;
    postObj.mediaMimeType = file.mimetype;
    postObj.mediaType = file.mimetype.split('/')[0];
    postObj.mediaIsSelfie = mediaIsSelfie;
    postObj.mediaKey = file.filename;
  }
  if (body) {
    postObj.body = body;
  }
  await tmpCleanup();

  await Posts.findByIdAndUpdate(postId, postObj);
  return postObj;
};

const getPost = async (postId) => {
  const post = await Posts.aggregate([
    {
      $match: {
        _id: { $eq: ObjectId(postId) },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'postAuthor',
      },
    },
    {
      $unwind: '$postAuthor',
    },
  ]);
  if (!post) {
    throw new Error('No post could be found.');
  }
  return post;
};
const deletePost = async (postId, userId) => {
  const post = await Posts.findByIdAndDelete(postId);
  if (!post) {
    throw new Error('No post could be found.');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User does not exist.');
  }
  user.numberOfPosts -= 1;
  user.save();
  return { deleted: true };
};

module.exports = {
  createPost,
  repostPost,
  getPost,
  deletePost,
  updatePost,
};
