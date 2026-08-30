const express = require("express");

const router = express.Router();

const authLivreur = require("../authentification/authLivreur");

const loginController = require("../controller/livreurController");

// ===============================
// ROUTES LIVREUR
// ===============================

// Inscription livreur
router.post("/signup",  loginController.signup);

// Connexion livreur
router.post("/login", loginController.login);

/* =========================
   TEST AUTHENTIFICATION LIVREUR
   ========================= */

router.get("/profil", authLivreur, async (req, res) => {
  try {
    res.status(200).json({
      message: "Authentification livreur réussie",
      livreur: {
        id: req.livreur._id,
        username: req.livreur.username,
        email: req.livreur.email,
        telephone: req.livreur.telephone,
        actif: req.livreur.actif,
        statut: req.livreur.statut,
        localisation: req.livreur.localisation,
        commandeActuelle: req.livreur.commandeActuelle,
      },
    });
  } catch (error) {
    console.error("PROFIL LIVREUR ERROR:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
});

module.exports = router;