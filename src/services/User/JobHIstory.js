const { ObjectId } = require('mongoose').Types;
const UserJobHistory = require('../../models/user/JobHIstory');
const User = require('../../models/user/User');

const addToUserJobHistory = async ({
  userId, roleName, companyName, roleDescription, dateFrom, dateTo, city = '', country = '', roleType,
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist.');
  }

  if (new Date(dateFrom) > new Date()) {
    throw new Error('From date cannot be in the future');
  }
  if (new Date(dateTo) > new Date()) {
    throw new Error('To date cannot be in the future');
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
    userId, roleName, companyName, roleDescription, dateFrom, dateTo, city, country, roleType,
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

  const sortedUserJobHistory = userJobHistory.reduce((prev, record) => {
    if (!record.dateTo) {
      prev.unshift(record);
    } else {
      prev.push(record);
    }
    return prev;
  }, []);

  return sortedUserJobHistory;
};

const updateUserJobHistoryRecord = async ({
  userId, roleName, companyName, roleDescription, id, dateFrom, dateTo, city = '', country = '', roleType,
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  if (dateFrom && new Date(dateFrom) > new Date()) {
    throw new Error('From date cannot be in the future');
  }
  if (dateTo && new Date(dateTo) > new Date()) {
    throw new Error('To date cannot be in the future');
  }

  const dataToUpdate = Object.fromEntries(Object.entries({
    roleName, companyName, roleDescription, dateFrom, dateTo, city, country, roleType,
  }).filter(([_, v]) => v !== null && v !== undefined));

  const userJobHistoryRecord = await UserJobHistory.findOneAndUpdate(
    {
      $and: [{
        userId,
      }, {
        _id: ObjectId(id),
      }],
    },
    {
      $set: dataToUpdate,
    },
  );

  if (!userJobHistoryRecord) {
    throw new Error('User Job History record either not found or it does not belong to this user.');
  }

  return { ...userJobHistoryRecord.toObject(), ...(dataToUpdate || {}) };
};

const removeFromUserJobHistory = async ({
  userId, id,
}) => {
  if (!userId || !id) {
    throw new Error('User id was not provided');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist.');
  }

  const userJobHistoryRecord = await UserJobHistory.findOneAndDelete({ _id: id, userId });

  if (!userJobHistoryRecord) {
    throw new Error('User Job History record either not found or it does not belong to this user.');
  }

  user.numberOfJobHistoryRecords -= 1;
  user.save();

  return 'Removed from user job history';
};

module.exports = {
  addToUserJobHistory,
  removeFromUserJobHistory,
  updateUserJobHistoryRecord,
  getUserJobHistory,
};
