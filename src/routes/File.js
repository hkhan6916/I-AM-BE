const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');
const verifyAuth = require('../middleware/auth');
const uploadFile = require('../helpers/uploadFile');

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

router.post('/files/upload', [verifyAuth, multer({
  storage,
}).single('file')], async (req, res) => {
  let success = true;
  let message = 'File uploaded.';
  let data = {};
  try {
    const fileUrl = await uploadFile(req.file);

    data = { fileUrl };
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
