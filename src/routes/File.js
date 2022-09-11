const express = require('express');

const router = express.Router();
const fileUpload = require('express-fileupload');
const { nanoid } = require('nanoid');
const verifyAuth = require('../middleware/auth');
const uploadFile = require('../helpers/uploadFile');
const getFileSignedHeaders = require('../helpers/getFileSignedHeaders');
const getCloudfrontSignedUrl = require('../helpers/getCloudfrontSignedUrl');
const { getSignedUploadS3Url } = require('../helpers');

router.post('/files/upload', [verifyAuth, fileUpload({
  abortOnLimit: true,
  limits: { fileSize: 50 * 1024 * 1024 },
})], async (req, res) => {
  let success = true;
  let message = 'File uploaded.';
  let data = {};
  try {
    const { fileUrl, fileHeaders } = await uploadFile(req.files?.file);

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

router.post('/files/signed-upload-url', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Signed url generated.';
  let data = {};
  try {
    const fileKey = `upload_${nanoid()}${req.body.filename.replace(/\s/g, '')}`;
    const signedUrl = await getSignedUploadS3Url(`${fileKey}`);
    data = { signedUrl, fileKey };
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

router.post('/files/signed-video-profile-upload-url', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Signed url generated.';
  let data = {};
  try {
    const profileVideoKey = `${req.body.username || 'upload'}_${nanoid()}${req.body.filename.replace(/\s/g, '')}`;
    const profileGifKey = `${profileVideoKey.substring(0, profileVideoKey.lastIndexOf('.'))}.gif`;

    const signedUrl = await getSignedUploadS3Url(`profileVideos/${profileVideoKey}`);
    const signedGifUrl = await getSignedUploadS3Url(`profileGifs/${profileGifKey}`);
    data = {
      signedUrl, signedGifUrl, profileVideoKey, profileGifKey,
    };
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
router.post('/files/signed-image-profile-upload-url', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Signed url generated.';
  let data = {};
  try {
    const profileImageKey = `${req.body.username || 'upload'}_${nanoid()}${req.body.filename.replace(/\s/g, '')}`;
    const signedUrl = await getSignedUploadS3Url(`profileImages/${profileImageKey}`);
    data = { signedUrl, profileImageKey };
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
