const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');
// todo delete this once done generating data
const faker = require('faker');

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
} = require('../services/User/User');
const {
  sendFriendRequest, recallFriendRequest, acceptFriendRequest,
  rejectFriendRequest, removeConnection, searchUser, getUserFriends,
  getSingleUser,
  getUserFriendRequests,
} = require('../services/User/Friends');
const { getUserFeed } = require('../services/User/Feed');
const { getUserPosts } = require('../services/User/Posts');
const { getUserChats } = require('../services/User/Chat');
const { updateNotificationToken } = require('../services/User/Notifications');
const verifyAuth = require('../middleware/auth');
const { tmpCleanup } = require('../helpers');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'tmp/uploads');
  },
  filename: (req, file, cb) => {
    const re = /(?:\.([^.]+))?$/;
    const fileExtension = re.exec(file.originalname)[1];
    file.filename = `${uuid()}.${fileExtension}`;
    cb(null, `${file.filename}`);
  },
});

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

router.post('/user/register', multer({
  storage,
}).single('file'), async (req, res) => {
  const {
    username, email, password: plainTextPassword, lastName, firstName, notificationToken,
  } = req.body;
  let success = true;
  let message = 'User created.';
  let data = {};
  let other = {};

  try {
    data = await registerUser({
      username, email, plainTextPassword, lastName, firstName, file: req.file, notificationToken,
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

router.get('/user/friend/fetch/all/:offset', verifyAuth, async (req, res) => {
  let success = true;
  // this message looks sad :(
  let message = 'Friends fetched.';
  let data = {};
  const { offset } = req.params;
  try {
    data = await getUserFriends(req.user.id, parseInt(offset, 10));
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

router.post('/user/update/details', [verifyAuth, multer({
  storage,
}).single('file')], async (req, res) => {
  let success = true;
  let message = 'User details updated.';
  let data = {};
  let other = {};
  const details = req.body;
  try {
    data = await updateUserDetails({ userId: req.user.id, file: req.file, details });
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

module.exports = router;
