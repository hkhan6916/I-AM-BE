const { S3 } = require('aws-sdk');

module.exports = async (fileKey) => {
  const credentials = {
    accessKeyId: process.env.AWS_IAM_ACCESS_KEY,
    secretAccessKey: process.env.AWS_IAM_SECRET_KEY,
  };
  const s3 = new S3({
    credentials,
    region: process.env.AWS_BUCKET_REGION,
  });
  const url = s3.getSignedUrl('putObject', {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileKey,
    Expires: 120,
  });

  return url;
};
