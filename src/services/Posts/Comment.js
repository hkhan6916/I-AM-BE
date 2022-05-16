const { ObjectId } = require('mongoose').Types;
const { v4: uuid } = require('uuid');
const Comment = require('../../models/posts/Comment');
const Posts = require('../../models/posts/Posts');
const User = require('../../models/user/User');
const CommentLikes = require('../../models/posts/CommentLikes');
const CommentReports = require('../../models/posts/CommentReports');
const { calculateAge, getFileSignedHeaders } = require('../../helpers');

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
    body,
  });

  post.numberOfComments += 1;

  comment.save();
  post.save();
  return {
    _id: comment.id || uuid(),
    postId,
    userId,
    body,
    belongsToUser: true,
    commentAuthor: {
      profileGifUrl: user.profileGifUrl,
      firstName: user.firstName,
      lastName: user.lastName,
      profileGifHeaders: getFileSignedHeaders(user.profileGifUrl),
    },
  };
};

const updateComment = async ({ commentId, userId, body }) => {
  const comment = await Comment.findById(commentId);
  if (!body) {
    throw new Error('Body is required and must not be empty.');
  }
  if (!comment) {
    throw new Error('Comment does not exist.');
  }

  if (comment.userId.toString() !== userId) {
    throw new Error('Comment does not belong to this user.');
  }
  const newComment = await Comment.findByIdAndUpdate(comment._id, { body, edited: true });
  return newComment;
};

const removeComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new Error('Comment does not exist.');
  }

  if (comment.userId.toString() !== userId) {
    throw new Error('Comment does not belong to this user.');
  }
  const post = await Posts.findById(comment.postId);

  const parentComment = comment.parentCommentId && await Comment.findById(comment.parentCommentId);
  post.numberOfComments -= 1;

  await Comment.findByIdAndDelete(commentId);

  post.save();
  if (parentComment) {
    parentComment.replyCount -= 1;
    parentComment.save();
  }

  return 'Comment has been removed';
};

const reportComment = async ({ commentId, userId, reason }) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new Error('Comment does not exist');
  }
  const existingReport = await CommentReports.findOne({ commentId, userId });
  if (existingReport) {
    return existingReport;
  }

  const report = new CommentReports({ userId, commentId, reason });
  // if the number of reports on a comment times 6 is more than its number of likes, set as hidden.
  if (comment.reports >= 15 && comment.reports * 4 >= comment.likes) {
    comment.hidden = true;
  }
  comment.reports += 1;

  report.save();
  comment.save();

  return { report, hidden: comment.hidden };
};

const getPostComments = async ({ postId, userId, offset }) => {
  const comments = await Comment.aggregate([
    {
      $match: {
        $expr: {
          $and: [{ $eq: ['$postId', ObjectId(postId)] }, { $ne: ['$hidden', true] },
            { $eq: [{ $type: '$parentCommentId' }, 'missing'] }],
        },
      },
    },
    { $sort: { likes: -1, replyCount: -1, _id: 1 } },
    { $skip: offset || 0 },
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
      $lookup: {
        from: 'commentlikes',
        let: { likedBy: ObjectId(userId), commentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$likedBy', '$$likedBy'] },
                  { $eq: ['$commentId', '$$commentId'] }],
              },
            },
          },
          { $limit: 1 },
          {
            $project: {
              _id: 1,
              likedBy: 1,
            },
          },
        ],
        as: 'liked',
      },
    },
    {
      $unwind:
       {
         path: '$commentAuthor',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $unwind:
       {
         path: '$liked',
         preserveNullAndEmptyArrays: true,
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
        edited: 1,
        replyingToId: 1,
        replyCount: 1,
        createdAt: 1,
        belongsToUser: {
          $cond: {
            if: { $eq: ['$userId', ObjectId(userId)] },
            then: true,
            else: false,
          },
        },
        liked: {
          $cond: {
            if: { $ne: [{ $type: '$liked' }, 'missing'] },
            then: true,
            else: false,
          },
        },
        commentAuthor: {
          firstName: 1,
          lastName: 1,
          profileGifUrl: 1,
          flipProfileVideo: 1,
          jobTitle: 1,
        },
      },
    },
  ]);
  comments.forEach((comment) => {
    calculateAge(comment);
    if (comment.commentAuthor.profileGifUrl) {
      comment.commentAuthor.profileGifHeaders = getFileSignedHeaders(comment.commentAuthor.profileGifUrl);
    }
  });
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

  // if replying to a top level comment, not a reply.
  if (!comment.parentCommentId) {
    const reply = new Comment({
      postId: comment.postId,
      parentCommentId: comment._id,
      userId,
      body,
    });
    comment.replyCount += 1;
    reply.save();
    comment.save();

    return {
      _id: reply._id,
      postId: comment.postId,
      parentCommentId: comment._id,
      userId,
      body,
      belongsToUser: true,
      replyAuthor: {
        profileGifUrl: user.profileGifUrl,
        firstName: user.firstName,
        lastName: user.lastName,
        profileGifHeaders: getFileSignedHeaders(user.profileGifUrl),
      },
    };
  }

  // we need to get the parent id of the reply we are replying to so we can add 1 to the total number of replies under this parent comment
  const parentComment = await Comment.findById(comment.parentCommentId);

  const reply = new Comment({
    postId: comment.postId,
    parentCommentId: comment.parentCommentId,
    userId,
    body,
    replyingToId: comment.userId,
  });

  parentComment.replyCount += 1;
  reply.save();
  comment.save();
  parentComment.save();

  return {
    _id: reply._id,
    postId: comment.postId,
    parentCommentId: comment.parentCommentId,
    userId,
    body,
    replyingToId: comment.userId,
    replyAuthor: {
      profileGifUrl: user.profileGifUrl,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };
};

const getCommentReplies = async ({ commentId, userId, offset }) => {
  if (!commentId) {
    throw new Error('Id for comment is required.');
  }
  const replies = await Comment.aggregate([
    {
      $match: {
        parentCommentId: ObjectId(commentId),
      },
    },
    { $sort: { likes: -1, _id: 1 } },
    { $skip: offset || 0 },
    { $limit: 4 },
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
      $lookup: {
        from: 'commentlikes',
        let: { likedBy: ObjectId(userId), commentId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$likedBy', '$$likedBy'] },
                  { $eq: ['$commentId', '$$commentId'] }],
              },
            },
          },
          { $limit: 1 },
          {
            $project: {
              _id: 1,
              likedBy: 1,
            },
          },
        ],
        as: 'liked',
      },
    },
    {
      $unwind:
       {
         path: '$liked',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $unwind:
       {
         path: '$replyingToObj',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $unwind:
       {
         path: '$replyAuthor',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $project: {
        _id: 1,
        postId: 1,
        userId: 1,
        firstName: 1,
        lastName: 1,
        edited: 1,
        body: 1,
        likes: 1,
        createdAt: 1,
        belongsToUser: {
          $cond: {
            if: { $eq: ['$userId', ObjectId(userId)] },
            then: true,
            else: false,
          },
        },
        liked: {
          $cond: {
            if: { $ne: [{ $type: '$liked' }, 'missing'] },
            then: true,
            else: false,
          },
        },
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
          flipProfileVideo: 1,
          jobTitle: 1,
        },
      },
    },
  ]);
  replies.forEach((reply) => {
    calculateAge(reply);
    if (reply.replyAuthor.profileGifUrl) {
      reply.replyAuthor.profileGifHeaders = getFileSignedHeaders(reply.replyAuthor.profileGifUrl);
    }
  });
  return replies;
};

const addLikeToComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new Error('Comment does not exist.');
  }

  if (comment.userId.toString() === userId) {
    throw new Error('Cannot like this comment as it belongs to the same user.');
  }

  const likedComment = await CommentLikes.findOne({ likedBy: userId, commentId });

  if (likedComment) {
    throw new Error('User has already liked this comment.');
  }

  const like = new CommentLikes({
    likedBy: userId,
    commentId,
  });

  comment.likes += 1;
  like.save();
  comment.save();
  return 'Comment has been liked';
};

const removeLikeFromComment = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new Error('Comment does not exist.');
  }
  const likedComment = await CommentLikes.findOneAndDelete({ likedBy: userId, commentId });
  if (!likedComment) {
    throw new Error('User has not liked this post yet.');
  }

  comment.likes -= 1;
  comment.save();
  return 'Comment like has been removed';
};

module.exports = {
  addComment,
  removeComment,
  getPostComments,
  replyToComment,
  getCommentReplies,
  addLikeToComment,
  removeLikeFromComment,
  updateComment,
  reportComment,
};
