const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  profileVideoUrl: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedDate: {
    type: Date,
  },
  suspended: {
    type: Boolean,
    default: false,
  },
  suspendedDate: {
    type: Date,
  },
  connections: {
    type: Array,
    default: [],
  },
  friendRequests: {
    type: Array,
    default: [],
  },
});
module.exports = model('Users', UserSchema);
