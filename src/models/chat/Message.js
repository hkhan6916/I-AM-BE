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
