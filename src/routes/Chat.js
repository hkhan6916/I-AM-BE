const express = require('express');

const router = express.Router();
const verifyAuth = require('../middleware/auth');

const {
  getChatMessages, createChat, checkChatExists,
} = require('../services/Chat/Chat');

router.get('/chat/:chatId/messages/:offset', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Chat messages fetched.';
  let data = {};
  const { chatId, offset } = req.params;
  try {
    data = await getChatMessages(chatId, parseInt(offset, 10), req.user.id);
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

router.post('/chat/new', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Chat created.';
  let data = {};
  const { participants } = req.body;
  try {
    data = await createChat([...participants, req.user.id], req.user.id);
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

router.post('/chat/exists', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Chat checked.';
  let data = {};
  const { participants } = req.body;
  try {
    data = await checkChatExists([...participants, req.user.id]);
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
