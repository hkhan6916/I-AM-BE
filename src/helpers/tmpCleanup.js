const path = require('path');
const fs = require('fs');

module.exports = async () => {
  const uploadsDir = 'tmp/uploads';

  fs.readdir(uploadsDir, (err, files) => {
    if (err) throw err;
    files.forEach((tmpFile) => {
      fs.unlink(path.join(uploadsDir, tmpFile), (delErr) => {
        if (delErr) (console.log(delErr));
      });
    });
  });
};
