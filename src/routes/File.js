const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');
const verifyAuth = require('../middleware/auth');
const uploadFile = require('../helpers/uploadFile');
const getFileSignedHeaders = require('../helpers/getFileSignedHeaders');
const getCloudfrontSignedUrl = require('../helpers/getCloudfrontSignedUrl');

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
    const { fileUrl, fileHeaders } = await uploadFile(req.file);

    data = { fileUrl, fileHeaders };
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

router.get('/files/:key', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'File uploaded.';
  let data = {};
  try {
    const fileUrl = getFileSignedHeaders(`https://s3-${process.env.AWS_BUCKET_REGION}.amazonaws.com/${process.env.AWS_BUCKET_NAME}/${req.params.mediaUrl}`);
    data = fileUrl;
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

router.post('/files/cloudfront', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'File uploaded.';
  let data = {};
  const { mediaKey } = req.body;
  try {
    const fileUrl = getCloudfrontSignedUrl(mediaKey);
    data = fileUrl;
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
