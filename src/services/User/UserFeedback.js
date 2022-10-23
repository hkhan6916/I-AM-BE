const UserFeedback = require('../../models/user/UserFeedback');

const createUserFeedback = async ({ userId, description, type }) => {
  // Below error handling is handled in model but better to have custom error message
  if (type !== 'general' && type !== 'idea') {
    throw new Error('Type must be either "general" or "idea".');
  }
  const userFeedback = await UserFeedback.create({
    userId,
    description,
    type,
  });
  return userFeedback;
};

// test this
const getUserFeedbacks = async (offset) => {
  const feedbacks = await UserFeedback.aggregate([
    { $sort: { createdAt: -1 } },
    { $skip: offset || 0 },
    { $limit: 10 }]);
  return feedbacks;
};

// test this
const getSingleUserFeedback = async (feedbackId) => {
  const feedback = await UserFeedback.findById(feedbackId);
  if (!feedback) {
    throw new Error('Feedback does not exist');
  }
  return feedback;
};

const updateUserFeedback = async ({
  id, description, type, completed,
}) => {
  if (type && type !== 'general' && type !== 'idea') {
    throw new Error('Type must be either "general" or "idea".');
  }
  const fields = { description, type, completed };
  // removes nullish/empty/undefined fields
  const fieldsToUpdate = Object.fromEntries(Object.entries(fields).filter(([_, v]) => v != null));

  const userFeedback = await UserFeedback.findByIdAndUpdate(id, fieldsToUpdate);
  if (!userFeedback) {
    throw new Error('User feedback does not exist');
  }
  return { ...userFeedback.toObject(), ...fieldsToUpdate };
};

const deleteUserFeedback = async (id) => {
  const userFeedback = await UserFeedback.findByIdAndDelete(id);
  if (userFeedback) {
    throw new Error('User feedback does not exist');
  }
  return userFeedback;
};

module.exports = {
  createUserFeedback,
  updateUserFeedback,
  deleteUserFeedback,
  getUserFeedbacks,
  getSingleUserFeedback,
};
