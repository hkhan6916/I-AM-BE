const JWT = require('jsonwebtoken');

module.exports = (req, res, next) => {
  if (!req.headers.authorization) throw new Error('Unauthorised');
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader.split(' ');
  const token = bearerToken[1];
  JWT.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    if (err) {
      throw new Error('Unauthorised');
    }
    req.user = user;
    next();
  });
};
