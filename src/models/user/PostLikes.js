const { Schema, model } = require('mongoose');

const PostLikesSchema = new Schema({
  postId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  likedBy: {
    type: Schema.Types.ObjectId,
    required: true,
  },
});
module.exports = model('PostLikes', PostLikesSchema);
