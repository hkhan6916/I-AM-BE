const { Schema, model } = require('mongoose');

const validateArrayLimit = (array) => array.length === 2;

const ChatSchema = new Schema({
  participants: {
    type: Array,
    validate: [validateArrayLimit, 'Chats must have 2 participants.'],
  },
  upToDateUsers: { // what if user is offline? Can't send request then. Should be fine. Will show some modal or splashscreen when user is not connected to wifi.
    type: Array,
    default: [],
  },
}, { timestamps: true });

module.exports = model('chat', ChatSchema);
