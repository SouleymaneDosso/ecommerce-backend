const User = require("../models/User");
const Commandeapi = require("../models/paiementmodel");
const Favorite = require("../models/Favorite"); // ✅ Import du modèle Favorite

exports.getCompte = async (req, res) => {
  try {
    // 1️⃣ Récupérer l'utilisateur
    const user = await User.findById(req.auth.userId).select("-password");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    // 2️⃣ Récupérer les commandes du client
    const commandes = await Commandeapi.find({ "client.userId": req.auth.userId });

    // 3️⃣ Récupérer les favoris de l'utilisateur
    const favorites = await Favorite.find({ userId: req.auth.userId })
      .populate("productId"); // Remplir les infos produit

    // 4️⃣ Réponse JSON complète
    res.status(200).json({
      user,
      commandes,
      favorites,
    });
  } catch (err) {
    console.error("Erreur getCompte:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
