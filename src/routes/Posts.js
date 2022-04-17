const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');
const multerS3 = require('multer-s3');
const { S3 } = require('aws-sdk');
const {
  createPost, repostPost, deletePost, updatePost, getPost, reportPost, markPostAsFailed, getAdditionalPostData,
} = require('../services/Posts/Post');

const { addLikeToPost, removeLikeFromPost } = require('../services/Posts/Likes');
const {
  getPostComments,
  addComment,
  removeComment,
  getCommentReplies,
  replyToComment,
  addLikeToComment,
  removeLikeFromComment,
  updateComment,
  reportComment,
} = require('../services/Posts/Comment');

// const storage = multer.diskStorage({
//   destination(req, file, cb) {
//     cb(null, 'tmp/uploads');
//     console.log(file);
//   },
//   filename: (req, file, cb) => {
//     const re = /(?:\.([^.]+))?$/;
//     const fileExtension = re.exec(file.originalname)[1];
//     file.filename = `${uuid()}.${fileExtension}`;
//     cb(null, `${file.filename}`);
//   },
// });
const Bucket = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const credentials = {
  accessKeyId: process.env.AWS_IAM_ACCESS_KEY,
  secretAccessKey: process.env.AWS_IAM_SECRET_KEY,
};
// const inFilePath = `tmp/uploads/${file.filename}`;
const awsConnection = new S3({
  credentials,
  region,
});

const upload = multer({
  storage: multerS3({
    s3: awsConnection,
    bucket: Bucket,
    metadata(req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key(req, file, cb) {
      const re = /(?:\.([^.]+))?$/;
      const fileExtension = re.exec(file.originalname)[1];
      file.filename = `${uuid()}.${fileExtension}`;
      cb(null, `${uuid()}.${fileExtension}`);
    },
    acl: 'private',
  }),
});

const verifyAuth = require('../middleware/auth');
const { getUserSearchFeed } = require('../services/User/Posts');

// Posts
// router.post('/posts/new', [verifyAuth, upload.single('file')], async (req, res) => {
//   console.log(process.pid);
//   let success = true;
//   let message = 'Post created.';
//   let data = {};
//   const {
//     postBody, mediaIsSelfie, postId, gif,
//   } = req.body;
//   try {
//     console.log(req.file);
//     data = await createPost({
//       userId: req.user.id, file: req.file, body: postBody, mediaIsSelfie, postId, gif,
//     });
//   } catch (e) {
//     success = false;
//     message = e.message;
//   }

//   res.status(200).json({
//     success,
//     message,
//     data,
//   });
// });

router.post('/posts/new', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post created.';
  let data = {};
  const {
    postBody, mediaIsSelfie, postId, gif,
  } = req.body;
  try {
    data = await createPost({
      userId: req.user.id, file: req.files?.file, body: postBody, mediaIsSelfie, postId, gif,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/posts/update/:postId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post updated.';
  let data = {};
  const {
    postBody, removeMedia,
  } = req.body;
  const {
    postId,
  } = req.params;
  try {
    data = await updatePost({
      userId: req.user.id, body: postBody, removeMedia, postId,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/posts/fetch/:postId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post fetched.';
  let data = {};
  const { postId } = req.params;
  try {
    data = await getPost(postId, req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});
router.delete('/posts/remove/:postId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post deleted.';
  let data = {};
  const { postId } = req.params;
  try {
    data = await deletePost(postId, req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});
router.post('/posts/report', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post reported.';
  let data = {};
  const { postId, reason } = req.body;
  try {
    data = await reportPost({ userId: req.user.id, postId, reason });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/posts/fail/:postId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post marked as failed.';
  let data = {};
  const { postId } = req.params;
  try {
    data = await markPostAsFailed(postId, req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

// Reposts
router.post('/posts/repost/:postId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post reposted.';
  let data = {};
  const { postId } = req.params;
  const { body } = req.body;
  try {
    data = await repostPost({
      userId: req.user.id, postId, body,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

// Likes
router.get('/posts/like/add/:postId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post liked.';
  let data = {};
  const { postId } = req.params;
  try {
    data = await addLikeToPost(
      postId, req.user.id,
    );
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/posts/like/remove/:postId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post liked removed.';
  let data = {};
  const { postId } = req.params;
  try {
    data = await removeLikeFromPost(
      postId, req.user.id,
    );
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

// Comments
router.post('/posts/comments/add', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Comment added.';
  let data = {};
  const { postId, body } = req.body;
  try {
    data = await addComment({ postId, userId: req.user.id, body });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/posts/comments/update', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Comment added.';
  let data = {};
  const { commentId, body } = req.body;
  try {
    data = await updateComment({ commentId, userId: req.user.id, body });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.delete('/posts/comments/remove/:commentId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Comment removed.';
  let data = {};
  const { commentId } = req.params;
  try {
    data = await removeComment(commentId, req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/posts/comments/:postId/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post comments fetched.';
  let data = {};
  const { postId, offset } = req.params;
  const offsetInt = parseInt(offset, 10);
  try {
    data = await getPostComments({ postId, userId: req.user.id, offset: offsetInt });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/posts/comments/replies/add', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Reply added.';
  let data = {};
  const { commentId, body } = req.body;
  try {
    data = await replyToComment({ commentId, userId: req.user.id, body });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/posts/comments/replies/:commentId/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Comment replies fetched.';
  let data = {};
  const { commentId, offset } = req.params;
  const offsetInt = parseInt(offset, 10);
  try {
    data = await getCommentReplies({ commentId, offset: offsetInt, userId: req.user.id });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/posts/comment/like/add/:commentId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Comment liked.';
  let data = {};
  const { commentId } = req.params;
  try {
    data = await addLikeToComment(commentId, req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/posts/comment/like/remove/:commentId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Comment like removed.';
  let data = {};
  const { commentId } = req.params;
  try {
    data = await removeLikeFromComment(
      commentId, req.user.id,
    );
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/posts/comment/report', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Comment reported.';
  let data = {};
  const { commentId, reason } = req.body;
  try {
    data = await reportComment({ userId: req.user.id, commentId, reason });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/posts/:postId/additionaldata', verifyAuth, async (req, res) => {
  // route to get number of likes or number of comments for a post
  let success = true;
  let message = 'Additional post data fetched.';
  let data = {};
  const { likesCount, commentCount, liked } = req.body;
  const { postId } = req.params;
  try {
    data = await getAdditionalPostData({
      postId, likesCount, commentCount, liked, userId: req.user.id,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/posts/searchfeed/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Search feed fetched.';
  let data = {};
  const { offset } = req.params;
  try {
    data = await getUserSearchFeed(parseInt(offset, 10), req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

module.exports = router;
