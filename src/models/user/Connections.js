const { Schema, model } = require('mongoose');

const ConnectionsSchema = new Schema({
  requesterId: {
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
