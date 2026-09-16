const jwt = require("jsonwebtoken");

const JWT_SECRET_CLIENT = process.env.JWT_SECRET_CLIENT;

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      req.auth = null;
      return next();
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      req.auth = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET_CLIENT);

    req.auth = {
      userId: decoded.userId,
    };

    next();
  } catch (err) {
    // Token absent ou invalide :
    // on considère simplement le visiteur comme anonyme.
    req.auth = null;
    next();
  }
};