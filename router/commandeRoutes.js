const express = require("express");
const router = express.Router();

const {
  creerCommande,
  getCommandeById,
  getCommandesAdmin,
  paiementSemi,
  confirmerPaiementAdmin,
} = require("../controller/commandeController");

/* =========================
   ROUTES CLIENT
   ========================= */

// Créer une commande
router.post("/commandes", creerCommande);

// Récupérer une commande par ID
router.get("/commandes/:id", getCommandeById);

// Soumettre un paiement semi-manuel (en attente de validation admin)
router.post("/commandes/:id/paiement-semi", paiementSemi);

/* =========================
   ROUTES ADMIN
   ========================= */

// Récupérer toutes les commandes (pagination)
router.get("/admin/commandes", getCommandesAdmin);

// Confirmer un paiement envoyé par le client
router.put("/admin/commandes/:id/valider-paiement", confirmerPaiementAdmin);

module.exports = router;
