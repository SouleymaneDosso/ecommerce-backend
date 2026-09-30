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
    // 1. ESSAYER LE TOKEN LIVREUR EN PRIORITÉ
    // =================================================

    try {
      const decodedLivreur = jwt.verify(token, JWT_SECRET_LIVREUR);

      if (!decodedLivreur.userId) {
        throw new Error("userId absent du token livreur");
      }

      const livreur = await Livreur.findById(decodedLivreur.userId);

      if (livreur) {
        if (!livreur.actif) {
          return res.status(403).json({
            message: "Compte livreur désactivé",
          });
        }

        req.livreur = livreur;

        console.log("✅ AUTH CHAT : LIVREUR", livreur._id.toString());

        return next();
      }
    } catch (error) {
      // Ce n'est pas un token livreur valide.
      // On essaye maintenant le client.
    }

    // =================================================
    // 2. ESSAYER LE TOKEN CLIENT
    // =================================================

    try {
      const decodedClient = jwt.verify(token, JWT_SECRET_CLIENT);

      if (!decodedClient.userId) {
        return res.status(401).json({
          message: "Token client invalide",
        });
      }

      req.auth = {
        userId: decodedClient.userId,
      };

      console.log("✅ AUTH CHAT : CLIENT", decodedClient.userId);

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
