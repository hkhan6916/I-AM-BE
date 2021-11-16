const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');
const {
  createPost, repostPost,
} = require('../services/Posts/Post');

const { addLikeToPost, removeLikeFromPost } = require('../services/Posts/Likes');
const { getPostComments, addComment } = require('../services/Posts/Comment');

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

router.post('/posts/new', [verifyAuth, multer({
  storage,
}).single('file')], async (req, res) => {
  let success = true;
  let message = 'Post created.';
  let data = {};
  const { postBody, mediaOrientation, mediaIsSelfie } = req.body;
  try {
    data = await createPost({
      user: req.user, file: req.file, body: postBody, mediaOrientation, mediaIsSelfie,
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

router.get('/posts/comments/:postId/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Post comments fetched.';
  let data = {};
  const { postId, offset } = req.params;
  const offsetInt = parseInt(offset, 10);
  try {
    data = await getPostComments(postId, offsetInt);
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

module.exports = router;
