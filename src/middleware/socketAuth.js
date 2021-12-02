const JWT = require('jsonwebtoken');

module.exports = (socket, next) => {
  if (socket.handshake.auth && socket.handshake.auth.token) {
    JWT.verify(socket.handshake.auth.token, process.env.TOKEN_SECRET, (err, user) => {
      if (err) {
        return next(new Error('Authentication error'));
      }
      socket.user = user;
      next();
    });
  } else {
    next(new Error('Authentication error'));
  }
};
