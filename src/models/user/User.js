const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  usernameLowered: {
    type: String,
    required: true,
    unique: true,
  },
  emailLowered: {
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
  profileGifUrl: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
    text: true,
  },
  lastName: {
    type: String,
    required: true,
    text: true,
  },
  jobTitle: {
    jobTitle: String,
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
  friendRequestsReceived: {
    type: Array,
    default: [],
  },
  friendRequestsSent: {
    type: Array,
    default: [],
  },
  notificationToken: {
    type: String,
    required: true,
  },
});
module.exports = model('Users', UserSchema);
