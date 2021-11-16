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
  body: {
    type: String,
    required: true,
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
  // replyingTo: [{
  //   userId: {
  //     type: Schema.Types.ObjectId,
  //     required: true,
  //   },
  //   replyId: {
  //     type: Schema.Types.ObjectId,
  //     required: true,
  //   },
  // }],
},
{ timestamps: true });
module.exports = model('Comment', CommentSchema);
