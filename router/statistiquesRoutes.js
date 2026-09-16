const express = require("express");

const router = express.Router();

const authAdmin = require("../authentification/authAdmin");
const authOptional = require("../authentification/authOptional");
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
router.post("/visite", authOptional, enregistrerVisite);

module.exports = router;