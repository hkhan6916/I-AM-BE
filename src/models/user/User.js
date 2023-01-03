const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    maxLength: 30,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    maxLength: 200,
    unique: true,
  },
  usernameLowered: {
    type: String,
    required: true,
    unique: true,
    maxLength: 200,
  },
  emailLowered: {
    type: String,
    required: true,
    unique: true,
    maxLength: 200,
  },
  password: {
    type: String,
    required: true,
    maxLength: 200,
  },
  profileVideoUrl: {
    type: String,
    maxLength: 200,
  },
  profileGifUrl: {
    type: String,
    maxLength: 200,
  },
  profileImageUrl: {
    type: String,
    maxLength: 200,
  },
  firstName: {
    type: String,
    required: true,
    text: true,
    maxLength: 40,
  },
  lastName: {
    type: String,
    required: true,
    text: true,
    maxLength: 40,
  },
  jobTitle: {
    type: String,
    text: true,
    maxLength: 40,
  },
  bio: {
    type: String,
    text: true,
    maxLength: 500,
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
  verificationCode: {
    type: String,
    maxLength: 6,
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
    maxLength: 200,
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
    maxLength: 200,
  },
  private: {
    type: Boolean,
    default: false,
  },
  followersMode: {
    type: Boolean,
    default: false,
  },
  unreadChatsCount: {
    type: Number,
    default: 0,
  },
  reportsCount: {
    type: Number,
    default: 0,
  },
  underWatch: {
    type: Boolean,
  },
  flipProfileVideo: {
    type: Boolean,
    default: false,
  },
  numberOfJobHistoryRecords: {
    type: Number,
    default: 0,
  },
  numberOfEducationHistoryRecords: {
    type: Number,
    default: 0,
  },
  lastPasswordChangedDateTime: {
    type: Date,
  },
});
module.exports = model('Users', UserSchema);
