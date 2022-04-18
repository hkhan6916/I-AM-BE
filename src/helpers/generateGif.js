// const ffmpeg = require('fluent-ffmpeg');
// const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// ffmpeg.setFfmpegPath(ffmpegPath);

// module.exports = (inFilePath, outFilePath) => new Promise((resolve, reject) => {
//   ffmpeg(inFilePath)
//     .outputOption('-vf', 'scale=320:-1:flags=lanczos,fps=3')
//     .save(outFilePath).on('end', () => resolve())
//     .on('error', (err) => reject(new Error(err)));
// });
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const stream = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = (inFilePath) => new Promise((resolve, reject) => {
  const bufferStream = new stream.PassThrough();

  ffmpeg(inFilePath)
    .outputOption('-vf', 'scale=320:-1:flags=lanczos,fps=3')
    .format('gif')
    .pipe(bufferStream)
    .on('error', (err) => reject(err));

  const buffers = [];
  bufferStream.on('data', (buf) => {
    buffers.push(buf);
  });
  bufferStream.on('end', () => {
    const outputBuffer = Buffer.concat(buffers);
    resolve(outputBuffer);
  });
});
