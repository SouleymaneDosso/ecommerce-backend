const Produits = require("../models/produits");
const cloudinary = require("../config/cloudinary");

// 🔹 Fonction utilitaire pour supprimer des images Cloudinary
const supprimerImagesCloudinary = async (images) => {
  for (const img of images) {
    if (!img.public_id) continue;
    try {
      await cloudinary.uploader.destroy(img.public_id);
    } catch (err) {
      console.warn("Erreur suppression image Cloudinary :", err.message);
    }
  }
};

// ===============================
// AJOUTER UN PRODUIT
// ===============================
exports.sauvegarderProduits = async (req, res) => {
  try {
    if (!req.body.produits) 
      return res.status(400).json({ message: "Données produit manquantes" });

    let data;
    try {
      data = JSON.parse(req.body.produits);
    } catch {
      return res.status(400).json({ message: "JSON produit invalide" });
    }

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: "Au moins une image requise" });

    // On récupère le public_id et URL depuis Multer Cloudinary
    const images = req.files.map(f => ({ url: f.path, public_id: f.filename }));

    const produit = new Produits({
      ...data,
      userId: req.auth.userId,
      imageUrl: images,
    });

    await produit.save();
    res.status(201).json({ message: "Produit ajouté avec succès", produit });
  } catch (err) {
    console.error("🔥 ERREUR ajout produit:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// MODIFIER UN PRODUIT
// ===============================
exports.updateProduit = async (req, res) => {
  try {
    if (!req.body.produits)
      return res.status(400).json({ message: "Aucune donnée produit envoyée" });

    let data;
    try {
      data = JSON.parse(req.body.produits);
    } catch {
      return res.status(400).json({ message: "JSON produit invalide" });
    }

    // Champs obligatoires
    const requiredFields = ["title","description","price","stock","genre","categorie"];
    for (const field of requiredFields) {
      if (!data[field])
        return res.status(400).json({ message: `Le champ ${field} est obligatoire` });
    }

    delete data.userId;

    const produit = await Produits.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    if (produit.userId !== req.auth.userId)
      return res.status(403).json({ message: "Non autorisé" });

    // Gestion des images
    const existingImages = req.body.existingImages ? JSON.parse(req.body.existingImages) : [];
    const imagesToDelete = produit.imageUrl.filter(img => !existingImages.some(e => e.url === img.url));
    await supprimerImagesCloudinary(imagesToDelete);

    const newImages = (req.files || []).map(f => ({ url: f.path, public_id: f.filename }));
    data.imageUrl = [...existingImages, ...newImages];

    const updatedProduit = await Produits.findByIdAndUpdate(req.params.id, data, { new: true });
    res.status(200).json({ message: "Produit modifié avec succès", produit: updatedProduit });

  } catch (err) {
    console.error("🔥 ERREUR update produit:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// SUPPRIMER UN PRODUIT
// ===============================
exports.deleteProduit = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    // Vérification admin ou propriétaire
    if (produit.userId !== req.auth.userId /* || req.auth.isAdmin */)
      return res.status(403).json({ message: "Non autorisé" });

    await supprimerImagesCloudinary(produit.imageUrl);
    await Produits.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Produit supprimé avec succès" });

  } catch (err) {
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
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });
    res.status(200).json(produit);
  } catch (err) {
    console.error("🔥 ERREUR getProduitById:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// AJOUTER COMMENTAIRE
// ===============================
exports.ajouterCommentaire = async (req, res) => {
  try {
    const { message, rating } = req.body;
    if (!message || rating == null)
      return res.status(400).json({ message: "Message et note requis" });

    const produit = await Produits.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    const commentaire = { user: req.auth.userId || "Anonyme", message, rating };
    produit.commentaires.push(commentaire);
    await produit.save();

    res.status(201).json(commentaire);
  } catch (err) {
    console.error("🔥 ERREUR addCommentaire:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// SUPPRIMER COMMENTAIRE
// ===============================
exports.supprimerCommentaire = async (req, res) => {
  try {
    const { produitId, commentaireId } = req.params;
    const produit = await Produits.findById(produitId);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    produit.commentaires = produit.commentaires.filter(c => c._id.toString() !== commentaireId);
    await produit.save();

    res.status(200).json({ message: "Commentaire supprimé avec succès" });
  } catch (err) {
    console.error("🔥 ERREUR deleteCommentaire:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// RECOMMANDATIONS PRODUITS
// ===============================
exports.getRecommendations = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

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
