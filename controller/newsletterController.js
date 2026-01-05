require("dotenv").config();

exports.addNewsletter = async (req, res) => {
  try {
    const { email, name, marketingConsent } = req.body;

    if (!email) return res.status(400).json({ message: "Email requis" });
    if (!marketingConsent) {
      return res
        .status(403)
        .json({ message: "Vous devez accepter de recevoir des emails marketing." });
    }

    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: name || "" },
        listIds: [3],
        updateEnabled: true,
      }),
    });

    // Vérifier si le corps est vide
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      console.warn("Impossible de parser JSON Brevo :", text);
    }

    if (!response.ok) {
      console.error("Erreur Brevo:", data);
      return res.status(response.status).json({
        message: data.message || "Erreur Brevo",
        data,
      });
    }

    res.status(200).json({ message: "Email ajouté à la newsletter ✅", data });
  } catch (error) {
    console.error("Erreur addNewsletter:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

