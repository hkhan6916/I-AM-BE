module.exports = async (file) => {
  const mediaType = file.mimetype.split('/')[0];

  const mediaUrl = mediaType === 'video' ? `${process.env.CF_URL}/${file.key}` : `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${file.key}`;
  return { mediaUrl, mediaType };
};
