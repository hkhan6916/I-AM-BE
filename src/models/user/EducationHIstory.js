const { Schema, model } = require('mongoose');

const UserEducationHistorySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  educationName: {
    type: String,
    required: true,
    maxLength: 40,
  },
  institutionName: {
    type: String,
    maxLength: 40,
    required: true,
  },
  educationDescription: {
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
});
module.exports = model('user_education_histories', UserEducationHistorySchema);
