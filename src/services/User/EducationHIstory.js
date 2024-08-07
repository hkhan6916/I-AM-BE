const { ObjectId } = require('mongoose').Types;
const UserEducationHistory = require('../../models/user/EducationHIstory');
const User = require('../../models/user/User');

const addToUserEducationHistory = async ({
  userId, educationName, institutionName, educationDescription, dateFrom, dateTo, city = '', country = '',
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist.');
  }

  const dateFromWithoutHours = new Date(dateFrom).setHours(0, 0, 0, 0);
  const dateToWithoutHours = new Date(dateTo).setHours(0, 0, 0, 0);

  if (dateFromWithoutHours > new Date()) {
    throw new Error('From date cannot be in the future');
  }
  if (dateToWithoutHours > new Date()) {
    throw new Error('To date cannot be in the future');
  }

  if (dateFrom && dateTo) {
    const dateToIsInvalid = (dateToWithoutHours - dateFromWithoutHours) < 0;

    if (dateToIsInvalid) {
      throw new Error('dateTo cannot be before dateFrom.');
    }
  }

  const userJobHistory = await UserEducationHistory.find({
    userId,
  }).limit(20);

  if (!educationName) {
    throw new Error('educationName is required.');
  }

  if ((userJobHistory?.length || 0) >= 20) {
    throw new Error(`User cannot have more than 20 jobs in their Job History. User has currently created ${userJobHistory?.length} roles for their Job History.`);
  }

  const newJobRole = await UserEducationHistory.create({
    userId, educationName, institutionName, educationDescription, dateFrom, dateTo, city, country,
  });
  user.numberOfEducationHistoryRecords = userJobHistory?.length + 1;
  user.save();
  return newJobRole;
};

const getUserEducationHistory = async ({
  userId,
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const userJobHistory = await UserEducationHistory.find({
    userId,
  }).limit(20).sort({ dateFrom: -1 });

  const sortedUserEducationHistory = userJobHistory.reduce((prev, record) => {
    if (!record.dateTo) {
      prev.unshift(record);
    } else {
      prev.push(record);
    }
    return prev;
  }, []);

  return sortedUserEducationHistory;
};

const updateUserEducationHistoryRecord = async ({
  userId, educationName, institutionName, educationDescription, id, dateFrom, dateTo, city = '', country = '',
}) => {
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const dataToUpdate = Object.fromEntries(Object.entries({
    educationName, institutionName, educationDescription, dateFrom, dateTo, city, country,
    // below we check if value is null. Can be empty string as that is allowed.
  }).filter(([_, v]) => v !== null && v !== undefined));

  if (dateFrom && new Date(dateFrom) > new Date()) {
    throw new Error('From date cannot be in the future');
  }
  if (dateTo && new Date(dateTo) > new Date()) {
    throw new Error('To date cannot be in the future');
  }

  const userJobHistoryRecord = await UserEducationHistory.findOneAndUpdate(
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

const removeFromUserEducationHistory = async ({
  userId, id,
}) => {
  if (!userId || !id) {
    throw new Error('User id was not provided');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist.');
  }

  const userJobHistoryRecord = await UserEducationHistory.findOneAndDelete({ _id: id, userId });

  if (!userJobHistoryRecord) {
    throw new Error('User Job History record either not found or it does not belong to this user.');
  }

  user.numberOfEducationHistoryRecords -= 1;
  user.save();

  return 'Removed from user job history';
};

module.exports = {
  addToUserEducationHistory,
  removeFromUserEducationHistory,
  updateUserEducationHistoryRecord,
  getUserEducationHistory,
};
