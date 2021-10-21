const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');

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

const { createPost } = require('../services/Posts/Post');

router.post('/posts/new', [verifyAuth, multer({
  storage,
}).single('file')], async (req, res) => {
  let success = true;
  let message = 'Post created.';
  let data = {};
  const { postBody, mediaOrientation } = req.body;
  try {
    data = await createPost({
      user: req.user, file: req.file, body: postBody, mediaOrientation,
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

module.exports = router;
