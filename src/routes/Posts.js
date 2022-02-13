const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');
const {
  createPost, repostPost, deletePost, updatePost, getPost, reportPost,
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

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'tmp/uploads');
  },
  filename: (req, file, cb) => {
    const re = /(?:\.([^.]+))?$/;
    const fileExtension = re.exec(file.originalname)[1];
    file.filename = `${uuid()}.${fileExtension}`;
    cb(null, `${file.filename}`);
  },
});
const verifyAuth = require('../middleware/auth');

// Posts
router.post('/posts/new', [verifyAuth, multer({
  storage,
}).single('file')], async (req, res) => {
  let success = true;
  let message = 'Post created.';
  let data = {};
  const { postBody, mediaOrientation, mediaIsSelfie } = req.body;
  try {
    data = await createPost({
      userId: req.user.id, file: req.file, body: postBody, mediaOrientation, mediaIsSelfie,
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

router.post('/posts/update/:postId', [verifyAuth, multer({
  storage,
}).single('file')], async (req, res) => {
  let success = true;
  let message = 'Post updated.';
  let data = {};
  const {
    postBody, mediaOrientation, mediaIsSelfie, removeMedia,
  } = req.body;
  const {
    postId,
  } = req.params;
  try {
    data = await updatePost({
      userId: req.user.id, file: req.file, body: postBody, mediaOrientation, mediaIsSelfie, removeMedia, postId,
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
    data = await getPost(postId);
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
  let message = 'Post liked.';
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
module.exports = router;
