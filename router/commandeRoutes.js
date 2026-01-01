const express = require("express");
const router = express.Router();
const Commandeapi = require("../models/paiementmodel");

const {
  creerCommande,
  getCommandeById,
  getCommandesAdmin,
  paiementSemi,
  confirmerPaiementAdmin,
} = require("../controller/commandeController");

const authClient = require("../authentification/authClient");

/* =========================
   ROUTES CLIENT SÉCURISÉES
   ========================= */

// Créer une commande (le userId vient du token)
router.post("/commandes", authClient, creerCommande);

// Récupérer une commande par ID (vérifie que c'est bien le client qui la possède)
router.get("/commandes/:id", authClient, async (req, res) => {
  const { id } = req.params;
  const commande = await Commandeapi.findById(id).populate("panier.produitId");
  if (!commande)
    return res.status(404).json({ message: "Commande introuvable" });
  if (commande.client.userId.toString() !== req.auth.userId) {
    return res.status(403).json({ message: "Accès refusé" });
  }
  res.status(200).json(commande);
});

// Soumettre un paiement semi-manuel (vérifie que la commande appartient au client)
router.post(
  "/commandes/:id/paiement-semi",
  authClient,
  async (req, res, next) => {
    try {
      const commande = await require("../models/paiementmodel").findById(
        req.params.id
      );
      if (!commande)
        return res.status(404).json({ message: "Commande introuvable" });
      if (commande.client.userId.toString() !== req.auth.userId) {
        return res
          .status(403)
          .json({ message: "Accès refusé : commande d'un autre utilisateur" });
      }
      // Passe au controller existant
      await paiementSemi(req, res);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================
   ROUTES ADMIN (inchangées)
   ========================= */

// Récupérer toutes les commandes (pagination)
router.get("/admin/commandes", getCommandesAdmin);

// Confirmer un paiement envoyé par le client
router.put("/admin/commandes/:id/valider-paiement", confirmerPaiementAdmin);

module.exports = router;
