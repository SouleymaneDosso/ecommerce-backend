const express = require("express");
const router = express.Router();
const {
  creerCommande,
  getCommandeById,
  getCommandesAdmin,
  validerPaiement,
  validerEtapeAdmin,
  paiementSemi,
} = require("../controller/commandeController");

// Endpoint création commande
router.post("/commandes", creerCommande);
router.get("/commandes/:id", getCommandeById);

router.get("/admin/commandes", getCommandesAdmin);
router.put("/admin/commandes/:id/valider-etape", validerEtapeAdmin);

router.put("/commandes/:id/paiement", validerPaiement);
router.post("/commandes/:id/paiement-semi", paiementSemi);
module.exports = router;
