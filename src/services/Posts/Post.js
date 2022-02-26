const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const PostReport = require('../../models/posts/PostReports');
const User = require('../../models/user/User');
const { sendNotificationToSingleUser } = require('../Notifications/Notifications');
const { uploadFile, deleteFile, tmpCleanup } = require('../../helpers');

/**
 ########## => Post creation,deletion and manipulation
 */

const createPost = async ({
  userId, file, body, mediaOrientation, mediaIsSelfie, postId,
}) => {
  // if posting video after the thumbnail and body have been posted.
  if (file && postId && file.mimetype.split('/')[0] === 'video') {
    const post = await Posts.findById(postId);
    if (!post) {
      throw new Error('Post does not exist.');
    }
    if (post?.thumbnailUrl && post.mediaUrl) {
      throw new Error('Media for this post has already been uploaded.');
    }
    if (!post?.thumbnailUrl) {
      throw new Error('This post does not have a thumbnail for the video.');
    }
    const fileObj = await uploadFile(file);
    if (!fileObj.fileUrl) {
      throw new Error('File could not be uploaded.');
    }

    const mediaUrl = fileObj.fileUrl;
    await Posts.findByIdAndUpdate(postId, {
      mediaUrl,
      mediaMimeType: file.mimetype.split('/')[1] || file.mimetype,
      mediaType: file.mimetype.split('/')[0],
      mediaKey: file.filename,
      private: false,
      ready: true,
    });
  }
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
    if (file.originalname.includes('mediaThumbnail')) {
      post.mediaOrientation = mediaOrientation;
      post.mediaIsSelfie = mediaIsSelfie;
      post.private = true;
      post.thumbnailKey = file.filename;
      post.thumbnailUrl = mediaUrl;
      post.mediaUrl = null;
      post.mediaType = 'video';
      post.ready = false;
    } else {
      post.mediaOrientation = mediaOrientation;
      post.mediaUrl = mediaUrl;
      post.mediaMimeType = file.mimetype.split('/')[1] || file.mimetype;
      post.mediaType = file.mimetype.split('/')[0];
      post.mediaIsSelfie = mediaIsSelfie;
      post.mediaKey = file.filename;
      post.ready = true;
    }
  }
  post.save();
  user.numberOfPosts += 1;
  user.save();
  return {
    post,
    // user,
  };
};

const markPostAsFailed = async (postId, userId) => {
  const post = await Posts.findByIdAndUpdate(postId, { cancelled: true });
  if (!post) {
    throw new Error('Post does not exist');
  }
  await sendNotificationToSingleUser({
    userId,
    messageBody: 'Connection was lost when uploading your media files.',
    title: 'Post upload failed.',
  });
};

const reportPost = async ({ postId, userId, reason }) => {
  const post = await Posts.findById(postId);
  if (!post) {
    throw new Error('Post does not exist');
  }
  const existingReport = await PostReport.findOne({ postId, userId });
  if (existingReport) {
    return existingReport;
  }

  const report = new PostReport({ userId, postId, reason });
  // if the number of reports on a post times 6 is more than its number of likes, set as hidden.
  if (post.reports >= 15 && post.reports * 4 >= post.likes) {
    post.hidden = true;
  }
  post.reports += 1;

  report.save();
  post.save();

  return { report, hidden: post.hidden };
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
// TODO: check if post is hidden. If hidden, don't allow update
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
  reportPost,
  markPostAsFailed,
};
