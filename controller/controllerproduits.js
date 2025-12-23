const Produits = require("../models/produits");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");

// 🔹 Fonction utilitaire pour supprimer des images Cloudinary
const supprimerImagesCloudinary = async (images) => {
  if (!images || !Array.isArray(images)) return;

  for (const img of images) {
    const publicId = img.public_id || img.filename;
    if (!publicId) continue;

    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.warn("Erreur suppression image Cloudinary :", err.message);
    }
  }
};

// ===============================
// AJOUTER UN PRODUIT (Admin)
// ===============================
exports.sauvegarderProduits = async (req, res) => {
  try {
    if (!req.body.produits)
      return res.status(400).json({ message: "Données produit manquantes" });

    let data;
    try {
      data = JSON.parse(req.body.produits);
      data.price = Number(data.price);
      data.stock = Number(data.stock);
    } catch {
      return res.status(400).json({ message: "JSON produit invalide" });
    }

    // Validation stricte
    const requiredFields = [
      "title",
      "description",
      "price",
      "stock",
      "genre",
      "categorie",
    ];
    for (const field of requiredFields) {
      if (!data[field])
        return res
          .status(400)
          .json({ message: `Le champ ${field} est obligatoire` });
    }

    if (typeof data.price !== "number" || data.price < 0)
      return res.status(400).json({ message: "Prix invalide" });

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: "Au moins une image requise" });

    const images = req.files.map((f) => ({
      url: f.path,
      public_id: f.filename,
    }));

    const produit = new Produits({
      ...data,
      userId: req.admin ? req.admin._id : req.auth.userId,
      imageUrl: images,
      badge: data.badge || null,
      hero: data.hero || false,
      commentaires: [],
      averageRating: 0,
    });

    await produit.save();
    res.status(201).json({ message: "Produit ajouté avec succès", produit });
  } catch (err) {
    console.error("🔥 ERREUR ajout produit:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// MODIFIER UN PRODUIT (Admin / Propriétaire)
// ===============================
exports.updateProduit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!req.body.produits)
      return res.status(400).json({ message: "Aucune donnée produit envoyée" });

    let data;
    try {
      data = JSON.parse(req.body.produits);
      data.price = Number(data.price);
      data.stock = Number(data.stock);
    } catch {
      return res.status(400).json({ message: "JSON produit invalide" });
    }

    const requiredFields = [
      "title",
      "description",
      "price",
      "stock",
      "genre",
      "categorie",
    ];
    for (const field of requiredFields) {
      if (!data[field])
        return res
          .status(400)
          .json({ message: `Le champ ${field} est obligatoire` });
    }

    delete data.userId;

    const produit = await Produits.findById(req.params.id).session(session);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    if (!req.admin && produit.userId !== req.auth.userId)
      return res.status(403).json({ message: "Non autorisé" });

    // Gestion images
    const existingImages = req.body.existingImages
      ? JSON.parse(req.body.existingImages)
      : [];
    const imagesToDelete = produit.imageUrl.filter(
      (img) => !existingImages.some((e) => e.url === img.url)
    );
    await supprimerImagesCloudinary(imagesToDelete);

    const newImages = (req.files || []).map((f) => ({
      url: f.path,
      public_id: f.filename,
    }));
    data.imageUrl = [...existingImages, ...newImages];

    // Bonus : hero et badge
    data.hero = data.hero || produit.hero;
    data.badge = data.badge || produit.badge;

    const updatedProduit = await Produits.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, session }
    );
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Produit modifié avec succès",
      produit: updatedProduit,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("🔥 ERREUR update produit:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// SUPPRIMER UN PRODUIT
// ===============================
exports.deleteProduit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const produit = await Produits.findById(req.params.id).session(session);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    if (!req.admin && produit.userId !== req.auth.userId)
      return res.status(403).json({ message: "Non autorisé" });

    await supprimerImagesCloudinary(produit.imageUrl);
    await Produits.findByIdAndDelete(req.params.id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Produit supprimé avec succès" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("🔥 ERREUR delete produit:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// GET PRODUITS avec pagination
// ===============================
exports.getProduits = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const produits = await Produits.find().skip(skip).limit(limit);
    res.status(200).json(produits);
  } catch (err) {
    console.error("🔥 ERREUR getProduits:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// GET PRODUIT PAR ID
// ===============================
exports.getProduitById = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });
    res.status(200).json(produit);
  } catch (err) {
    console.error("🔥 ERREUR getProduitById:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// AJOUTER COMMENTAIRE (Client)
// ===============================
exports.ajouterCommentaire = async (req, res) => {
  try {
    const { message, rating } = req.body;

    if (!message || rating == null || rating < 1 || rating > 5)
      return res.status(400).json({ message: "Message et note (1-5) requis" });

    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    const commentaire = {
      user: req.auth.userId,
      message,
      rating,
      createdAt: new Date(),
    };
    produit.commentaires.push(commentaire);

    // Mettre à jour averageRating
    const total = produit.commentaires.reduce((acc, c) => acc + c.rating, 0);
    produit.averageRating = parseFloat(
      (total / produit.commentaires.length).toFixed(1)
    );

    await produit.save();
    res.status(201).json(commentaire);
  } catch (err) {
    console.error("🔥 ERREUR addCommentaire:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// SUPPRIMER COMMENTAIRE (Admin / propriétaire)
// ===============================
exports.supprimerCommentaire = async (req, res) => {
  try {
    const { produitId, commentaireId } = req.params;
    const produit = await Produits.findById(produitId);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    // Vérifie si l'utilisateur est admin ou auteur du commentaire
    const commentaire = produit.commentaires.id(commentaireId);
    if (!commentaire)
      return res.status(404).json({ message: "Commentaire non trouvé" });

    if (!req.admin && commentaire.user !== req.auth.userId)
      return res.status(403).json({ message: "Non autorisé" });

    commentaire.remove();

    // Recalcul averageRating
    if (produit.commentaires.length > 0) {
      const total = produit.commentaires.reduce((acc, c) => acc + c.rating, 0);
      produit.averageRating = parseFloat(
        (total / produit.commentaires.length).toFixed(1)
      );
    } else {
      produit.averageRating = 0;
    }

    await produit.save();
    res.status(200).json({ message: "Commentaire supprimé avec succès" });
  } catch (err) {
    console.error("🔥 ERREUR deleteCommentaire:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// GET COMMENTAIRES d'un produit (Client)
// ===============================
exports.getCommentaires = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    res.status(200).json({
      commentaires: produit.commentaires,
      averageRating: produit.averageRating || 0,
      totalCommentaires: produit.commentaires.length,
    });
  } catch (err) {
    console.error("🔥 ERREUR getCommentaires:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// RECOMMANDATIONS PRODUITS
// ===============================
exports.getRecommendations = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    const prixMin = produit.price * 0.8;
    const prixMax = produit.price * 1.2;

    const recommandations = await Produits.find({
      categorie: produit.categorie,
      _id: { $ne: produit._id },
      price: { $gte: prixMin, $lte: prixMax },
    }).limit(4);

    res.status(200).json(recommandations);
  } catch (err) {
    console.error("🔥 ERREUR getRecommendations:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
