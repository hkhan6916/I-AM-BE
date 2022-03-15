const { S3 } = require('aws-sdk');

module.exports = async (objects) => {
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
  await awsConnection.deleteObjects({
    Bucket,
    Delete: { Objects: objects },
  }).promise();

  return { deleted: true };
};
