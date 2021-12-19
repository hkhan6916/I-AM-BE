const { Schema, model } = require('mongoose');

const ChatSessionSchema = new Schema({
  chatId: {
    required: true,
    type: Schema.Types.ObjectId,
  },
  userId: {
    required: true,
    type: Schema.Types.ObjectId,
  },
},
{ timestamps: true });
module.exports = model('chat_sessions', ChatSessionSchema);
