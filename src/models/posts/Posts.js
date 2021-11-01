const { Schema, model } = require('mongoose');

const PostsSchema = new Schema({
  body: {
    type: String,
  },
  mediaUrl: {
    type: String,
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
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  likes: {
    type: Number,
    default: 0,
  },
  private: {
    type: Boolean,
  },
  age: {
    type: Object,
  },
},
{ timestamps: true });
module.exports = model('Posts', PostsSchema);
