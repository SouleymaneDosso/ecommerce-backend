const Favorite = require("../models/Favorite");
const Produits = require("../models/produits");

// 🔹 Récupérer les favoris d’un utilisateur
exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.auth.userId })
      .populate("productId"); // remplit les infos produit
    res.status(200).json(favorites);
  } catch (error) {
    console.error("Erreur getFavorites:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 Ajouter ou retirer un favori (toggle)
exports.toggleFavorite = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "productId requis" });

    const existing = await Favorite.findOne({ userId: req.auth.userId, productId });

    if (existing) {
      await Favorite.findByIdAndDelete(existing._id);
      return res.status(200).json({ message: "Favori retiré", active: false });
    }

    const newFav = new Favorite({ userId: req.auth.userId, productId });
    await newFav.save();
    res.status(201).json({ message: "Favori ajouté", active: true });

  } catch (error) {
    console.error("Erreur toggleFavorite:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 Supprimer un favori spécifique (sécurisé)
exports.deleteFavorite = async (req, res) => {
  try {
    const fav = await Favorite.findOneAndDelete({
      _id: req.params.id,
      userId: req.auth.userId
    });

    if (!fav) return res.status(404).json({ message: "Favori introuvable ou non autorisé" });

    res.status(200).json({ message: "Favori supprimé" });
  } catch (error) {
    console.error("Erreur deleteFavorite:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
