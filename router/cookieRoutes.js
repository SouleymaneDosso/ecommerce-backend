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
res.cookie("marketingConsent", String(marketingConsent), {
  maxAge: 365 * 24 * 60 * 60 * 1000,
  path: "/",
  httpOnly: false,
  sameSite: "none",
  secure: true, 
});

  res.status(200).json({ message: "Consentement enregistré ✅" });
});

// GET : récupérer le consentement marketing
router.get("/consent", (req, res) => {
  const cookie = req.cookies.marketingConsent;
  console.log("COOKIES RECEIVED:", req.cookies);

  const marketingConsent =
    cookie === true ||
    cookie === "true" ||
    cookie === 1 ||
    cookie === "1";

  res.status(200).json({ marketingConsent });
});

module.exports = router;