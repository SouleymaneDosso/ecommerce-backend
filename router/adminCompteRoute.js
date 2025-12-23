const express = require("express");
const router = express.Router();
const authAdmin = require("../authentification/authAdmin");
const adminCompteController = require("../controller/adminCompteController");

// 🔹 Récupérer toutes les commandes (admin)
router.get("/commandes", authAdmin, adminCompteController.getAllCommandes);

// 🔹 Mettre à jour le statut d'une commande
router.put("/commandes/:id/statut", authAdmin, adminCompteController.updateCommandeStatut);

module.exports = router;
