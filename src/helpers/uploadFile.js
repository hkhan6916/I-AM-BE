const { S3 } = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const tmpCleanup = require('./tmpCleanup');

module.exports = async (file) => {
  const Bucket = 'i-am-app-test';
  const region = 'eu-west-2';
  const credentials = {
    accessKeyId: 'AKIAVUWLHDRFSZV6Q6UK',
    secretAccessKey: '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',
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

  // delete all files in tmp uploads
  await tmpCleanup();
  return fileUrl;
};
