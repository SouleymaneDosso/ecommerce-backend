const express = require("express");

const router = express.Router();

const authLivreur = require("../authentification/authLivreur");
const authClient = require("../authentification/authClient");

const livreurController = require("../controller/livreurController");

// ===============================
// INSCRIPTION
// ===============================

router.post("/signup", livreurController.signup);

// ===============================
// CONNEXION
// ===============================

router.post("/login", livreurController.login);

// ===============================
// PROFIL
// ===============================

router.get("/profil", authLivreur, livreurController.profil);

// ===============================
// STATUT
// ===============================

router.put("/statut", authLivreur, livreurController.changerStatut);

// ===============================
// LOCALISATION GPS
// ===============================

router.put(
  "/localisation",
  authLivreur,
  livreurController.mettreAJourLocalisation,
);

// ===============================
// MES COMMANDES
// ===============================

router.get("/commandes", authLivreur, livreurController.mesCommandes);

// ===============================
// ACCEPTER COMMANDE
// ===============================

router.put(
  "/commandes/:id/accepter",
  authLivreur,
  livreurController.accepterCommande,
);

// ===============================
// chercher un livreur
// ===============================
router.put(
  "/commande/:id/rechercher-livreur",
  authClient,
  livreurController.rechercherLivreur,
);


router.get(
  "/commandes-disponibles",
  authLivreur,
  livreurController.commandesDisponibles
);

router.put(
  "/commandes/:id/commencer-recuperation",
  authLivreur,
  livreurController.commencerRecuperation
);

router.put(
  "/commandes/:id/recuperer",
  authLivreur,
  livreurController.recupererCommande
);

router.put(
  "/commandes/:id/livrer",
  authLivreur,
  livreurController.livrerCommande
);

module.exports = router;
