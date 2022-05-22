const { Schema, model } = require('mongoose');

const validateArrayLimit = (array) => array.length === 2;

const ChatSchema = new Schema({
  participants: {
    type: Array,
    validate: [validateArrayLimit, 'Chats must have 2 participants.'],
  },
  upToDateUsers: {
    type: Array,
    default: [],
  },
}, { timestamps: true });

module.exports = model('chat', ChatSchema);
