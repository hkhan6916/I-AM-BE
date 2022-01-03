const { Schema, model } = require('mongoose');

const ConnectionsSchema = new Schema({
  senderId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  accepted: {
    type: Boolean,
    required: true,
  },
}, { timestamps: true });
module.exports = model('connections', ConnectionsSchema);
