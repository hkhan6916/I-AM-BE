const express = require('express');

const router = express.Router();
const fileUpload = require('express-fileupload');
const verifyAuth = require('../middleware/auth');

const {
  getChatMessages, createChat, checkChatExists, uploadFileAndSendMessage, cancelMessageUpload, failMessageUpload, bulkFailMessageUpload,
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
    data = await checkChatExists([...participants, req.user.id], req.user.id);
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

router.post('/chat/message/upload', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'File uploaded and sent message.';
  let data = {};

  try {
    data = await uploadFileAndSendMessage(req.body);
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

router.get('/chat/message/fail/:messageId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Message file upload cancelled.';
  let data = {};
  const { messageId } = req.params;
  try {
    data = await failMessageUpload(messageId, req.user.id);
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

router.post('/chat/message/bulk-fail', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Bulk message file upload cancelled.';
  let data = {};
  const { messageIds } = req.body;
  try {
    data = await bulkFailMessageUpload(messageIds, req.user.id);
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

router.get('/chat/message/cancel/:messageId', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Message file upload cancelled.';
  let data = {};
  const { messageId } = req.params;
  try {
    data = await cancelMessageUpload(messageId, req.user.id);
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
