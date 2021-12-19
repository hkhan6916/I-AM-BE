const express = require('express');

const router = express.Router();
const verifyAuth = require('../middleware/auth');

const { sendNotificationToRecipiants } = require('../services/Notifications/Notifications');

router.post('/notification/send', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Notification sent.';
  let data = {};
  const { chatId, senderId, body } = req.body;
  try {
    data = await sendNotificationToRecipiants(senderId, chatId, body);
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
