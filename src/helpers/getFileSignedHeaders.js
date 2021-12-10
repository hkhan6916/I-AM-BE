const aws4 = require('aws4');

module.exports = async (mediaUrl) => {
  const credentials = {
    accessKeyId: process.env.AWS_IAM_ACCESS_KEY,
    secretAccessKey: process.env.AWS_IAM_SECRET_KEY,
  };

  const url = new URL(mediaUrl);

  const opts = {
    region: process.env.AWS_BUCKET_REGION,
    service: 's3',
    method: 'GET',
    host: url.hostname,
    path: `${url.pathname}${url.search}`,
  };

  return aws4.sign(opts, credentials).headers;
};
