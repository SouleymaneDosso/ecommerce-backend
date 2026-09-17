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
} = require("../controller/statistiquesController");
// =====================================================
// STATISTIQUES ADMIN
// =====================================================

// Test de connexion de la nouvelle section
router.get("/test", authAdmin, (req, res) => {
  res.json({
    message: "Route statistiques admin OK",
  });
});
router.post("/visite", authOptional, enregistrerVisite);
router.get("/resume", authAdmin, obtenirResumeStatistiques);
router.get("/clients", authAdmin, obtenirStatistiquesClients);
router.get("/pages", authAdmin, obtenirStatistiquesPages);
router.get("/funnel", authAdmin, obtenirFunnelStatistiques);

module.exports = router;
