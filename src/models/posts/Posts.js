const { Schema, model } = require('mongoose');

const PostsSchema = new Schema({
  body: {
    type: String,
  },
  mediaUrl: {
    type: String,
  },
  thumbnailUrl: {
    type: String,
  },
  mediaKey: {
    type: String,
    default: '',
  },
  thumbnailKey: {
    type: String,
    default: '',
  },
  mediaMimeType: {
    type: String,
  },
  mediaType: {
    type: String,
  },
  mediaIsSelfie: {
    type: Boolean,
  },
  repostPostId: {
    type: Schema.Types.ObjectId,
  },
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  likes: {
    type: Number,
    default: 0,
  },
  reports: {
    type: Number,
    default: 0,
  },
  private: {
    type: Boolean,
  },
  hidden: {
    type: Boolean,
    default: false,
  },
  ready: {
    type: Boolean,
  },
  cancelled: {
    type: Boolean,
  },
  numberOfComments: {
    type: Number,
    default: 0,
  },
},
{ timestamps: true });
module.exports = model('Posts', PostsSchema);
