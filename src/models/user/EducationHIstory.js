const { Schema, model } = require('mongoose');

const UserEducationHistorySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  educationTitle: {
    type: String,
    required: true,
    maxLength: 40,
  },
  institutionName: {
    type: String,
    maxLength: 40,
  },
  educationDescription: {
    type: String,
    maxLength: 2000,
  },
});
module.exports = model('UserEducationHistory', UserEducationHistorySchema);
