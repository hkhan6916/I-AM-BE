const express = require('express');

const router = express.Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const verifyAuth = require('../middleware/auth');

const { createPost } = require('../services/Posts/Post');

router.post('/posts/new', [verifyAuth, multer({
  storage,
}).single('file')], async (req, res) => {
  let success = true;
  let message = 'Post created.';
  let data = {};
  const { postBody } = req.body;

  try {
    data = await createPost({ user: req.user, file: req.file, body: postBody });
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
