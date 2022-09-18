const { Schema, model } = require('mongoose');

const CommentSchema = new Schema({
  postId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  edited: {
    type: Boolean,
  },
  body: {
    type: String,
    required: true,
    maxLength: 2000,
  },
  likes: {
    type: Number,
    default: 0,
  },
  parentCommentId: {
    type: Schema.Types.ObjectId, // if not populated, then its a top level comment
  },
  replyCount: {
    type: Number,
    default: 0,
  },
  replyingToId: {
    type: Schema.Types.ObjectId,
  },
  hidden: {
    type: Boolean,
    default: false,
  },
  reports: {
    type: Number,
    default: 0,
  },
},
{ timestamps: true });
module.exports = model('Comment', CommentSchema);
