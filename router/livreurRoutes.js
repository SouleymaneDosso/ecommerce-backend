const express = require("express");

const router = express.Router();

const authLivreur = require("../authentification/authLivreur");
const authClient = require("../authentification/authClient");
const authAdmin = require("../authentification/authAdmin");

const livreurController = require("../controller/livreurController");

// =====================================================
// LIVREUR
// =====================================================

router.post("/signup", livreurController.signup);

router.post("/login", livreurController.login);

router.get(
  "/profil",
  authLivreur,
  livreurController.profil,
);

router.put(
  "/statut",
  authLivreur,
  livreurController.changerStatut,
);

router.put(
  "/localisation",
  authLivreur,
  livreurController.mettreAJourLocalisation,
);

router.get(
  "/commandes",
  authLivreur,
  livreurController.mesCommandes,
);

router.put(
  "/commandes/:id/accepter",
  authLivreur,
  livreurController.accepterCommande,
);

// =====================================================
// CLIENT
// =====================================================

router.put(
  "/commande/:id/rechercher-livreur",
  authClient,
  livreurController.rechercherLivreur,
);

// =====================================================
// LIVREUR — COMMANDES DISPONIBLES
// =====================================================

router.get(
  "/commandes-disponibles",
  authLivreur,
  livreurController.commandesDisponibles,
);

// =====================================================
// LIVREUR — RÉCUPÉRATION
// =====================================================

router.put(
  "/commandes/:id/commencer-recuperation",
  authLivreur,
  livreurController.commencerRecuperation,
);

router.put(
  "/commandes/:id/recuperer",
  authLivreur,
  livreurController.recupererCommande,
);

router.put(
  "/commandes/:id/livrer",
  authLivreur,
  livreurController.livrerCommande,
);

// =====================================================
// ADMIN
// =====================================================

router.get(
  "/admin",
  authAdmin,
  livreurController.adminGetLivreurs,
);

router.put(
  "/admin/:id/bloquer",
  authAdmin,
  livreurController.adminBloquerLivreur,
);

router.put(
  "/admin/:id/debloquer",
  authAdmin,
  livreurController.adminDebloquerLivreur,
);

router.put(
  "/admin/:id/limiter",
  authAdmin,
  livreurController.adminLimiterLivreur,
);

router.put(
  "/admin/:id/retirer-limite",
  authAdmin,
  livreurController.adminRetirerLimiteLivreur,
);

module.exports = router;