const Commande = require("../models/Commande");
const Favorite = require("../models/Favorite");
const Produits = require("../models/produits");
const User = require("../models/User");
const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

// 🔹 Envoi email notification commande
const sendCommandeEmail = async (email, commande) => {
  const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
  const htmlContent = `
    <h2>Votre commande a été créée</h2>
    <p>Commande ID : ${commande._id}</p>
    <p>Total : ${commande.total} FCFA</p>
    <p>Statut : ${commande.statut}</p>
  `;
  await tranEmailApi.sendTransacEmail({
    sender: { email: "no-reply@numa.ci", name: "Numa" },
    to: [{ email }],
    subject: "Confirmation de votre commande",
    htmlContent,
  });
};

// 🔹 Récupérer infos compte + favoris + commandes
exports.getCompteInfo = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const user = await User.findById(userId).select("username email");

    if (!user)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    // Favoris
    const favorites = await Favorite.find({ userId }).populate("productId");

    // Commandes
    const commandes = await Commande.find({ userId })
      .sort({ createdAt: -1 })
      .populate("produits.produitId");

    res.status(200).json({ user, favorites, commandes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 Créer une commande
exports.createCommande = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { produits, adresseLivraison } = req.body;

    if (!produits || produits.length === 0) {
      return res.status(400).json({ message: "Aucun produit fourni" });
    }

    // Calcul du total
    let total = 0;
    for (const p of produits) {
      const produitDb = await Produits.findById(p.produitId);
      if (!produitDb)
        return res
          .status(400)
          .json({ message: `Produit introuvable: ${p.produitId}` });
      total += produitDb.price * p.quantite;
    }

    const commande = new Commande({
      userId,
      produits,
      total,
      adresseLivraison,
    });
    await commande.save();

    // Récupérer email du user
    const user = await User.findById(userId);
    if (user && user.email) await sendCommandeEmail(user.email, commande);

    res.status(201).json({ message: "Commande créée avec succès", commande });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 Historique commandes
exports.getCommandes = async (req, res) => {
  try {
    const userId = req.auth.userId;
    const commandes = await Commande.find({ userId })
      .sort({ createdAt: -1 })
      .populate("produits.produitId");
    res.status(200).json(commandes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
