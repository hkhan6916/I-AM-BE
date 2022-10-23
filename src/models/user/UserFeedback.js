const { Schema, model } = require('mongoose');

const FeedbackSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  type: {
    type: String,
    enum: ['general', 'idea'],
    required: true,
  },
  description: {
    type: String,
    required: true,
    maxLength: 3000,
  },
  completed: {
    type: Boolean,
  },
}, { timestamps: true });
module.exports = model('user_feedbacks', FeedbackSchema);
