const { S3 } = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const tmpCleanup = require('./tmpCleanup');

module.exports = async (file) => {
  const Bucket = 'i-am-app-test';
  const region = 'eu-west-2';

  const inFilePath = `tmp/uploads/${file.filename}`;

  const awsConnection = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region,
  });

  const absoluteFilePath = path.join(__dirname, '..', '..', inFilePath);

  const fileBuffer = fs.readFileSync(absoluteFilePath);
  const fileParams = {
    Bucket,
    Key: `${file.filename}`,
    Body: fileBuffer,
    ACL: 'public-read',
  };

  await awsConnection.putObject(fileParams, (err, pres) => {
    if (err) {
      console.log(err);
      awsConnection.deleteObject(fileParams);
    }
  }).promise();

  const profileVideoUrl = `https://s3-${region}.amazonaws.com/${fileParams.Bucket}/${fileParams.Key}`; // awsConnection.getSignedUrl('getObject', { Bucket: fileParams.Bucket, Key: fileParams.Key });

  // delete all files in tmp uploads
  await tmpCleanup();
  return profileVideoUrl;
};
