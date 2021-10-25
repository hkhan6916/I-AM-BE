const { Schema, model } = require('mongoose');

const JobTitleSchema = new Schema({
  title: {
    type: String,
  },
});
module.exports = model('job_titles', JobTitleSchema);
