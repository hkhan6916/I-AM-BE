const { Schema, model } = require('mongoose');

const BlockedUsersSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  blockedUserId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
}, { timestamps: true });
module.exports = model('blocked_users', BlockedUsersSchema);
