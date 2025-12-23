const express = require("express");
const router = express.Router();
const auth = require("../authentification/auth");
const compteController = require("../controller/compteController");

// Infos compte + favoris + commandes
router.get("/", auth, compteController.getCompteInfo);

// Créer une commande
router.post("/commande", auth, compteController.createCommande);

// Historique commandes
router.get("/commandes", auth, compteController.getCommandes);

module.exports = router;
