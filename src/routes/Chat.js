const express = require('express');

const router = express.Router();
const verifyAuth = require('../middleware/auth');

const { getChatMessages } = require('../services/Chat/Chat');

router.get('/chat/:chatId/messages/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Job titles found.';
  let data = {};
  const { chatId, offset } = req.params;
  try {
    data = await getChatMessages(chatId, parseInt(offset, 10));
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
