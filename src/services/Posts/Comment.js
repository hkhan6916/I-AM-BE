const { ObjectId } = require('mongoose').Types;
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
  const comments = await Comment.aggregate([
    {
      $match: {
        postId: ObjectId(postId),
      },
    },
    { $sort: { likes: -1 } },
    { $skip: offset },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'commentAuthor',
      },
    },
    {
      $project: {
        _id: 1,
        postId: 1,
        userId: 1,
        firstName: 1,
        lastName: 1,
        body: 1,
        likes: 1,
        replyingToId: 1,
        commentAuthor: {
          firstName: 1,
          lastName: 1,
          profileGifUrl: 1,
          jobTitle: 1,
        },
      },
    },
  ]);

  return comments;
};

const replyToComment = async ({ commentId, body, userId }) => {
  const comment = await Comment.findById(commentId);
  const user = await User.findById(userId);

  if (!body) {
    throw new Error('Reply body is required.');
  }

  if (!comment) {
    throw new Error('Could not find a comment with that ID');
  }

  if (!user) {
    throw new Error('Could not find user to post this comment reply');
  }

  if (!comment.parentCommentId) {
    const reply = new Comment({
      postId: comment.postId,
      parentCommentId: comment._id,
      userId,
      body,
    });

    reply.save();

    return 'Replied to comment.';
  }

  const reply = new Comment({
    postId: comment.postId,
    parentCommentId: comment.parentCommentId,
    userId,
    body,
    replyingToId: comment.userId,
  });

  reply.save();

  return 'Replied to reply';
};

const getCommentReplies = async (commentId, offset) => {
  if (!commentId) {
    throw new Error('Id for comment is required.');
  }
  const replies = await Comment.aggregate([
    {
      $match: {
        parentCommentId: ObjectId(commentId),
      },
    },
    { $sort: { likes: -1 } },
    { $skip: offset },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'replyAuthor',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'replyingToId',
        foreignField: '_id',
        as: 'replyingToObj',
      },
    },
    {
      $project: {
        _id: 1,
        postId: 1,
        userId: 1,
        firstName: 1,
        lastName: 1,
        body: 1,
        likes: 1,
        replyingToId: 1,
        replyingToObj: {
          firstName: 1,
          lastName: 1,
          jobTitle: 1,
        },
        replyAuthor: {
          firstName: 1,
          lastName: 1,
          profileGifUrl: 1,
          jobTitle: 1,
        },
      },
    },
  ]);

  return replies;
};

module.exports = {
  addComment,
  getPostComments,
  replyToComment,
  getCommentReplies,
};
