const AWS = require('aws-sdk');

module.exports = (mediaKey) => {
  const cloudfrontAccessKeyId = process.env.CF_ACCESS_KEY_ID;
  // RSA public key can be copied by following command -  pbcopy < ~/Downloads/aws-pk.pem
  const cloudFrontPrivateKey = process.env.CF_PRIVATE_KEY.replace(/\\n/gm, '\n');
  const signer = new AWS.CloudFront.Signer(cloudfrontAccessKeyId, cloudFrontPrivateKey);

  const twoDays = 2 * 24 * 60 * 60 * 1000;

  const signedUrl = signer.getSignedUrl({
    url: `${process.env.CF_URL}/${mediaKey}`,
    expires: Math.floor((Date.now() + twoDays) / 1000),
  });
  return signedUrl;
};
