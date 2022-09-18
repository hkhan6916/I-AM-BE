const { Schema, model } = require('mongoose');

const JobTitleSchema = new Schema({
  title: {
    type: String,
    maxLength: 40,
  },
});
module.exports = model('job_titles', JobTitleSchema);
