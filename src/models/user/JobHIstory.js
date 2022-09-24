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
});
module.exports = model('UserJobHistory', UserJobHistorySchema);
