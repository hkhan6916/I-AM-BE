const express = require('express');

const router = express.Router();
const multer = require('multer');
const { v4: uuid } = require('uuid');

const {
  registerUser, createUserPasswordReset, resetUserPassword, loginUser,
} = require('../services/User/User');
const { sendFriendRequest, acceptFriendRequest, searchUser } = require('../services/User/Connections');
const { getUserFeed } = require('../services/User/Feed');
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

router.post('/users/password/:email', async (req, res) => createUserPasswordReset(req, res));
router.post('/user/password', async (req, res) => resetUserPassword(req, res));
router.get('/user/feed', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'User feed fetched.';
  let data = {};
  try {
    data = await getUserFeed(req.user);
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

router.get('/user/friend/request/:userId', verifyAuth, async (req, res) => {
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

router.get('/user/friend/accept/:requesterId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Friend Request accepted.';
  let data = {};
  try {
    console.log(req.user.id);
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
module.exports = router;
