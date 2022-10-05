const { Schema, model } = require('mongoose');

const UserJobHistorySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  roleName: {
    type: String,
    required: true,
    maxLength: 40,
  },
  companyName: {
    type: String,
    required: true,
    maxLength: 40,
  },
  roleDescription: {
    type: String,
    maxLength: 2000,
  },
  dateFrom: {
    type: Date,
    required: true,
  },
  dateTo: {
    type: Date,
  },
  city: {
    type: String,
    maxLength: 40,
  },
  country: {
    type: String,
    maxLength: 40,
  },
  roleType: {
    type: String,
    maxLength: 40,
  },
});
module.exports = model('user_job_histories', UserJobHistorySchema);
