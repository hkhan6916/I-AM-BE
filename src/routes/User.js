const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');

const {
  registerUser, createUserPasswordReset, resetUserPassword, loginUser, getUserData,
} = require('../services/User/User');
const {
  sendFriendRequest, recallFriendRequest, acceptFriendRequest,
  rejectFriendRequest, removeConnection, searchUser, getUserFriends,
  resetUserFriendsList, getSingleUser,
  getUserFriendRequests,
} = require('../services/User/Friends');
const { getUserFeed } = require('../services/User/Feed');
const { getUserPosts } = require('../services/User/Posts');
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
    username, email, password: plainTextPassword, lastName, firstName,
  } = req.body;
  let success = true;
  let message = 'User created.';
  let data = {};

  try {
    data = await registerUser({
      username, email, plainTextPassword, lastName, firstName, file: req.file,
    });
  } catch (e) {
    await tmpCleanup();
    success = false;
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

router.post('/users/password/:email', async (req, res) => createUserPasswordReset(req, res));
router.post('/user/password', async (req, res) => resetUserPassword(req, res));

router.post('/user/feed', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User feed fetched.';
  let data = {};

  const { feedTimelineOffset, friendsInterestsOffset } = req.body;

  try {
    data = await getUserFeed({
      userId: req.user.id,
      feedTimelineOffset,
      friendsInterestsOffset,
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

router.get('/user/search/:username', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Users found.';
  let data = {};
  const { username } = req.params;
  try {
    data = await searchUser(username);
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

router.get('/user/friend/fetch/all', verifyAuth, async (req, res) => {
  let success = true;
  // this message looks sad :(
  let message = 'Friends fetched.';
  let data = {};
  try {
    data = await getUserFriends(req.user.id);
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

// TODO: delete this when no longer needed.
router.get('/user/friend/reset/:id', async (req, res) => {
  let success = true;
  let message = 'Friend List Reset.';
  let data = {};
  try {
    data = await resetUserFriendsList(req.params.id);
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
    data = await getUserPosts(req.user.id, offset);
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
