const { S3 } = require('aws-sdk');
const getCloudfrontSignedUrl = require('./getCloudfrontSignedUrl');
const getFileSignedHeaders = require('./getFileSignedHeaders');

module.exports = async (file) => {
  const fileType = file.mimetype?.split('/')[0];
  if (fileType !== 'image' && fileType !== 'video') throw new Error('File must be image or video');
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

  const fileName = `${file.md5}${file.name.replace(/ /g, '')}`;

  const fileBuffer = Buffer.from(file.data, 'base64');
  const fileParams = {
    Bucket,
    Key: fileName,
    Body: fileBuffer,
    ACL: 'private',
  };

  await awsConnection.putObject(fileParams, async (err, pres) => {
    if (err) {
      awsConnection.deleteObject(fileParams);
      throw err;
    }
  }).promise();
  const fileUrl = fileType === 'video' ? `${process.env.CF_URL}/${fileParams.Key.replace(/ /g, '')}` : `https://${fileParams.Bucket}.s3.${region}.amazonaws.com/${fileParams.Key}`;
  const fileHeaders = fileType !== 'video' ? getFileSignedHeaders(fileUrl) : null;

  return {
    fileUrl, fileHeaders, key: fileParams.Key, signedUrl: fileType === 'video' ? getCloudfrontSignedUrl(fileParams.Key) : null, fileType,
  };
};
