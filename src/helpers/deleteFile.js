const { S3 } = require('aws-sdk');

module.exports = async (key) => {
  const Bucket = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;
  const credentials = {
    accessKeyId: process.env.AWS_IAM_ACCESS_KEY,
    secretAccessKey: process.env.AWS_IAM_SECRET_KEY,
  };
  const awsConnection = new S3({
    credentials,
    region,
  });
  const profileGifParams = {
    Bucket,
    Key: key,
  };

  await awsConnection.deleteObject(profileGifParams, async (err, pres) => {
    if (err) {
      throw err;
    }
  }).promise();
  return 'deleted';
};
