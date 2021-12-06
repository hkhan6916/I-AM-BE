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

  await awsConnection.putObject(fileParams, async (err, pres) => {
    if (err) {
      await tmpCleanup();
      awsConnection.deleteObject(fileParams);
    }
  }).promise();
  // const fileUrl = `https://s3-${region}.amazonaws.com/${fileParams.Bucket}/${fileParams.Key}`;
  const fileUrl = `dhahb2s08yybu.cloudfront.net/${fileParams.Key}`;

  // delete all files in tmp uploads
  await tmpCleanup();
  return fileUrl;
};
