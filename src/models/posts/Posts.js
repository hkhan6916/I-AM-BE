const { Schema, model } = require('mongoose');

const PostsSchema = new Schema({
  body: {
    type: String,
    maxLength: 2000,
  },
  mediaUrl: {
    type: String,
    maxLength: 200,
  },
  thumbnailUrl: {
    type: String,
    maxLength: 200,
  },
  mediaKey: {
    type: String,
    default: '',
    maxLength: 200,
  },
  gif: {
    type: String,
    maxLength: 200,
  },
  gifPreview: {
    type: String,
    maxLength: 200,
  },
  thumbnailKey: {
    type: String,
    default: '',
    maxLength: 200,
  },
  mediaMimeType: {
    type: String,
    maxLength: 20,
  },
  mediaType: {
    type: String,
    maxLength: 20,
  },
  height: { type: Number },
  width: { type: Number },
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
  failed: {
    type: Boolean,
  },
  edited: {
    type: Boolean,
  },
  numberOfComments: {
    type: Number,
    default: 0,
  },
},
{ timestamps: true });
module.exports = model('Posts', PostsSchema);
