const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET_CLIENT;

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Token manquant" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token manquant" });

    const decodedToken = jwt.verify(token, JWT_SECRET);
    req.auth = { userId: decodedToken.userId };
    next();
  } catch (error) {
    console.error("AUTH ERROR:", error.message);
    return res.status(401).json({ message: "Requête non autorisée" });
  }
};
