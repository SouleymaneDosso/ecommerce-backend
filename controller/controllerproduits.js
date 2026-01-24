const Produits = require("../models/produits");
const cloudinary = require("../config/cloudinary");

/* ===============================
   HELPERS
================================ */
const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const isValidMainIndex = (index, length) =>
  Number.isInteger(index) && index >= 0 && index < length;

/* ===============================
   CREATE PRODUIT
================================ */
exports.sauvegarderProduits = async (req, res) => {
  if (!req.admin) {
    return res.status(401).json({ message: "Admin non authentifié" });
  }

  try {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ message: "Au moins une image est requise" });
    }

    const mainIndex = Number(req.body.mainImageIndex) || 0;

    const images = req.files.map((file, index) => ({
      url: file.path,
      publicId: file.filename,
      isMain: index === mainIndex,
    }));

    const produit = await Produits.create({
      title: req.body.title,
      description: req.body.description,
      price: Number(req.body.price),
      stock: Number(req.body.stock) || 0,
      tailles: safeParse(req.body.tailles, []),
      couleurs: safeParse(req.body.couleurs, []),
      stockParVariation: safeParse(req.body.stockParVariation, {}),
      genre: req.body.genre,
      categorie: req.body.categorie,
      badge: req.body.badge || null,
      hero: req.body.hero === "true",
      images,
      userId: req.admin._id,
    });

    const produitAvecVirtuals = await Produits.findById(produit._id).lean({
      virtuals: true,
    });

    res.status(201).json(produitAvecVirtuals);
  } catch (error) {
    console.error("❌ sauvegarderProduits:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ===============================
   UPDATE PRODUIT
================================ */
exports.updateProduit = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit introuvable" });

    const mainIndex = Number(req.body.mainImageIndex);

    /* -------- SUPPRESSION IMAGES -------- */
    if (req.body.imagesToDelete) {
      const idsToDelete = safeParse(req.body.imagesToDelete, []);

      await Promise.all(
        produit.images
          .filter((img) => idsToDelete.includes(img.publicId))
          .map((img) => cloudinary.uploader.destroy(img.publicId)),
      );

      produit.images = produit.images.filter(
        (img) => !idsToDelete.includes(img.publicId),
      );
    }

    /* -------- AJOUT NOUVELLES IMAGES -------- */
    let newImagesStartIndex = produit.images.length; // avant push des nouvelles
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        url: file.path,
        publicId: file.filename,
        isMain: false,
      }));
      produit.images.push(...newImages);
    }

    /* -------- IMAGE PRINCIPALE -------- */
    const totalImages = produit.images.length;
    if (isValidMainIndex(mainIndex, totalImages)) {
      produit.images.forEach((img, idx) => {
        img.isMain = idx === mainIndex; // idx = position dans tableau final
      });
    }

    /* -------- AUTRES CHAMPS -------- */
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
        if (["tailles", "couleurs", "stockParVariation"].includes(field)) {
          produit[field] = safeParse(req.body[field], []);
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
    res.status(200).json(produit.toJSON());
  } catch (error) {
    console.error("❌ updateProduit:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ===============================
   DELETE PRODUIT
================================ */
exports.deleteProduit = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit introuvable" });

    await Promise.all(
      produit.images.map((img) =>
        img.publicId
          ? cloudinary.uploader.destroy(img.publicId).catch(() => null)
          : null,
      ),
    );

    await produit.deleteOne();
    res.json({ message: "Produit supprimé avec succès" });
  } catch (error) {
    console.error("❌ deleteProduit:", error.message);
    res.status(500).json({ message: error.message });
  }
};

/* ===============================
   GET PRODUITS (pagination)
================================ */
exports.getProduits = async (req, res) => {
  try {
    const search = req.query.search;
    let filter = {};

    if (search) {
      filter = {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { categorie: { $regex: search, $options: "i" } },
        ],
      };
    }

    const produits = await Produits.find(filter)
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.status(200).json(produits);
  } catch (err) {
    console.error("🔥 getProduits:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* ===============================
   GET PRODUIT BY ID
================================ */
exports.getProduitById = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id).lean({
      virtuals: true,
    });
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    res.status(200).json(produit); // pas de toJSON()
  } catch (err) {
    console.error("🔥 getProduitById:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* ===============================
   COMMENTAIRES
================================ */
exports.ajouterCommentaire = async (req, res) => {
  try {
    if (!req.admin && !req.auth?.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const { message, rating } = req.body;
    if (!message || rating < 1 || rating > 5)
      return res.status(400).json({ message: "Message et note requis" });

    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    produit.commentaires.push({
      user: req.admin ? req.admin._id.toString() : req.auth.userId,
      message,
      rating,
      createdAt: new Date(),
    });

    const total = produit.commentaires.reduce((a, c) => a + c.rating, 0);
    produit.averageRating = Number(
      (total / produit.commentaires.length).toFixed(1),
    );

    await produit.save();
    res.status(201).json(produit.commentaires.at(-1));
  } catch (err) {
    console.error("🔥 ajouterCommentaire:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// virtual backend//////
exports.getNewProduits = async (req, res) => {
  try {
    // Nombre de jours pour considérer un produit comme "nouveau"
    const days = Number(process.env.NEW_PRODUCT_DAYS) || 7;

    // Date limite : tout ce qui a été créé après cette date est "nouveau"
    const dateLimit = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Récupération des produits nouveaux
    const produits = await Produits.find({
      createdAt: { $gte: dateLimit },
    })
      .sort({ createdAt: -1 }) // les plus récents en premier
      .limit(10); // optionnel : limite le nombre de produits

    res.status(200).json(produits);
  } catch (err) {
    console.error("🔥 getNewProduits:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* ===============================
   COMMENTAIRES
================================ */
exports.getCommentaires = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    res.json(produit.commentaires);
  } catch (err) {
    console.error("🔥 getCommentaires:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.supprimerCommentaire = async (req, res) => {
  try {
    const { produitId, commentaireId } = req.params;
    const produit = await Produits.findById(produitId);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    // ⚡ Chercher le commentaire en convertissant les IDs en string
    const commentaire = produit.commentaires.find(
      (c) => c._id.toString() === commentaireId.toString(),
    );
    if (!commentaire)
      return res.status(404).json({ message: "Commentaire non trouvé" });

    // Vérification autorisation
    if (!req.admin && commentaire.user !== req.auth?.userId)
      return res.status(403).json({ message: "Non autorisé" });

    // Supprimer le commentaire
    produit.commentaires = produit.commentaires.filter(
      (c) => c._id.toString() !== commentaireId.toString(),
    );

    // Recalculer la note moyenne
    produit.averageRating =
      produit.commentaires.length === 0
        ? 0
        : Number(
            (
              produit.commentaires.reduce((a, c) => a + c.rating, 0) /
              produit.commentaires.length
            ).toFixed(1),
          );

    await produit.save();
    res.json({ message: "Commentaire supprimé" });
  } catch (err) {
    console.error("🔥 supprimerCommentaire:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* ===============================
   RECOMMANDATIONS
================================ */
exports.getRecommendations = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit)
      return res.status(404).json({ message: "Produit non trouvé" });

    const min = produit.price * 0.8;
    const max = produit.price * 1.2;

    const recommandations = await Produits.find({
      categorie: produit.categorie,
      _id: { $ne: produit._id },
      price: { $gte: min, $lte: max },
    })
      .sort({ createdAt: -1 })
      .limit(4);

    res.json(recommandations.map((p) => p.toJSON()));
  } catch (err) {
    console.error("🔥 getRecommendations:", err.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
