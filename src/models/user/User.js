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
    type: String,
    text: true,
  },
  numberOfFriendsAsRequester: {
    type: Number,
    default: 0,
  },
  numberOfFriendsAsReceiver: {
    type: Number,
    default: 0,
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
  notificationToken: {
    type: String,
    required: true,
  },
  terminated: {
    type: Boolean,
    default: false,
  },
  numberOfPosts: {
    type: Number,
    default: 0,
  },
  expireToken: {
    type: Number,
  },
  resetToken: {
    type: String,
  },
  private: {
    type: Boolean,
    default: false,
  },
  followersMode: {
    type: Boolean,
    default: false,
  },
});
module.exports = model('Users', UserSchema);
