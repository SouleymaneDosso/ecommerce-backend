const Produits = require("../models/produits");
const cloudinary = require("../config/cloudinary");

exports.sauvegarderProduits = async (req, res) => {
  console.log("req.admin:", req.admin);
  if (!req.admin) {
    return res.status(401).json({ message: "Admin non authentifié" });
  }

  try {
    // 1️⃣ vérification images
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ message: "Au moins une image est requise" });
    }

    // 2️⃣ format images Cloudinary
    const images = req.files.map((file, index) => ({
      url: file.path,
      publicId: file.filename,
      isMain: index === 0,
    }));

    // 3️⃣ stockParVariation (JSON depuis FormData)
    let stockParVariation = {};
    if (req.body.stockParVariation) {
      stockParVariation = JSON.parse(req.body.stockParVariation);
    }

    // 4️⃣ création produit
    const produit = await Produits.create({
      title: req.body.title,
      description: req.body.description,
      price: Number(req.body.price),
      stock: Number(req.body.stock) || 0,
      tailles: req.body.tailles ? JSON.parse(req.body.tailles) : [],
      couleurs: req.body.couleurs ? JSON.parse(req.body.couleurs) : [],
      stockParVariation,
      genre: req.body.genre,
      categorie: req.body.categorie,
      badge: req.body.badge || null,
      hero: req.body.hero === "true",
      images,
      userId: req.admin._id,
    });

    res.status(201).json(produit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===============================
// MODIFIER PRODUIT (Admin / Propriétaire)
// ===============================
exports.updateProduit = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit) {
      return res.status(404).json({ message: "Produit introuvable" });
    }

    // --------------------------
    // 1️⃣ Supprimer des images existantes si demandé
    // --------------------------
    if (req.body.imagesToDelete) {
      // tableau d'IDs Cloudinary à supprimer
      const idsToDelete = JSON.parse(req.body.imagesToDelete);

      produit.images = produit.images.filter((img) => {
        if (idsToDelete.includes(img.publicId)) {
          // supprimer de Cloudinary
          cloudinary.uploader.destroy(img.publicId);
          return false; // enlever de tableau
        }
        return true;
      });
    }

    // --------------------------
    // 2️⃣ Ajouter nouvelles images uploadées
    // --------------------------
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file, index) => ({
        url: file.path,
        publicId: file.filename,
        isMain: false, // on peut gérer différemment si besoin
      }));
      produit.images.push(...newImages);
    }

    // --------------------------
    // 3️⃣ Mettre à jour les autres champs
    // --------------------------
    const champs = [
      "title",
      "description",
      "price",
      "stock",
      "tailles",
      "couleurs",
      "stockParVariation",
      "genre",
      "categorie",
      "badge",
      "hero",
    ];

    champs.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "tailles" || field === "couleurs") {
          produit[field] = JSON.parse(req.body[field]);
        } else if (field === "stockParVariation") {
          produit[field] = JSON.parse(req.body[field]);
        } else if (field === "hero") {
          produit[field] = req.body[field] === "true";
        } else if (field === "price" || field === "stock") {
          produit[field] = Number(req.body[field]);
        } else {
          produit[field] = req.body[field];
        }
      }
    });

    await produit.save();
    res.status(200).json(produit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// ===============================
// SUPPRIMER PRODUIT
// ===============================
exports.deleteProduit = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit) {
      return res.status(404).json({ message: "Produit introuvable" });
    }

    // suppression sécurisée des images sur Cloudinary
    for (const img of produit.images) {
      try {
        if (img.publicId) {
          await cloudinary.uploader.destroy(img.publicId);
        }
      } catch (err) {
        console.error(`Erreur Cloudinary pour ${img.publicId}:`, err.message);
      }
    }

    // suppression du produit
    await produit.deleteOne();

    res.json({ message: "Produit et toutes ses images supprimés avec succès" });
  } catch (error) {
    console.error("Erreur deleteProduit:", error.message);
    res.status(500).json({ message: error.message });
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
      user: req.admin ? req.admin._id.toString() : req.auth.userId, // si admin ou client
      message,
      rating,
      createdAt: new Date(),
    };

    produit.commentaires.push(commentaire);

    // Recalcul averageRating
    const total = produit.commentaires.reduce((acc, c) => acc + c.rating, 0);
    produit.averageRating = parseFloat(
      (total / produit.commentaires.length).toFixed(1)
    );

    await produit.save();
    res.status(201).json(commentaire);
  } catch (err) {
    console.error("🔥 ERREUR ajouterCommentaire:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// SUPPRIMER COMMENTAIRE (Admin / Propriétaire)
// ===============================
exports.supprimerCommentaire = async (req, res) => {
  try {
    const { produitId, commentaireId } = req.params;
    const produit = await Produits.findById(produitId);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

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
    console.error("🔥 ERREUR supprimerCommentaire:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// GET COMMENTAIRES d'un produit
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
