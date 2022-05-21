const { S3 } = require('aws-sdk');
const generateGif = require('./generateGif');
const getCloudfrontSignedUrl = require('./getCloudfrontSignedUrl');

module.exports = async (file) => {
  const Bucket = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;

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

  // ########## Upload profile video
  const profileVideoBuffer = file.data;
  const fileName = `${file.md5}${file.name.replace(/ /g, '')}`;
  const profileVideoParams = {
    Bucket,
    Key: `profileVideos/${fileName}`,
    Body: profileVideoBuffer,
    ACL: 'private',
  };
  await awsConnection.putObject(profileVideoParams, (err, pres) => {
    if (err) {
      awsConnection.deleteObject(profileVideoParams);
    }
  }).promise();
  // ########## Create and upload the profile gif
  const profileVideoSignedUrl = await getCloudfrontSignedUrl(`profileVideos/${fileName}`);

  if (!profileVideoSignedUrl) {
    throw new Error('Could not fetch the requested profile video.');
  }

  const profileGifBuffer = await generateGif(profileVideoSignedUrl); // need to generate signed cloudfront url
  if (!profileGifBuffer) {
    awsConnection.deleteObject(profileVideoParams);

    throw new Error('Could not generate a profile gif.');
  }

  const profileGifName = `${file.md5}${file.name.replace(/\s/g, '')}`.replace(/\.[^/.]+$/, '.gif');

  const profileGifParams = {
    Bucket,
    Key: `profileGifs/${profileGifName}`,
    Body: profileGifBuffer,
    ACL: 'private',
  };

  await awsConnection.putObject(profileGifParams, (err, pres) => {
    if (err) {
      awsConnection.deleteObject(profileGifParams);
    }
  }).promise();

  const profileVideoUrl = `https://${profileVideoParams.Bucket}.s3.${region}.amazonaws.com/${profileVideoParams.Key}`;
  const profileGifUrl = `https://${profileGifParams.Bucket}.s3.${region}.amazonaws.com/${profileGifParams.Key}`;

  return { profileVideoUrl, profileGifUrl };
};
