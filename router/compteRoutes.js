const express = require("express");
const router = express.Router();
const compteController = require("../controller/compteController");
const authClient = require("../authentification/authClient");

// Route GET /api/compte
router.get("/", authClient, compteController.getCompte);

module.exports = router;
