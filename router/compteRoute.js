const express = require("express");
const router = express.Router();
const authClient = require("../authentification/authClient");
const compteController = require("../controller/compteController");

// Infos compte + favoris + commandes
router.get("/", authClient, compteController.getCompteInfo);

// Créer une commande
router.post("/commande", authClient, compteController.createCommande);

// Historique commandes
router.get("/commandes", authClient, compteController.getCommandes);

module.exports = router;
