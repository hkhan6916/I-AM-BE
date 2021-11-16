const Comment = require('../../models/posts/Comment');
const Posts = require('../../models/posts/Posts');
const User = require('../../models/user/User');

const addComment = async ({ postId, userId, body }) => {
  const post = await Posts.findById(postId);
  const user = await User.findById(userId);

  if (!body) {
    throw new Error('Comments require a body.');
  }

  if (!post) {
    throw new Error('Post could not be found for this comment');
  }

  if (!user) {
    throw new Error('Could not find user to post this comment');
  }

  const comment = new Comment({
    postId,
    userId,
    firstName: user.firstName,
    lastName: user.lastName,
    body,
  });

  comment.save();
  return 'Comment posted.';
};

const getPostComments = async (postId, offset) => {
  const comments = await Comment.find({ postId }).skip(offset).limit(10);
  return comments;
};

module.exports = {
  addComment,
  getPostComments,
};
