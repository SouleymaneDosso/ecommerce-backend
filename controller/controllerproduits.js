const Produits = require("../models/produits");
const cloudinary = require("../config/cloudinary");

exports.sauvegarderProduits = async (req, res) => {
  try {
    console.log("BODY:", req.body);
    console.log("FILES reçus:", req.files.map(f => f.originalname));

    if (!req.body.produits) return res.status(400).json({ message: "Données produit manquantes" });

    const data = JSON.parse(req.body.produits);

    if (!req.files || req.files.length === 0) return res.status(400).json({ message: "Au moins une image requise" });

    // On prend les URLs Cloudinary générées par Multer
    const images = req.files.map(f => f.path); 

    const produit = new Produits({
      ...data,
      userId: req.auth.userId,
      imageUrl: images,
    });

    await produit.save();
    console.log("✅ Produit ajouté:", produit._id);

    res.status(201).json({ message: "Produit ajouté avec succès", produit });
  } catch (err) {
    console.error("🔥 ERREUR ajout produit:", err);
    res.status(500).json({ message: err.message });
  }
};


// ===============================
// AJOUTER UN COMMENTAIRE
// ===============================
exports.ajouterCommentaire = async (req, res) => {
  try {
    const { message, rating } = req.body;
    if (!message || !rating)
      return res.status(400).json({ message: "Message et note requis" });

    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    const commentaire = {
      user: req.auth.userId || "Anonyme",
      message,
      rating,
    };

    produit.commentaires.push(commentaire);
    await produit.save();

    res.status(201).json(commentaire);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur ajout commentaire" });
  }
};

// ===============================
// GET RECOMMANDATIONS
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
    console.error(err);
    res.status(500).json({ message: "Erreur recommandations" });
  }
};

// ===============================
// SUPPRIMER COMMENTAIRE PAR ADMIN
// ===============================
exports.supprimerCommentaire = async (req, res) => {
  try {
    const { produitId, commentaireId } = req.params;

    const produit = await Produits.findById(produitId);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    produit.commentaires = produit.commentaires.filter(
      (c) => c._id.toString() !== commentaireId
    );

    await produit.save();

    res.status(200).json({ message: "Commentaire supprimé avec succès" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression du commentaire" });
  }
};

// ===============================
// TOUS LES PRODUITS
// ===============================
exports.getProduits = async (req, res) => {
  try {
    const produits = await Produits.find();
    res.status(200).json(produits);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ===============================
// PRODUIT PAR ID
// ===============================
exports.getProduitById = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    res.status(200).json(produit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
// ===============================
// MODIFIER UN PRODUIT
// ===============================
exports.updateProduit = async (req, res) => {
  try {
    if (!req.body.produits) {
      return res.status(400).json({ message: "Aucune donnée produit envoyée" });
    }

    const data = JSON.parse(req.body.produits);

    const requiredFields = [
      "title",
      "description",
      "price",
      "stock",
      "genre",
      "categorie",
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return res
          .status(400)
          .json({ message: `Le champ ${field} est obligatoire` });
      }
    }

    // Sécurité
    delete data.userId;

    // Conversion stockParVariation en Number
    if (data.stockParVariation) {
      const variations = {};
      for (const size in data.stockParVariation) {
        variations[size] = {};
        for (const color in data.stockParVariation[size]) {
          variations[size][color] = Number(
            data.stockParVariation[size][color]
          );
        }
      }
      data.stockParVariation = variations;
    }

    const produit = await Produits.findById(req.params.id);
    if (!produit) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    if (produit.userId !== req.auth.userId) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    // Images conservées côté frontend
    const existingImages = req.body.existingImages
      ? JSON.parse(req.body.existingImages)
      : [];

    // 🔥 Supprimer de Cloudinary les images retirées
    for (const img of produit.imageUrl) {
      if (!existingImages.includes(img)) {
        try {
          const parts = img.split("/");
          const lastPart = parts[parts.length - 1];
          const publicId = `produits/${lastPart.split(".")[0]}`;
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.warn(
            "Erreur suppression image Cloudinary :",
            err.message
          );
        }
      }
    }

    // 🔥 NOUVELLES IMAGES (déjà uploadées par Multer)
    const newImages = (req.files || []).map((file) => file.path);

    // Fusion images
    data.imageUrl = [...existingImages, ...newImages];

    const updatedProduit = await Produits.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true }
    );

    res.status(200).json({
      message: "Produit modifié avec succès",
      produit: updatedProduit,
    });
  } catch (error) {
    console.error("🔥 ERREUR UPDATE PRODUIT :", error);
    res.status(500).json({ message: error.message });
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

    // Supprimer toutes les images du produit sur Cloudinary
    for (const img of produit.imageUrl) {
      const parts = img.split("/");
      const lastPart = parts[parts.length - 1];
      const publicId = `produits/${lastPart.split(".")[0]}`;
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn("Erreur suppression image Cloudinary:", err.message);
      }
    }

    await Produits.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");
    io.emit("produitSupprime", req.params.id);

    res.status(200).json({ message: "Produit supprimé avec succès" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
