const { Schema, model } = require('mongoose');

const MessagesSchema = new Schema({
  senderId: {
    required: true,
    type: Schema.Types.ObjectId,
  },
  chatId: {
    required: true,
    type: Schema.Types.ObjectId,
  },
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
  ready: {
    type: Boolean,
    default: false,
  },
  failed: {
    type: Boolean,
  },
  cancelled: {
    type: Boolean,
  },
  mediaType: {
    type: String,
    maxLength: 100,
  },
  stringTime: {
    type: String,
    required: true,
    maxLength: 100,
  },
  stringDate: {
    type: String,
    require: true,
    maxLength: 100,
  },
},
{ timestamps: true });
module.exports = model('messages', MessagesSchema);
