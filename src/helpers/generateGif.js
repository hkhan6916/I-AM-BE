const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = (inFilename, outFilename) => new Promise((resolve, reject) => {
  ffmpeg(inFilename)
    .outputOption('-vf', 'scale=320:-1:flags=lanczos,fps=3')
    .save(outFilename).on('end', () => resolve())
    .on('error', (err) => reject(new Error(err)));
});
