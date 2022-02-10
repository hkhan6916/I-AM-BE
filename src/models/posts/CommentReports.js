const { Schema, model } = require('mongoose');

const CommentReportsSchema = new Schema({
  commentId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  reason: {
    type: Number,
    required: true,
  },
  userId: {
    type: Number,
    required: true,
  },
});
module.exports = model('CommentReports', CommentReportsSchema);
