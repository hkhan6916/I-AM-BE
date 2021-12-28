const { S3 } = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const getFileSignedHeaders = require('./getFileSignedHeaders');
const tmpCleanup = require('./tmpCleanup');

module.exports = async (file) => {
  const Bucket = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;
  const credentials = {
    accessKeyId: process.env.AWS_IAM_ACCESS_KEY,
    secretAccessKey: process.env.AWS_IAM_SECRET_KEY,
  };
  const inFilePath = `tmp/uploads/${file.filename}`;
  const awsConnection = new S3({
    credentials,
    region,
  });

  const absoluteFilePath = path.join(__dirname, '..', '..', inFilePath);

  const fileBuffer = fs.readFileSync(absoluteFilePath);
  const fileParams = {
    Bucket,
    Key: `${file.filename}`,
    Body: fileBuffer,
    ACL: 'private',
  };

  await awsConnection.putObject(fileParams, async (err, pres) => {
    if (err) {
      await tmpCleanup();
      awsConnection.deleteObject(fileParams);
    }
  }).promise();
  const fileUrl = `https://${fileParams.Bucket}.s3.${region}.amazonaws.com/${fileParams.Key}`;
  const fileHeaders = getFileSignedHeaders(fileUrl);

  // delete all files in tmp uploads
  await tmpCleanup();
  return { fileUrl, fileHeaders };
};
