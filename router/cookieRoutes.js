const express = require("express");
const router = express.Router();

// POST : stocker le consentement marketing
router.post("/consent", (req, res) => {
  const { marketingConsent } = req.body;

  if (marketingConsent === undefined) {
    return res.status(400).json({ message: "Consentement requis" });
  }

  res.cookie("marketingConsent", marketingConsent, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 an
  });

  res.status(200).json({ message: "Consentement enregistré ✅" });
});

// GET : récupérer le consentement marketing
router.get("/consent", (req, res) => {
  const marketingConsent = req.cookies.marketingConsent || false;
  res.status(200).json({ marketingConsent });
});

module.exports = router;