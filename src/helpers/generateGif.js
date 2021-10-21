const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = (inFilePath, outFilePath) => new Promise((resolve, reject) => {
  ffmpeg(inFilePath)
    .outputOption('-vf', 'scale=320:-1:flags=lanczos,fps=3')
    .save(outFilePath).on('end', () => resolve())
    .on('error', (err) => reject(new Error(err)));
});
