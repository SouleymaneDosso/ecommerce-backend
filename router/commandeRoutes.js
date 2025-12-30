const express = require("express");
const router = express.Router();
const {
  creerCommande,
  getCommandeById,
} = require("../controller/commandeController");
const { validerPaiement } = require("../controller/paiementController");
// Endpoint création commande
router.post("/commandes", creerCommande);
router.get("/commandes/:id", getCommandeById);

router.put("/commandes/:id/paiement", validerPaiement);

module.exports = router;
