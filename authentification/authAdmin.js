const jwt = require("jsonwebtoken");
const Admin = require("../models/admin");
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "Token manquant" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token manquant" });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log("decoded JWT:", decoded);
    } catch {
      return res.status(401).json({ message: "Token invalide ou expiré" });
    }

    const admin = await Admin.findById(decoded.userId);
    if (!admin) return res.status(403).json({ message: "Accès non autorisé" });

    req.admin = admin;
    next();
  } catch (err) {
    console.error("AUTH ADMIN ERROR:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
