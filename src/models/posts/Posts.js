const { Schema, model } = require('mongoose');

const PostsSchema = new Schema({
  body: {
    type: String,
  },
  mediaUrl: {
    type: String,
  },
  mediaKey: {
    type: String,
    default: '',
  },
  mediaMimeType: {
    type: String,
  },
  mediaType: {
    type: String,
  },
  mediaOrientation: {
    type: String,
  },
  mediaIsSelfie: {
    type: Boolean,
  },
  repostPostId: {
    type: Schema.Types.ObjectId,
  },
  repostPostObj: {
    type: Object,
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
},
{ timestamps: true });
module.exports = model('Posts', PostsSchema);
