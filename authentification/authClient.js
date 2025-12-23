const jwt = require("jsonwebtoken");
const JWT_SECRET_CLIENT = process.env.JWT_SECRET_CLIENT;

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Token manquant" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token manquant" });

    const decoded = jwt.verify(token, JWT_SECRET_CLIENT);
    req.auth = { userId: decoded.userId };
    next();
  } catch (err) {
    console.error("AUTH CLIENT ERROR:", err.message);
    res.status(401).json({ message: "Requête non autorisée" });
  }
};
