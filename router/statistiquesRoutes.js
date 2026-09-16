const express = require("express");

const router = express.Router();

const authAdmin = require("../authentification/authAdmin");
const {
  enregistrerVisite,
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
router.post("/visite", enregistrerVisite);

module.exports = router;