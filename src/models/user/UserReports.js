const { Schema, model } = require('mongoose');

const UserReportsSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  reason: {
    type: Number,
    required: true,
  },
});
module.exports = model('UserReports', UserReportsSchema);
