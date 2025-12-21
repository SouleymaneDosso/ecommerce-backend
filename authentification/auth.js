const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decodedToken = jwt.verify(token, JWT_SECRET);
    const userId = decodedToken.userId 
    req.auth = { userId : userId };
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};
