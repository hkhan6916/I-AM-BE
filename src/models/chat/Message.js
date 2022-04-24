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
  },
  mediaUrl: {
    type: String,
  },
  thumbnailUrl: {
    type: String,
  },
  ready: {
    type: Boolean,
  },
  cancelled: { type: Boolean },
  mediaType: {
    type: String,
  },
  stringTime: {
    type: String,
    required: true,
  },
  stringDate: {
    type: String,
    require: true,
  },
},
{ timestamps: true });
module.exports = model('messages', MessagesSchema);
