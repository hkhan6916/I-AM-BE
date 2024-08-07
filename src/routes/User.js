const express = require('express');

const router = express.Router();

const {
  registerUser,
  createUserPasswordReset,
  resetUserPassword,
  loginUser,
  getUserData,
  updateUserDetails,
  checkUserExists,
  deleteUser,
  changeAccountVisibility,
  toggleFollowersMode,
  reportUser,
  blockUser,
  unBlockUser,
  verifyRegisterationDetails,
  createEmailVerification,
  verifyUserEmail,
} = require('../services/User/User');
const {
  sendFriendRequest, recallFriendRequest, acceptFriendRequest,
  rejectFriendRequest, removeConnection, searchUser, getUserFriends,
  getSingleUser,
  getUserFriendRequests,
  getOtherUserFriends,
  searchUserContacts,
} = require('../services/User/Friends');
const { getUserFeed } = require('../services/User/Feed');
const { getUserPosts, getOtherUserPosts } = require('../services/User/Posts');
const { getUserChats, deleteUserMessage, getUserChat } = require('../services/User/Chat');
const { updateNotificationToken, deleteNotificationToken } = require('../services/User/Notifications');
const verifyAuth = require('../middleware/auth');
const {
  addToUserJobHistory, removeFromUserJobHistory, updateUserJobHistoryRecord, getUserJobHistory,
} = require('../services/User/JobHIstory');
const {
  addToUserEducationHistory, getUserEducationHistory, updateUserEducationHistoryRecord, removeFromUserEducationHistory,
} = require('../services/User/EducationHIstory');
const {
  getSingleUserFeedback,
  createUserFeedback, deleteUserFeedback, updateUserFeedback, getUserFeedbacks,
} = require('../services/User/UserFeedback');

// const storage = multer.memoryStorage();

router.post('/user/login', async (req, res) => {
  let success = true;
  let message = 'User logged in.';
  let data = {};
  const { identifier, password } = req.body;
  try {
    data = await loginUser(identifier, password);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/verify-registeration-details', async (req, res) => {
  let success = true;
  let message = 'User details verified.';
  let data = {};

  const {
    username, email, password: plainTextPassword, lastName, firstName, notificationToken, jobTitle, profileVideoFileName, profileGifFileName, profileImageFileName,
  } = req.body;

  try {
    data = await verifyRegisterationDetails({
      username, email, plainTextPassword, firstName, lastName, notificationToken, jobTitle, profileVideoFileName, profileGifFileName, profileImageFileName,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/register', async (req, res) => {
  const {
    username, email, password: plainTextPassword, lastName, firstName, notificationToken, jobTitle, flipProfileVideo, profileVideoKey, profileGifKey, profileImageKey,
  } = req.body;
  let success = true;
  let message = 'User created.';
  let data = {};
  let other = {};

  try {
    data = await registerUser({
      username, email, plainTextPassword, lastName, firstName, notificationToken, jobTitle, flipProfileVideo, profileVideoKey, profileGifKey, profileImageKey,
    });
  } catch (e) {
    success = false;
    other = e.validationErrors;
    if (e.exists) {
      /* This is used for displaying a custom message on the frontend and
         should NOT be changed */
      message = 'exists';
    } else {
      message = e.message;
    }
  }

  res.status(200).json({
    success,
    message,
    data,
    other,
  });
});

router.get('/user/email/verify/:verificationCode', verifyAuth, async (req, res) => {
  const { verificationCode } = req.params;
  let success = true;
  let message = 'User email verified.';
  let data = {};
  let other = {};

  try {
    data = await verifyUserEmail(req.user.id, verificationCode);
  } catch (e) {
    success = false;
    other = e.validationErrors;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
    other,
  });
});

router.get('/user/email/create-email-verification', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Email verification created.';
  let data = {};
  let other = {};

  try {
    data = await createEmailVerification(req.user.id);
  } catch (e) {
    success = false;
    other = e.validationErrors;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
    other,
  });
});

router.get('/user/data', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User data fetched.';
  let data = {};
  try {
    data = await getUserData(req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/password/reset', async (req, res) => createUserPasswordReset(req, res));
router.post('/user/password/update', async (req, res) => resetUserPassword(req, res));

router.post('/user/feed', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User feed fetched.';
  let data = {};

  const {
    feedTimelineOffset, friendsInterestsOffset,
    connectionsAsSenderOffset, connectionsAsReceiverOffset,
  } = req.body;

  try {
    data = await getUserFeed({
      userId: req.user.id,
      feedTimelineOffset,
      friendsInterestsOffset,
      connectionsAsSenderOffset: connectionsAsSenderOffset || 0,
      connectionsAsReceiverOffset: connectionsAsReceiverOffset || 0,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/search/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Users found.';
  let data = {};
  const { searchTerm, publicUsers, avoidSameUser } = req.body;
  const { offset } = req.params;
  try {
    data = await searchUser({
      username: searchTerm, publicUsers, avoidSameUser, userId: req.user.id, offset: parseInt(offset, 10),
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/friends/search/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Users found.';
  let data = {};
  const { searchTerm, userId } = req.body;
  const { offset } = req.params;
  try {
    data = await searchUserContacts(searchTerm, (userId || req.user.id), parseInt(offset, 10));
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/friend/fetch/all', verifyAuth, async (req, res) => {
  let success = true;
  // this message looks sad :(
  let message = 'Friends fetched.';
  let data = {};
  const { friendsAsSenderOffset, friendsAsReceiverOffset } = req.body;
  try {
    data = await getUserFriends({
      userId: req.user.id,
      friendsAsSenderOffset: friendsAsSenderOffset || 0,
      friendsAsReceiverOffset: friendsAsReceiverOffset || 0,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/:userId/friend/fetch/all/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Other users friends fetched.';
  let data = {};
  const { offset, userId } = req.params;
  try {
    data = await getOtherUserFriends({ userId: req.user.id, otherUserId: userId, offset: parseInt(offset, 10) });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/:userId', verifyAuth, async (req, res) => {
  let success = true;
  // this message looks sad :(
  let message = 'Friends fetched.';
  let data = {};
  const { userId } = req.params;
  try {
    data = await getSingleUser(userId, req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/friend/request/send/:userId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Friend Request sent.';
  let data = {};
  try {
    data = await sendFriendRequest(req.user.id, req.params.userId);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/friend/request/recall/:recipientId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Friend Request recalled.';
  let data = {};
  try {
    data = await recallFriendRequest(req.user.id, req.params.recipientId);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/friend/request/reject/:requesterId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Friend Request rejected.';
  let data = {};
  try {
    data = await rejectFriendRequest(req.user.id, req.params.requesterId);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/friend/request/accept/:requesterId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Friend Request accepted.';
  let data = {};
  try {
    data = await acceptFriendRequest(req.user.id, req.params.requesterId);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/friend/requests', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Friend Requests fetched.';
  let data = {};
  try {
    const { sentOffset, receivedOffset } = req.body;
    data = await getUserFriendRequests(req.user.id, sentOffset, receivedOffset);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/friend/remove/:friendId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Connection removed.';
  let data = {};
  try {
    data = await removeConnection(req.user.id, req.params.friendId);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/posts/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User posts fetched.';
  let data = {};
  const { offset } = req.params;
  try {
    data = await getUserPosts(req.user.id, parseInt(offset, 10));
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});
router.get('/user/:userId/posts/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User posts fetched.';
  let data = {};
  const { offset, userId } = req.params;
  try {
    data = await getOtherUserPosts(userId, parseInt(offset, 10), req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/chats/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User chats fetched.';
  let data = {};
  const { offset } = req.params;
  try {
    data = await getUserChats(req.user.id, parseInt(offset, 10));
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/chat/:chatId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User chats fetched.';
  let data = {};
  const { chatId } = req.params;
  try {
    data = await getUserChat(chatId, req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/chats/delete/message/:messageId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Message deleted.';
  let data = {};
  const { messageId } = req.params;
  try {
    data = await deleteUserMessage(messageId, req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/notifications/token/update', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User notification token updated.';
  let data = {};
  const { notificationToken } = req.body;
  try {
    data = await updateNotificationToken(req.user.id, notificationToken);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/notifications/token/delete', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User notification token deleted.';
  let data = {};
  try {
    data = await deleteNotificationToken(req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/update/details', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User details updated.';
  let data = {};
  let other = {};
  const details = req.body;
  try {
    data = await updateUserDetails({
      userId: req.user.id, details,
    });
  } catch (e) {
    success = false;
    message = e.message;
    other = { validationErrors: e.validationErrors };
  }

  res.status(200).json({
    success,
    message,
    data,
    other,
  });
});

router.post('/user/check/exists', async (req, res) => {
  let success = true;
  let message = 'User checked.';
  let data = {};
  const { identifier, type, userId } = req.body;
  try {
    data = await checkUserExists({ identifier, type, userId });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.delete('/user/delete', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User deletion in progress.';
  let data = {};

  try {
    data = await deleteUser(req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/visibility/change', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User account visibility changed.';
  let data = {};
  try {
    data = await changeAccountVisibility(req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/followersmode/toggle', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Followers mode toggled.';
  let data = {};
  try {
    data = await toggleFollowersMode(req.user.id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/report', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User reported.';
  let data = {};
  const { userToReport, reason } = req.body;
  try {
    data = await reportUser(req.user.id, userToReport, reason);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/block/:userToBlockId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User blocked.';
  let data = {};
  const { userToBlockId } = req.params;
  try {
    data = await blockUser(req.user.id, userToBlockId);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/unblock/:userToUnBlockId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User unblocked.';
  let data = {};
  const { userToUnBlockId } = req.params;
  try {
    data = await unBlockUser(req.user.id, userToUnBlockId);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

// JobHistory
router.post('/user/job-history/add', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Added role to user job history.';
  let data = {};
  const {
    roleName, companyName, roleDescription, dateFrom, dateTo, city, country, roleType,
  } = req.body;
  try {
    data = await addToUserJobHistory({
      userId: req.user.id, roleName, companyName, roleDescription, dateFrom, dateTo, city, country, roleType,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/job-history/fetch/all', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Fetched user job history.';
  let data = {};
  try {
    data = await getUserJobHistory({
      userId: req.body.userId || req.user.id,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/job-history/remove/:roleId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Remove role from user job history.';
  let data = {};
  const { roleId } = req.params;
  try {
    data = await removeFromUserJobHistory({ userId: req.user.id, id: roleId });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});
router.post('/user/job-history/update/:roleId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Update role in user job history.';
  let data = {};
  const {
    roleName, companyName, roleDescription, dateFrom, dateTo, city, country, roleType,
  } = req.body;
  const { roleId } = req.params;
  try {
    data = await updateUserJobHistoryRecord({
      userId: req.user.id, roleName, companyName, roleDescription, id: roleId, dateFrom, dateTo, city, country, roleType,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

// EducationHistory
router.post('/user/education-history/add', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Added role to user education history.';
  let data = {};
  const {
    educationName, institutionName, educationDescription, dateFrom, dateTo, city = '', country = '',
  } = req.body;
  try {
    data = await addToUserEducationHistory({
      userId: req.user.id, educationName, institutionName, educationDescription, dateFrom, dateTo, city, country,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/education-history/fetch/all', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Fetched user education history.';
  let data = {};
  try {
    data = await getUserEducationHistory({
      userId: req.body.userId || req.user.id,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/education-history/remove/:educationId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Remove role from user education history.';
  let data = {};
  const { educationId } = req.params;
  try {
    data = await removeFromUserEducationHistory({ userId: req.user.id, id: educationId });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/education-history/update/:educationId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Updated role in user education history.';
  let data = {};
  const {
    educationName, institutionName, educationDescription, dateFrom, dateTo, city, country,
  } = req.body;
  const { educationId } = req.params;
  try {
    data = await updateUserEducationHistoryRecord({
      userId: req.user.id, educationName, institutionName, educationDescription, id: educationId, dateFrom, dateTo, city, country,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.post('/user/feedback/create', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Created user feedback.';
  let data = {};
  const {
    description, type,
  } = req.body;
  try {
    data = await createUserFeedback({
      userId: req.user.id, description, type,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});
router.get('/user/feedback/delete/:id', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Deleted user feedback.';
  let data = {};
  const {
    id,
  } = req.params;
  try {
    data = await deleteUserFeedback(id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});
router.post('/user/feedback/update/:id', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Updated user feedback.';
  let data = {};
  const {
    description, type, completed,
  } = req.body;
  const {
    id,
  } = req.params;
  try {
    data = await updateUserFeedback({
      userId: req.user.id, description, type, completed, id,
    });
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/feedback/:id', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Fetched user feedback.';
  let data = {};
  const {
    id,
  } = req.params;
  try {
    data = await getSingleUserFeedback(id);
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

router.get('/user/feedback/all/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Fetched user feedbacks.';
  let data = {};
  const {
    offset,
  } = req.params;
  try {
    data = await getUserFeedbacks(parseInt(offset, 10));
  } catch (e) {
    success = false;
    message = e.message;
  }

  res.status(200).json({
    success,
    message,
    data,
  });
});

module.exports = router;
