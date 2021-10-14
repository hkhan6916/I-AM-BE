const { S3 } = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const tmpCleanup = require('./tmpCleanup');
const generateGif = require('./generateGif');

module.exports = async (file) => {
  const Bucket = 'chat-app-for-learning';

  const inFilename = `tmp/uploads/${file.filename}`;

  const outFilename = inFilename.replace(/\.[^/.]+$/, '.gif');
  if (!file) {
    throw new Error('No video profile provided');
  }

  const awsConnection = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-2',
  });

  await generateGif(inFilename, outFilename);

  const profileGifPath = path.join(__dirname, '..', '..', outFilename);
  const profileVideoPath = path.join(__dirname, '..', '..', inFilename);

  if (!fs.existsSync(profileGifPath, 'utf8')) {
    throw new Error('Could not generate a profile gif.');
  }
  const profileGifBuffer = fs.readFileSync(profileGifPath);
  const profileVideoBuffer = fs.readFileSync(profileVideoPath);
  if (!profileGifBuffer) {
    throw new Error('Unable to get profile gif buffer.');
  }

  const profileGifName = file.filename.replace(/\.[^/.]+$/, '.gif');

  const profileGifParams = {
    Bucket,
    Key: profileGifName,
    Body: profileGifBuffer,
    ACL: 'public-read',
  };

  const profileVideoParams = {
    Bucket,
    Key: `${file.filename}`,
    Body: profileVideoBuffer,
    ACL: 'public-read',
  };

  await awsConnection.putObject(profileVideoParams, (err, pres) => {
    if (err) { // todo delete file if error
      console.log(err.message);
    }
  }).promise();
  await awsConnection.putObject(profileGifParams, (err, pres) => {
    if (err) { // todo delete file if error
      console.log(err.message);
    }
  }).promise();

  const profileVideoUrl = `https://s3-us-east-2.amazonaws.com/${profileVideoParams.Bucket}/${profileVideoParams.Key}`; // awsConnection.getSignedUrl('getObject', { Bucket: profileVideoParams.Bucket, Key: profileVideoParams.Key });
  const profileGifUrl = `https://s3-us-east-2.amazonaws.com/${profileGifParams.Bucket}/${profileGifParams.Key}`; // awsConnection.getSignedUrl('getObject', { Bucket: profileGifParams.Bucket, Key: profileGifParams.Key });

  // delete all files in tmp uploads
  await tmpCleanup();
  return { profileVideoUrl, profileGifUrl };
};
