const { S3 } = require('aws-sdk');
const { getVideoDurationInSeconds } = require('get-video-duration');
const { Readable } = require('stream');
const generateGif = require('./generateGif');
const getCloudfrontSignedUrl = require('./getCloudfrontSignedUrl');

module.exports = async (profileVideoKey) => {
  const Bucket = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_BUCKET_REGION;

  if (!profileVideoKey) {
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
  const profileVideoParams = {
    Key: `profileVideos/${profileVideoKey}`,
  };
  // ########## Create and upload the profile gif
  const profileVideoSignedUrl = await getCloudfrontSignedUrl(profileVideoParams.Key);

  if (!profileVideoSignedUrl) {
    throw new Error('Could not fetch the requested profile video.');
  }

  const profileGifBuffer = await generateGif(profileVideoSignedUrl); // need to generate signed cloudfront url
  //   if (!profileGifBuffer) {
  //     awsConnection.deleteObject(profileVideoParams);

  //     throw new Error('Could not generate a profile gif.');
  //   }

  const profileGifName = `${profileVideoKey.replace(/\s/g, '')}`.replace(/\.[^/.]+$/, '.gif');

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

  const profileGifUrl = `https://${Bucket}.s3.${region}.amazonaws.com/${profileGifParams.Key}`;
  return profileGifUrl;
};
