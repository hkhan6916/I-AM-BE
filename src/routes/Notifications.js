const express = require('express');

const router = express.Router();
const verifyAuth = require('../middleware/auth');

const { sendNotificationToRecipiants } = require('../services/Notifications/Notifications');

router.get('/notification/send/:pushToken', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Job titles found.';
  let data = {};
  const { pushToken } = req.params;
  try {
    data = await sendNotificationToRecipiants(pushToken);
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
