const express = require("express");

const router = express.Router();

const authAdmin = require("../authentification/authAdmin");

const authOptional = require("../authentification/authOptional");

const {
  enregistrerVisite,
  obtenirResumeStatistiques,
  obtenirStatistiquesClients,
  obtenirStatistiquesPages,
  obtenirFunnelStatistiques,
  obtenirEvolutionStatistiques,
  obtenirStatistiquesVisiteurs,
  obtenirStatistiquesUtilisateurs,
  obtenirStatistiquesFidelite,
} = require("../controller/statistiquesController");

// =====================================================
// STATISTIQUES ADMIN
// =====================================================

router.get("/test", authAdmin, (req, res) => {
  res.json({
    message: "Route statistiques admin OK",
  });
});

// =====================================================
// TRACKING VISITEURS
// =====================================================

router.post(
  "/visite",
  authOptional,
  enregistrerVisite,
);

// =====================================================
// RÉSUMÉ
// =====================================================

router.get(
  "/resume",
  authAdmin,
  obtenirResumeStatistiques,
);

// =====================================================
// CLIENTS
// =====================================================

router.get(
  "/clients",
  authAdmin,
  obtenirStatistiquesClients,
);

// =====================================================
// PAGES
// =====================================================

router.get(
  "/pages",
  authAdmin,
  obtenirStatistiquesPages,
);

// =====================================================
// FUNNEL
// =====================================================

router.get(
  "/funnel",
  authAdmin,
  obtenirFunnelStatistiques,
);

// =====================================================
// ÉVOLUTION
// =====================================================

router.get(
  "/evolution",
  authAdmin,
  obtenirEvolutionStatistiques,
);

// =====================================================
// VISITEURS
// =====================================================

router.get(
  "/visiteurs",
  authAdmin,
  obtenirStatistiquesVisiteurs,
);

// =====================================================
// UTILISATEURS
// =====================================================

router.get(
  "/utilisateurs",
  authAdmin,
  obtenirStatistiquesUtilisateurs,
);

// =====================================================
// FIDÉLITÉ
// =====================================================

router.get(
  "/fidelite",
  authAdmin,
  obtenirStatistiquesFidelite,
);

module.exports = router;