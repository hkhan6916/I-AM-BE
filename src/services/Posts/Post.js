const Posts = require('../../models/posts/Posts');
const { uploadFile } = require('../../helpers');

const createPost = async ({
  user, file, body, mediaOrientation,
}) => {
  if (!body && !file) {
    throw new Error('Media or post body required.');
  }

  const post = new Posts({
    body: body || '',
    userId: user.id,
  });
  if (file) {
    const mediaUrl = await uploadFile(file);
    post.mediaOrientation = mediaOrientation;
    post.mediaUrl = mediaUrl;
    post.mediaMimeType = file.mimetype;
    post.mediaType = file.mimetype.split('/')[0];
  }

  post.save();
  return {
    post,
  };
};

module.exports = {
  createPost,
};
