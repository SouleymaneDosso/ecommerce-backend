const express = require("express");
const router = express.Router();

// Stocker le consentement marketing
router.post("/consent", (req, res) => {
  const { marketingConsent } = req.body;

  if (marketingConsent === undefined) {
    return res.status(400).json({ message: "Consentement requis" });
  }

  res.cookie("marketingConsent", marketingConsent, {
    httpOnly: true, // cookie inaccessible depuis JS côté client
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 an
  });

  res.status(200).json({ message: "Consentement enregistré ✅" });
});

module.exports = router;
