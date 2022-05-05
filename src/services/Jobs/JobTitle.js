const JobTitle = require('../../models/jobs/JobTitle');

const searchJobTitle = async (searchQuery) => {
  // const titles = await JobTitle.find({ title: { $regex: searchVal, $options: 'i' } }, 'title').limit(5);

  const titles = await JobTitle.aggregate([
    {
      $search: {
        index: 'default',
        compound: {
          should: [
            {
              autocomplete: {
                query: searchQuery,
                path: 'title',
              },
            },
          ],
        },
      },
    },
    { $limit: 5 },
  ]);

  if (!titles.length) {
    throw new Error('No job titles found.');
  }

  return titles;
};
module.exports = {
  searchJobTitle,
};
