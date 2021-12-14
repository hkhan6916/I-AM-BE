const validateEmail = require('./validateEmail');
const uploadProfileVideo = require('./uploadProfileVideo');
const uploadFile = require('./uploadFile');
const tmpCleanup = require('./tmpCleanup');
const generateGif = require('./generateGif');
const calculateAge = require('./calculateAge');
const getFileSignedHeaders = require('./getFileSignedHeaders');
const getNameDate = require('./getNameDate');
const get12HourTime = require('./get12HourTime');

module.exports = {
  validateEmail,
  uploadProfileVideo,
  uploadFile,
  tmpCleanup,
  generateGif,
  calculateAge,
  getFileSignedHeaders,
  getNameDate,
  get12HourTime,
};
