const express = require("express");
const router = express.Router();
const auth = require("../authentification/auth");
const adminCompteController = require("../controller/adminCompteController");

// 🔹 Récupérer toutes les commandes (admin)
router.get("/commandes", auth, adminCompteController.getAllCommandes);

// 🔹 Mettre à jour le statut d'une commande
router.put("/commandes/:id/statut", auth, adminCompteController.updateCommandeStatut);

module.exports = router;
