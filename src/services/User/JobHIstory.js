const { ObjectId } = require('mongoose').Types;
const UserJobHistory = require('../../models/user/JobHIstory');
const User = require('../../models/user/User');

const addToUserJobHistory = async ({
  userId, roleName, companyName, roleDescription, dateFrom, dateTo,
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist.');
  }

  if (dateFrom && dateTo) {
    const dateToIsInvalid = (new Date(dateTo) - new Date(dateFrom)) < 0;

    if (dateToIsInvalid) {
      throw new Error('dateTo cannot be before dateFrom.');
    }
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
    userId, roleName, companyName, roleDescription, dateFrom, dateTo,
  });
  user.numberOfJobHistoryRecords = userJobHistory?.length + 1;
  user.save();
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
  }).limit(20).sort({ dateFrom: -1 });

  const reducedUserJobHistory = userJobHistory.reduce((prev, record) => {
    if (!record.dateTo) {
      prev.unshift(record);
    } else {
      prev.push(record);
    }
    return prev;
  }, []);

  return reducedUserJobHistory;
};

const updateUserJobHistoryRecord = async ({
  userId, roleName, companyName, roleDescription, id, dateFrom, dateTo,
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const dateToUpdate = Object.fromEntries(Object.entries({
    roleName, companyName, roleDescription, dateFrom, dateTo,
  }).filter(([_, v]) => !!v));

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
