const Commande = require("../models/Commande");
const User = require("../models/User");
const SibApiV3Sdk = require("sib-api-v3-sdk");

// Config Brevo
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

// 🔹 Envoyer email notification changement de statut
const sendStatusEmail = async (email, commande) => {
  const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
  const htmlContent = `
    <h2>Statut de votre commande mis à jour</h2>
    <p>Commande ID : ${commande._id}</p>
    <p>Nouveau statut : ${commande.statut}</p>
  `;
  await tranEmailApi.sendTransacEmail({
    sender: { email: "no-reply@numa.ci", name: "Numa" },
    to: [{ email }],
    subject: "Mise à jour de votre commande",
    htmlContent,
  });
};

// 🔹 Récupérer toutes les commandes (admin)
exports.getAllCommandes = async (req, res) => {
  try {
    const commandes = await Commande.find()
      .sort({ createdAt: -1 })
      .populate("produits.produitId"); // inclut les détails des produits
    res.status(200).json(commandes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 Mettre à jour le statut d'une commande
exports.updateCommandeStatut = async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    if (!["en cours", "envoyé", "livré", "annulé"].includes(statut)) {
      return res.status(400).json({ message: "Statut invalide" });
    }

    const commande = await Commande.findByIdAndUpdate(
      id,
      { statut },
      { new: true }
    );

    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });

    // Récupérer email du client
    const user = await User.findById(commande.userId);
    if (user && user.email) {
      await sendStatusEmail(user.email, commande);
    }

    res.status(200).json({ message: "Statut mis à jour", commande });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
