// const express = require("express");
// const router = express.Router();
// const Commandeapi = require("../models/paiementmodel");

// const {
//   creerCommande,
//   getCommandeById,
//   getCommandesAdmin,
//   confirmerCommandeCOD,
//   paiementSemi,
//   confirmerPaiementAdmin,
//   rejeterPaiementAdmin,
//   marquerCommeLivre,
//   marquerCommeExpedie,
//   mettreAJourLocalisationClient,
//   rechercherCommandeParNumero,
//   annulerCommandeAdmin,
// } = require("../controller/commandeController");

// const authClient = require("../authentification/authClient");

// /* =========================
//    ROUTES CLIENT SÉCURISÉES
//    ========================= */

// router.get(
//   "/commandes/recherche/:numeroCommande",
//   authClient,
//   rechercherCommandeParNumero,
// );

// router.put(
//   "/commandes/:id/localisation-client",
//   authClient,
//   mettreAJourLocalisationClient,
// );

// // Créer une commande (le userId vient du token)
// router.post("/commandes", authClient, creerCommande);

// router.get("/commandes/:id", authClient, getCommandeById);

// // Soumettre un paiement semi-manuel (vérifie que la commande appartient au client)
// router.post(
//   "/commandes/:id/paiement-semi",
//   authClient,
//   async (req, res, next) => {
//     try {
//       const commande = await require("../models/paiementmodel").findById(
//         req.params.id,
//       );
//       if (!commande)
//         return res.status(404).json({ message: "Commande introuvable" });
//       if (commande.client.userId.toString() !== req.auth.userId) {
//         return res
//           .status(403)
//           .json({ message: "Accès refusé : commande d'un autre utilisateur" });
//       }
//       // Passe au controller existant
//       await paiementSemi(req, res);
//     } catch (err) {
//       next(err);
//     }
//   },
// );

// /* =========================
//    ROUTES ADMIN (inchangées)
//    ========================= */

// // Récupérer toutes les commandes (pagination)
// router.get("/admin/commandes", getCommandesAdmin);

// // Confirmer un paiement envoyé par le client
// router.put("/admin/commandes/:id/valider-paiement", confirmerPaiementAdmin);
// router.put("/admin/commandes/:id/ship", marquerCommeExpedie);
// router.put("/admin/commandes/:id/rejeter-paiement", rejeterPaiementAdmin);
// router.put("/admin/commandes/:id/confirmer-cod", confirmerCommandeCOD);
// router.put("/admin/commandes/:id/livrer", marquerCommeLivre);

// module.exports = router;


const express = require("express");
const router = express.Router();

const {
  creerCommande,
  getCommandeById,
  getCommandesAdmin,
  confirmerCommandeCOD,
  paiementSemi,
  confirmerPaiementAdmin,
  rejeterPaiementAdmin,
  marquerCommeLivre,
  marquerCommeExpedie,
  annulerCommandeAdmin,
  mettreAJourLocalisationClient,
  rechercherCommandeParNumero,
} = require("../controller/commandeController");

const authClient = require("../authentification/authClient");
const authAdmin = require("../authentification/authAdmin");

// ==========================================
// ROUTES CLIENT
// ==========================================

// Recherche d'une commande
router.get(
  "/commandes/recherche/:numeroCommande",
  authClient,
  rechercherCommandeParNumero,
);

// Mise à jour de la position GPS
router.put(
  "/commandes/:id/localisation-client",
  authClient,
  mettreAJourLocalisationClient,
);

// Création d'une commande
router.post(
  "/commandes",
  authClient,
  creerCommande,
);

// Récupération d'une commande
router.get(
  "/commandes/:id",
  authClient,
  getCommandeById,
);

// Soumission d'un paiement
router.post(
  "/commandes/:id/paiement-semi",
  authClient,
  async (req, res, next) => {
    try {
      const commande = await require("../models/paiementmodel").findOne({
        _id: req.params.id,
        "client.userId": req.auth.userId,
      });

      if (!commande) {
        return res.status(404).json({
          message: "Commande introuvable ou accès non autorisé",
        });
      }

      return paiementSemi(req, res, next);
    } catch (error) {
      console.error("VERIFICATION COMMANDE PAIEMENT:", error);

      return res.status(500).json({
        message: "Erreur lors de la vérification de la commande",
      });
    }
  },
);

// ==========================================
// ROUTES ADMIN
// Toutes protégées par authAdmin
// ==========================================

// Liste des commandes
router.get(
  "/admin/commandes",
  authAdmin,
  getCommandesAdmin,
);

// Confirmer un paiement
router.put(
  "/admin/commandes/:id/valider-paiement",
  authAdmin,
  confirmerPaiementAdmin,
);

// Expédier une commande
router.put(
  "/admin/commandes/:id/ship",
  authAdmin,
  marquerCommeExpedie,
);

// Rejeter un paiement
router.put(
  "/admin/commandes/:id/rejeter-paiement",
  authAdmin,
  rejeterPaiementAdmin,
);

// Confirmation COD (conservée pour compatibilité)
router.put(
  "/admin/commandes/:id/confirmer-cod",
  authAdmin,
  confirmerCommandeCOD,
);

// Marquer une commande comme livrée
router.put(
  "/admin/commandes/:id/livrer",
  authAdmin,
  marquerCommeLivre,
);

// Annuler une commande et restituer le stock
router.put(
  "/admin/commandes/:id/annuler",
  authAdmin,
  annulerCommandeAdmin,
);

module.exports = router;
