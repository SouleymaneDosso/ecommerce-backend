// cookieRoutes.js
const express = require("express");
const router = express.Router();

// POST : stocker le consentement marketing
router.post("/consent", (req, res) => {
  const { marketingConsent } = req.body;

  if (marketingConsent === undefined) {
    return res.status(400).json({ message: "Consentement requis" });
  }

  // ⚡ Cookie configuré pour cross-domain + React
  res.cookie("marketingConsent", marketingConsent, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 an
    path: "/",             // accessible sur tout le site
    httpOnly: false,       // React peut lire le cookie
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production", // HTTPS obligatoire en prod
  });

  res.status(200).json({ message: "Consentement enregistré ✅" });
});

// GET : récupérer le consentement marketing
router.get("/consent", (req, res) => {
  const marketingConsent = req.cookies.marketingConsent === "true";
  res.status(200).json({ marketingConsent });
});

module.exports = router;