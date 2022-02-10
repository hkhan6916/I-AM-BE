const { Schema, model } = require('mongoose');

const PostReportsSchema = new Schema({
  postId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  reason: {
    type: Number,
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
});
module.exports = model('PostReports', PostReportsSchema);
