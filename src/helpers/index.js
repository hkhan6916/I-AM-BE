const validateEmail = require('./validateEmail');
const uploadProfileVideo = require('./uploadProfileVideo');
const uploadFile = require('./uploadFile');
const tmpCleanup = require('./tmpCleanup');
const generateGif = require('./generateGif');
const calculateAge = require('./calculateAge');
const getFileSignedHeaders = require('./getFileSignedHeaders');

module.exports = {
  validateEmail,
  uploadProfileVideo,
  uploadFile,
  tmpCleanup,
  generateGif,
  calculateAge,
  getFileSignedHeaders,
};
