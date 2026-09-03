const express = require("express");

const router = express.Router();

const authLivreur = require("../authentification/authLivreur");
const authClient = require("../authentification/authClient");
const authAdmin = require("../authentification/authAdmin");

const livreurController = require("../controller/livreurController");


// =====================================================
// LIVREUR — INSCRIPTION
// =====================================================

router.post(
  "/signup",
  livreurController.signup
);


// =====================================================
// LIVREUR — CONNEXION
// =====================================================

router.post(
  "/login",
  livreurController.login
);


// =====================================================
// LIVREUR — PROFIL
// =====================================================

router.get(
  "/profil",
  authLivreur,
  livreurController.profil
);


// =====================================================
// LIVREUR — STATUT
// =====================================================

router.put(
  "/statut",
  authLivreur,
  livreurController.changerStatut
);


// =====================================================
// LIVREUR — GPS
// =====================================================

router.put(
  "/localisation",
  authLivreur,
  livreurController.mettreAJourLocalisation
);


// =====================================================
// LIVREUR — MES COMMANDES
// =====================================================

router.get(
  "/commandes",
  authLivreur,
  livreurController.mesCommandes
);


// =====================================================
// LIVREUR — ACCEPTER COMMANDE
// =====================================================

router.put(
  "/commandes/:id/accepter",
  authLivreur,
  livreurController.accepterCommande
);


// =====================================================
// CLIENT — RECHERCHER UN LIVREUR
// =====================================================

router.put(
  "/commande/:id/rechercher-livreur",
  authClient,
  livreurController.rechercherLivreur
);


// =====================================================
// LIVREUR — COMMANDES DISPONIBLES
// =====================================================

router.get(
  "/commandes-disponibles",
  authLivreur,
  livreurController.commandesDisponibles
);


// =====================================================
// LIVREUR — COMMENCER RÉCUPÉRATION
// =====================================================

router.put(
  "/commandes/:id/commencer-recuperation",
  authLivreur,
  livreurController.commencerRecuperation
);


// =====================================================
// LIVREUR — RÉCUPÉRER
// =====================================================

router.put(
  "/commandes/:id/recuperer",
  authLivreur,
  livreurController.recupererCommande
);


// =====================================================
// LIVREUR — LIVRER
// =====================================================

router.put(
  "/commandes/:id/livrer",
  authLivreur,
  livreurController.livrerCommande
);


// =====================================================
//                    ADMIN
// =====================================================

// Liste des livreurs
router.get(
  "/admin",
  authAdmin,
  livreurController.adminGetLivreurs
);


// Bloquer
router.put(
  "/admin/:id/bloquer",
  authAdmin,
  livreurController.adminBloquerLivreur
);


// Débloquer
router.put(
  "/admin/:id/debloquer",
  authAdmin,
  livreurController.adminDebloquerLivreur
);


// Limiter
router.put(
  "/admin/:id/limiter",
  authAdmin,
  livreurController.adminLimiterLivreur
);


// Retirer limite
router.put(
  "/admin/:id/retirer-limite",
  authAdmin,
  livreurController.adminRetirerLimiteLivreur
);


// Activer / désactiver
router.put(
  "/admin/:id/actif",
  authAdmin,
  livreurController.adminChangerActif
);


// Modifier statut
router.put(
  "/admin/:id/statut",
  authAdmin,
  livreurController.adminChangerStatut
);


module.exports = router;