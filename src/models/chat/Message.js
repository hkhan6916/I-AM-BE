const { Schema, model } = require('mongoose');

const MessagesSchema = new Schema({
  senderId: {
    required: true,
    type: Schema.Types.ObjectId,
  },
  chatId: {
    required: true,
    type: String,
  },
  body: {
    type: String,
  },
  mediaUrl: {
    type: String,
  },
});
module.exports = model('messages', MessagesSchema);
