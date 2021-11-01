const { Schema, model } = require('mongoose');

const UserLikesSchema = new Schema({
  posts: {
    type: Array,
    required: true,
    default: [],
  },
  likedBy: {
    type: String,
    required: true,
  },
});
module.exports = model('UserLikes', UserLikesSchema);
