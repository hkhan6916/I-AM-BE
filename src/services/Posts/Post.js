const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const PostLikes = require('../../models/user/PostLikes');
const PostReport = require('../../models/posts/PostReports');
const User = require('../../models/user/User');
const { sendNotificationToSingleUser } = require('../Notifications/Notifications');
const {
  uploadFile, deleteFile, tmpCleanup, getFileSignedHeaders,
} = require('../../helpers');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');

/**
 ########## => Post creation,deletion and manipulation
 */

const createPost = async ({ // expects form data
  userId, file, body, mediaIsSelfie, postId, gif,
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
  if (!body && !file && !gif) {
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
      post.mediaIsSelfie = mediaIsSelfie;
      post.private = true;
      post.thumbnailKey = file.filename;
      post.thumbnailUrl = mediaUrl;
      post.mediaUrl = null;
      post.mediaType = 'video';
      post.ready = false;
    } else {
      post.mediaUrl = mediaUrl;
      post.mediaMimeType = file.mimetype.split('/')[1] || file.mimetype;
      post.mediaType = file.mimetype.split('/')[0];
      post.mediaIsSelfie = mediaIsSelfie;
      post.mediaKey = file.filename;
      post.ready = true;
    }
  } else {
    post.ready = true;
  }

  if (gif) {
    post.gif = gif;
  }

  post.save();
  user.numberOfPosts += 1;
  user.save();
  return {
    post,
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
const updatePost = async ({ // expects form data
  file, body, mediaIsSelfie, removeMedia, postId, userId, gif,
}) => {
  // we don't allow reposts to be removed
  const post = await Posts.findById(postId);
  // const post = await Posts.findById(postId);

  // TODO: check if post is hidden. If hidden, don't allow update
  if (!post) {
    throw new Error('No post could be found.');
  }
  if (!body && !file && removeMedia === 'true' && !post.repostPostId) {
    throw new Error('Media or post body required.');
  }
  if (file && post.repostPostId) {
    throw new Error('Cannot add media to a post containing a repost.');
  }
  if (post.userId.toString() !== userId) {
    throw new Error('Post does not belong to this user.');
  }
  const postObj = post.toObject();
  // we delete the old media from aws if new file
  if ((removeMedia === 'true' || file) && post.mediaKey) {
    await deleteFile(post.mediaKey);
  }
  // if user wants to remove any media from the post we nullify that old media
  if (removeMedia === 'true' && !file) {
    postObj.mediaIsSelfie = null;
    postObj.mediaUrl = '';
    postObj.mediaMimeType = null;
    postObj.mediaType = null;
    postObj.mediaKey = '';
    postObj.gif = '';
  }
  if (file && removeMedia === 'false') {
    const fileObj = await uploadFile(file);
    if (!fileObj.fileUrl) {
      throw new Error('File could not be uploaded.');
    }
    if (postObj.gif) {
      postObj.gif = '';
    }
    const mediaUrl = fileObj.fileUrl;
    if (file.originalname.includes('mediaThumbnail')) {
      postObj.mediaIsSelfie = mediaIsSelfie;
      postObj.private = true;
      postObj.thumbnailKey = file.filename;
      postObj.thumbnailUrl = mediaUrl;
      postObj.mediaUrl = null;
      postObj.mediaType = 'video';
      postObj.ready = false;
    } else {
      postObj.mediaUrl = mediaUrl;
      postObj.mediaMimeType = file.mimetype.split('/')[1] || file.mimetype;
      postObj.mediaType = file.mimetype.split('/')[0];
      postObj.mediaIsSelfie = mediaIsSelfie;
      postObj.mediaKey = file.filename;
      postObj.ready = true;
    }
  }
  if (gif) {
    postObj.gif = gif;
  }

  if (typeof body === 'string') {
    postObj.body = body;
  }
  await tmpCleanup();

  await Posts.findByIdAndUpdate(postId, postObj);

  if (post.mediaKey && gif) {
    // if provided a gif, delete any media as it will be replaced with the gif
    await deleteFile(post.mediaKey);
    postObj.mediaKey = '';
    postObj.mediaUrl = '';
  }

  return postObj;
};

const getPost = async (postId, userId) => {
  const post = await Posts.aggregate([
    {
      $match: {
        _id: { $eq: ObjectId(postId) },
      },
    },
    {
      $lookup: {
        from: 'posts',
        let: { id: '$repostPostId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', '$$id'],
              },
            },
          },
          {
            $lookup: { // get the author of the reposted post
              from: 'users',
              let: { id: '$userId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ['$_id', '$$id'] }, { $eq: ['$terminated', false] }],
                      // $eq: ['$_id', '$$id'],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profileGifUrl: 1,
                    firstName: 1,
                    lastName: 1,
                  },
                },
              ],
              as: 'postAuthor',
            },
          },
          { $unwind: { path: '$postAuthor', preserveNullAndEmptyArrays: true } },
        ],
        as: 'repostPostObj',
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
    { $unwind: { path: '$postAuthor', preserveNullAndEmptyArrays: true } },
    {
      $unwind:
       {
         path: '$repostPostObj',
         preserveNullAndEmptyArrays: true,
       },
    },
  ]);
  if (!post[0]) {
    throw new Error('No post could be found.');
  }
  if ((post[0].private || post[0].hidden) && post[0].userId.toString() !== userId) {
    throw new Error('Post is private or hidden and does not belong to this user.');
  }
  post[0].mediaUrl = getCloudfrontSignedUrl(post[0].mediaKey);
  post[0].thumbnailHeaders = getFileSignedHeaders(post[0].mediaUrl);
  return post[0];
};
const deletePost = async (postId, userId) => {
  const post = await Posts.findByIdAndDelete(postId);
  if (!post) {
    throw new Error('No post could be found.');
  }
  if (post.mediaKey) {
    await deleteFile(post.mediaKey);
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User does not exist.');
  }
  user.numberOfPosts -= 1;
  user.save();
  return { deleted: true };
};

const getAdditionalPostData = async ({
  postId, likesCount, commentCount, liked: fetchLiked, userId,
}) => {
  const post = await Posts.findById(postId);
  if (!post) {
    throw new Error('Post could not be found.');
  }
  if (likesCount) {
    return { likes: post.likes };
  }
  if (commentCount) {
    return { numberOfComments: post.numberOfComments };
  }
  if (fetchLiked) {
    const liked = await PostLikes.findOne({ postId, likedBy: userId });
    return { liked: !!liked };
  }
  const liked = await PostLikes.findOne({ postId, likedBy: userId });

  return { likes: post.likes, numberOfComments: post.numberOfComments, liked };
};

module.exports = {
  createPost,
  repostPost,
  getPost,
  deletePost,
  updatePost,
  reportPost,
  markPostAsFailed,
  getAdditionalPostData,
};
