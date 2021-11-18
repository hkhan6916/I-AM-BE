const { Schema, model } = require('mongoose');

const CommentLikesSchema = new Schema({
  commentId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  likedBy: {
    type: Schema.Types.ObjectId,
    required: true,
  },
});
module.exports = model('CommentLikes', CommentLikesSchema);
