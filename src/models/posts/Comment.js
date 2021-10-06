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
  likes: {
    type: Number,
    default: 0,
  },
  parentCommentId: {
    type: Schema.Types.ObjectId, // if not populated, then its a top level comment
  },
},
{ timestamps: true });
module.exports = model('Comment', CommentSchema);
