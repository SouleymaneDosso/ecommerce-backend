const jwt = require("jsonwebtoken");
const Livreur = require("../models/livreur");

const JWT_SECRET_LIVREUR = process.env.JWT_SECRET_LIVREUR;

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token livreur manquant",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Token livreur manquant",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET_LIVREUR);
    } catch (error) {
      return res.status(401).json({
        message: "Token livreur invalide ou expiré",
      });
    }

    const livreur = await Livreur.findById(decoded.userId);

    if (!livreur) {
      return res.status(403).json({
        message: "Livreur introuvable",
      });
    }

    if (!livreur.actif) {
      return res.status(403).json({
        message: "Compte livreur désactivé",
      });
    }

    req.livreur = livreur;

    next();
  } catch (error) {
    console.error("AUTH LIVREUR ERROR:", error.message);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};