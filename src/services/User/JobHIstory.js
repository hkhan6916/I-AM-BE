const { ObjectId } = require('mongoose').Types;
const UserJobHistory = require('../../models/user/JobHIstory');

const addToUserJobHistory = async ({
  userId, roleName, companyName, roleDescription,
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const userJobHistory = await UserJobHistory.find({
    userId,
  }).limit(20);

  if (!roleName) {
    throw new Error('roleName is required.');
  }

  if ((userJobHistory?.length || 0) >= 20) {
    throw new Error(`User cannot have more than 20 jobs in their Job History. User has currently created ${userJobHistory?.length} roles for their Job History.`);
  }

  const newJobRole = await UserJobHistory.create({
    userId, roleName, companyName, roleDescription,
  });

  return newJobRole;
};

const getUserJobHistory = async ({
  userId,
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const userJobHistory = await UserJobHistory.find({
    userId,
  }).limit(20);

  return userJobHistory;
};

const updateUserJobHistoryRecord = async ({
  userId, roleName, companyName, roleDescription, id,
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const dateToUpdate = Object.fromEntries(Object.entries({ roleName, companyName, roleDescription }).filter(([_, v]) => !!v));

  const userJobHistoryRecord = await UserJobHistory.findOneAndUpdate(
    {
      $and: [{
        userId,
      }, {
        _id: ObjectId(id),
      }],
    },
    {
      $set: dateToUpdate,
    },
  );

  if (!userJobHistoryRecord) {
    throw new Error('User Job History record either not found or it does not belong to this user.');
  }

  return { ...userJobHistoryRecord.toObject(), ...(dateToUpdate || {}) };
};

const removeFromUserJobHistory = async ({
  userId, id,
}) => {
  if (!userId || !id) {
    throw new Error('User id was not provided');
  }

  const userJobHistoryRecord = await UserJobHistory.findOneAndDelete({ _id: id, userId });

  if (!userJobHistoryRecord) {
    throw new Error('User Job History record either not found or it does not belong to this user.');
  }

  return 'Removed from user job history';
};

module.exports = {
  addToUserJobHistory,
  removeFromUserJobHistory,
  updateUserJobHistoryRecord,
  getUserJobHistory,
};
