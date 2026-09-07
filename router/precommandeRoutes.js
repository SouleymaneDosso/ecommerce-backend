const express = require("express");

const router = express.Router();

const authClient = require("../authentification/authClient");
const authAdmin = require("../authentification/authAdmin");

const {
  getModelesPrecommande,
  getInformationsDepot,
  creerPrecommande,
  getMesPrecommandes,
  getPrecommandeById,
  getPrecommandesAdmin,
  accepterPrecommande,
  refuserPrecommande,
} = require("../controller/precommandeController");

/* =====================================================
   CLIENT
===================================================== */

/*
 * Modèles disponibles pour précommande
 */
router.get(
  "/modeles",
  getModelesPrecommande,
);

/*
 * Numéro + services de dépôt
 */
router.get(
  "/depot",
  authClient,
  getInformationsDepot,
);

/*
 * Créer une précommande
 */
router.post(
  "/",
  authClient,
  creerPrecommande,
);

/*
 * Mes précommandes
 */
router.get(
  "/mes",
  authClient,
  getMesPrecommandes,
);

/*
 * Une précommande
 */
router.get(
  "/:id",
  authClient,
  getPrecommandeById,
);

/* =====================================================
   ADMIN
===================================================== */

/*
 * Toutes les précommandes
 */
router.get(
  "/admin/liste",
  authAdmin,
  getPrecommandesAdmin,
);

/*
 * Accepter
 */
router.put(
  "/admin/:id/accepter",
  authAdmin,
  accepterPrecommande,
);

/*
 * Refuser
 */
router.put(
  "/admin/:id/refuser",
  authAdmin,
  refuserPrecommande,
);

module.exports = router;