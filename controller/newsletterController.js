const fetch = require("node-fetch");
require("dotenv").config();

exports.addNewsletter = async (req, res) => {
  try {
    const { email, name, marketingConsent } = req.body;

    // Vérifier email
    if (!email) return res.status(400).json({ message: "Email requis" });

    // Vérifier consentement marketing
    if (!marketingConsent) {
      return res
        .status(403)
        .json({ message: "Consentement marketing requis" });
    }

    // Appel à l'API Brevo
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: name || "" },
        listIds: [3], // ID de ta liste Brevo
        updateEnabled: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: data.message || "Erreur Brevo",
        data
      });
    }

    res.status(200).json({ message: "Email ajouté à la newsletter ✅", data });
  } catch (error) {
    console.error("Erreur addNewsletter:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
