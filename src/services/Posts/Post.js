const Posts = require('../../models/posts/Posts');
const { uploadProfileVideo } = require('../../helpers');

const createPost = async ({ user, file, body }) => {
  if (!body && !file) {
    throw new Error('Media or post body required.');
  }
  const post = new Posts({
    body: body || '',
    userId: user.id,
  });

  if (file) {
    const mediaUrl = await uploadProfileVideo(file);
    post.mediaUrl = mediaUrl;
  }
  post.save();
  return {
    post,
  };
};

module.exports = {
  createPost,
};
