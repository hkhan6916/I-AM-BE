const JWT = require('jsonwebtoken');

module.exports = (req, res, next) => {
  if (!req.headers.authorization) res.status(200).json({ message: 'Unauthorised' });
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader.split(' ');
  const token = bearerToken[1];
  JWT.verify(token, process.env.TOKEN_SECRET, (err, user) => {
    if (err) {
      res.status(200).json({ message: 'Unauthorised' });
    }
    req.user = user;
    next();
  });
};
