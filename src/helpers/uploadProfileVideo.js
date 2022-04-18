const { S3 } = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const tmpCleanup = require('./tmpCleanup');
const generateGif = require('./generateGif');
const getCloudfrontSignedUrl = require('./getCloudfrontSignedUrl');

module.exports = async (file) => {
  const Bucket = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;

  // const inFilePath = `tmp/uploads/${file.filename}`;

  // const outFilePath = inFilePath.replace(/\.[^/.]+$/, '.gif');
  if (!file) {
    throw new Error('No video profile provided');
  }
  const credentials = {
    accessKeyId: process.env.AWS_IAM_ACCESS_KEY,
    secretAccessKey: process.env.AWS_IAM_SECRET_KEY,
  };
  const awsConnection = new S3({
    credentials,
    region,
  });

  const inFilePath = await getCloudfrontSignedUrl(file.name);

  // const profileGifPath = path.join(__dirname, '..', '..', outFilePath);

  const profileGifBuffer = await generateGif(inFilePath); // need to generate signed cloudfront url
  if (!profileGifBuffer) {
    throw new Error('Could not generate a profile gif.');
  }

  const profileVideoBuffer = file.data;
  if (!profileGifBuffer) {
    throw new Error('Unable to get profile gif buffer.');
  }

  const profileGifName = file.filename.replace(/\.[^/.]+$/, '.gif');

  const profileGifParams = {
    Bucket,
    Key: `profileGifs/${profileGifName}`,
    Body: profileGifBuffer,
    ACL: 'private',
  };

  const profileVideoParams = {
    Bucket,
    Key: `profileVideos/${file.name}`,
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

  const profileVideoUrl = `https://${profileVideoParams.Bucket}.s3.${region}.amazonaws.com/${profileVideoParams.Key}`;
  const profileGifUrl = `https://${profileGifParams.Bucket}.s3.${region}.amazonaws.com/${profileGifParams.Key}`;

  await tmpCleanup();
  return { profileVideoUrl, profileGifUrl };
};
