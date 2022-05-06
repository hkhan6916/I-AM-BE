const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');
// todo delete this once done generating data
const faker = require('faker');
const fileUpload = require('express-fileupload');

const {
  registerUser,
  createUserPasswordReset,
  resetUserPassword,
  loginUser,
  getUserData,
  updateUserDetails,
  checkUserExists,
  generateData,
  deleteUser,
  changeAccountVisibility,
  toggleFollowersMode,
  reportUser,
} = require('../services/User/User');
const {
  sendFriendRequest, recallFriendRequest, acceptFriendRequest,
  rejectFriendRequest, removeConnection, searchUser, getUserFriends,
  getSingleUser,
  getUserFriendRequests,
  getOtherUserFriends,
} = require('../services/User/Friends');
const { getUserFeed } = require('../services/User/Feed');
const { getUserPosts, getOtherUserPosts } = require('../services/User/Posts');
const { getUserChats, deleteUserMessage, getUserChat } = require('../services/User/Chat');
const { updateNotificationToken } = require('../services/User/Notifications');
const verifyAuth = require('../middleware/auth');
const { tmpCleanup } = require('../helpers');

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

router.post('/user/register', fileUpload({
  abortOnLimit: true,
  limits: { fileSize: 50 * 1024 * 1024 },
}), async (req, res) => {
  const {
    username, email, password: plainTextPassword, lastName, firstName, notificationToken, jobTitle,
  } = req.body;
  let success = true;
  let message = 'User created.';
  let data = {};
  let other = {};

  try {
    data = await registerUser({
      username, email, plainTextPassword, lastName, firstName, file: req.files?.file, notificationToken, jobTitle,
    });
  } catch (e) {
    await tmpCleanup();
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

router.post('/user/generate', async (req, res) => {
  // const {
  //   username, email, password: plainTextPassword, lastName, firstName, notificationToken,
  // } = req.body;
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const username = faker.internet.userName(firstName, lastName);
  const notificationToken = 'test';
  const email = faker.internet.email();
  const plainTextPassword = 'password';

  let success = true;
  let message = 'User generated.';
  let data = {};
  let other = {};

  try {
    data = await generateData({
      username, email, plainTextPassword, lastName, firstName, notificationToken,
    });
  } catch (e) {
    await tmpCleanup();
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
  const { searchTerm } = req.body;
  const { offset } = req.params;
  try {
    data = await searchUser(searchTerm, parseInt(offset, 5));
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

router.get('/user/friend/requests', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Friend Requests fetched.';
  let data = {};
  try {
    data = await getUserFriendRequests(req.user.id);
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

router.post('/user/update/details', [verifyAuth, fileUpload({
  abortOnLimit: true,
  limits: { fileSize: 50 * 1024 * 1024 },
})], async (req, res) => {
  let success = true;
  let message = 'User details updated.';
  let data = {};
  let other = {};
  const details = req.body;
  try {
    data = await updateUserDetails({ userId: req.user.id, file: req.files?.file, details });
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

module.exports = router;
