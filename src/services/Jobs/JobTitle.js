const JobTitle = require('../../models/jobs/JobTitle');

const searchJobTitle = async (searchVal) => {
  const titles = await JobTitle.find({ title: { $regex: searchVal, $options: 'i' } }, 'title').limit(10);

  if (!titles.length) {
    throw new Error('No job titles found.');
  }

  return titles;
};
module.exports = {
  searchJobTitle,
};
