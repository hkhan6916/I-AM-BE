const express = require('express');

const router = express.Router();
const verifyAuth = require('../middleware/auth');

const { searchJobTitle } = require('../services/Jobs/JobTitle');

router.get('/jobs/title/:searchVal', verifyAuth, async (req, res) => {
  let success = true;
  let message = 'Job titles found.';
  let data = {};
  const { searchVal } = req.params;
  try {
    data = await searchJobTitle(searchVal);
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
