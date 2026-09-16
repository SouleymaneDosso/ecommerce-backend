const express = require("express");

const router = express.Router();

const authAdmin = require("../authentification/authAdmin");

// =====================================================
// STATISTIQUES ADMIN
// =====================================================

// Test de connexion de la nouvelle section
router.get("/test", authAdmin, (req, res) => {
  res.json({
    message: "Route statistiques admin OK",
  });
});

module.exports = router;