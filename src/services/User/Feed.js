const User = require('../../models/user/User');
// WIP TODO finish this off once able to add connections and posts.
const getUserFeed = async (auth) => {
  const user = await User.findById(auth?.id);
  let data = {};
  if (user) {
    User.find({
      _id: {
        $in: user.connections,
      },
    }, (err, docs) => {
      if (err) {
        throw new Error(err);
      }
      data = docs;
    });
  } else {
    throw new Error('user does not exist');
  }

  return data;
};

module.exports = {
  getUserFeed,
};
