const { S3 } = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const tmpCleanup = require('./tmpCleanup');
const generateGif = require('./generateGif');

module.exports = async (file) => {
  const Bucket = 'i-am-app-test';
  const region = 'eu-west-2';

  const inFilePath = `tmp/uploads/${file.filename}`;

  const outFilePath = inFilePath.replace(/\.[^/.]+$/, '.gif');
  if (!file) {
    throw new Error('No video profile provided');
  }
  const credentials = {
    accessKeyId: 'AKIAVUWLHDRFSZV6Q6UK',
    secretAccessKey: '/fbmfpVvToJiW9Y2w6mqNgefun769Gm5rchHYjAP',
  };
  const awsConnection = new S3({
    credentials,
    region,
  });

  await generateGif(inFilePath, outFilePath);

  const profileGifPath = path.join(__dirname, '..', '..', outFilePath);
  const profileVideoPath = path.join(__dirname, '..', '..', inFilePath);

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
    ACL: 'private',
  };

  const profileVideoParams = {
    Bucket,
    Key: `${file.filename}`,
    Body: profileVideoBuffer,
    ACL: 'private',
  };

  await awsConnection.putObject(profileGifParams, (err, pres) => {
    if (err) {
      awsConnection.deleteObject(profileGifParams);
    }
  }).promise();

  await awsConnection.putObject(profileVideoParams, (err, pres) => {
    if (err) {
      awsConnection.deleteObject(profileVideoParams);
    }
  }).promise();

  const profileVideoUrl = `https://s3-${region}.amazonaws.com/${profileVideoParams.Bucket}/${profileVideoParams.Key}`; // awsConnection.getSignedUrl('getObject', { Bucket: profileVideoParams.Bucket, Key: profileVideoParams.Key });
  const profileGifUrl = `https://s3-${region}.amazonaws.com/${profileGifParams.Bucket}/${profileGifParams.Key}`; // awsConnection.getSignedUrl('getObject', { Bucket: profileGifParams.Bucket, Key: profileGifParams.Key });

  await tmpCleanup();
  return { profileVideoUrl, profileGifUrl };
};
