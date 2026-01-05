const express = require("express");
const router = express.Router();
const newsletterController = require("../controller/newsletterController");

// POST /api/newsletter
router.post("/", newsletterController.addNewsletter);

module.exports = router;

