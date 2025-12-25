const Produits = require("../models/produits");
const cloudinary = require("../config/cloudinary");

exports.sauvegarderProduits = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Au moins une image est requise" });
    }

    // ===============================
    // 1. DATA
    // ===============================
    const {
      title,
      description,
      price,
      genre,
      categorie,
      badge,
      tailles,
      couleurs,
      stockParVariation
    } = req.body;

    // ===============================
    // 2. PARSE JSON
    // ===============================
    const parsedTailles = typeof tailles === "string" ? JSON.parse(tailles) : tailles;
    const parsedCouleurs = typeof couleurs === "string" ? JSON.parse(couleurs) : couleurs;
    const parsedStock = typeof stockParVariation === "string"
      ? JSON.parse(stockParVariation)
      : stockParVariation;

    // ===============================
    // 3. CALCUL STOCK TOTAL
    // ===============================
    let stockTotal = 0;
    for (const color of Object.keys(parsedStock)) {
      for (const size of Object.keys(parsedStock[color])) {
        stockTotal += Number(parsedStock[color][size]) || 0;
      }
    }

    // ===============================
    // 4. IMAGES CLOUDINARY
    // ===============================
    const images = req.files.map((file, index) => ({
      url: file.path,
      publicId: file.filename,
      isMain: index === 0,
    }));

    // ===============================
    // 5. SAUVEGARDE PRODUIT
    // ===============================
    const produit = new Produits({
      title,
      description,
      price,
      genre,
      categorie,
      badge: badge || null,
      images,
      tailles: parsedTailles,
      couleurs: parsedCouleurs,
      stock: stockTotal,
      stockParVariation: parsedStock,
      userId: req.admin._id,
    });

    await produit.save();

    res.status(201).json({
      message: "Produit créé avec succès",
      produit,
    });
  } catch (error) {
    console.error("🔥 ERREUR sauvegarderProduits:", error);
    res.status(400).json({ message: error.message });
  }
};

// ===============================
// MODIFIER UN PRODUIT (Admin / Propriétaire)
// ===============================
exports.updateProduit = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });
    if (produit.userId !== req.auth.userId)
      return res.status(403).json({ message: "Non autorisé" });

    let images = [];

    // 1️⃣ Images existantes à conserver
    if (req.body.existingImages) {
      const existing = JSON.parse(req.body.existingImages);
      images.push(...existing);
    }

    // 2️⃣ Upload nouvelles images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "produits",
        });
        images.push({
          url: result.secure_url,
          publicId: result.public_id,
          isMain: false, // définir l'image principale après
        });
      }
    }

    // 3️⃣ Définir image principale
    if (req.body.mainImagePublicId) {
      images = images.map((img) => ({
        ...img,
        isMain: img.publicId === req.body.mainImagePublicId,
      }));
    } else if (images.length > 0) {
      images[0].isMain = true; // fallback première image
    }

    // 4️⃣ Supprimer les images Cloudinary supprimées
    const toDelete = produit.images.filter(
      (oldImg) => !images.find((img) => img.publicId === oldImg.publicId)
    );
    for (const img of toDelete) {
      await cloudinary.uploader.destroy(img.publicId);
    }

    // 5️⃣ Parse stockParVariation si string
    if (req.body.stockParVariation) {
      req.body.stockParVariation = JSON.parse(req.body.stockParVariation);
    }

    // 6️⃣ Mise à jour produit
    const updatedProduit = await Produits.findByIdAndUpdate(
      req.params.id,
      { ...req.body, images },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "Produit mis à jour", produit: updatedProduit });
  } catch (error) {
    console.error("🔥 ERREUR updateProduit:", error);
    res.status(400).json({ error: error.message });
  }
};
// ===============================
// SUPPRIMER UN PRODUIT
// ===============================
exports.deleteProduit = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    if (produit.userId !== req.auth.userId)
      return res.status(403).json({ message: "Non autorisé" });

    // Suppression Cloudinary
    for (const img of produit.images) {
      await cloudinary.uploader.destroy(img.publicId);
    }

    await Produits.deleteOne({ _id: req.params.id });

    res.status(200).json({ message: "Produit supprimé avec succès" });
  } catch (error) {
    console.error("🔥 ERREUR deleteProduit:", error);
    res.status(500).json({ error: error.message });
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
