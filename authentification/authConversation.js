const jwt = require("jsonwebtoken");
const Livreur = require("../models/livreur");

const JWT_SECRET_CLIENT = process.env.JWT_SECRET_CLIENT;
const JWT_SECRET_LIVREUR = process.env.JWT_SECRET_LIVREUR;

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token manquant",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Format du token invalide",
      });
    }

    const token = parts[1];

    // =================================================
    // ESSAYER LE TOKEN CLIENT
    // =================================================

    try {
      const decodedClient = jwt.verify(
        token,
        JWT_SECRET_CLIENT
      );

      req.auth = {
        userId: decodedClient.userId,
      };

      return next();
    } catch (error) {
      // Ce n'est pas un token client.
      // On essaye maintenant le token livreur.
    }

    // =================================================
    // ESSAYER LE TOKEN LIVREUR
    // =================================================

    try {
      const decodedLivreur = jwt.verify(
        token,
        JWT_SECRET_LIVREUR
      );

      const livreur = await Livreur.findById(
        decodedLivreur.userId
      );

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

      return next();
    } catch (error) {
      return res.status(401).json({
        message: "Token invalide ou expiré",
      });
    }
  } catch (error) {
    console.error("AUTH CONVERSATION ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};