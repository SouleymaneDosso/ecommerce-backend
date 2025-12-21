const Produits = require("../models/produits");
const fs = require("fs").promises;
const path = require("path");

// ===============================
// AJOUTER UN PRODUIT
// ===============================
exports.sauvegarderProduits = async (req, res) => {
  try {
    if (!req.body.produits) throw new Error("Aucune donnée produit envoyée");
    if (!req.files || req.files.length === 0) throw new Error("Au moins une image est requise");

    const produitsAjouter = JSON.parse(req.body.produits);

    const requiredFields = ["title", "description", "price", "stock", "genre", "categorie"];
    for (const field of requiredFields) {
      if (!produitsAjouter[field]) throw new Error(`Le champ ${field} est obligatoire`);
    }

    // Convertir stockParVariation en nombres purs
    if (produitsAjouter.stockParVariation) {
      const variations = {};
      for (const size in produitsAjouter.stockParVariation) {
        variations[size] = {};
        for (const color in produitsAjouter.stockParVariation[size]) {
          variations[size][color] = Number(produitsAjouter.stockParVariation[size][color]);
        }
      }
      produitsAjouter.stockParVariation = variations;
    }

    const images = req.files.map(
      (file) => `${req.protocol}://${req.get("host")}/images/${file.filename}`
    );

    const produit = new Produits({
      ...produitsAjouter,
      userId: req.auth.userId,
      imageUrl: images,
    });

    await produit.save();

    const io = req.app.get("io");
    io.emit("produitAjoute", produit);

    res.status(201).json({
      message: "Produit enregistré avec succès !",
      produit,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

exports.ajouterCommentaire = async (req, res) => {
  try {
    const { message, rating } = req.body;
    if (!message || !rating) {
      return res.status(400).json({ message: "Message et note requis" });
    }

    const produit = await Produits.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    const commentaire = {
      user: req.auth.userId || "Anonyme", // ou le nom de l'utilisateur
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

exports.getRecommendations = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    const prixMin = produit.price * 0.8; // 20% moins cher
    const prixMax = produit.price * 1.2; // 20% plus cher

    const recommandations = await Produits.find({
      categorie: produit.categorie,
      _id: { $ne: produit._id },      // exclure le produit actuel
      price: { $gte: prixMin, $lte: prixMax } // prix proche
    }).limit(4);

    res.status(200).json(recommandations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur recommandations" });
  }
};

// Supprimer un commentaire par admin
exports.supprimerCommentaire = async (req, res) => {
  try {
    const { produitId, commentaireId } = req.params;

    const produit = await Produits.findById(produitId);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    produit.commentaires = produit.commentaires.filter(c => c._id.toString() !== commentaireId);

    await produit.save();

    res.status(200).json({ message: "Commentaire supprimé avec succès" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la suppression du commentaire" });
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
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

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
    if (!req.body.produits) throw new Error("Aucune donnée produit envoyée");
    const data = JSON.parse(req.body.produits);

    const requiredFields = ["title", "description", "price", "stock", "genre", "categorie"];
    for (const field of requiredFields) {
      if (!data[field]) throw new Error(`Le champ ${field} est obligatoire`);
    }

    delete data.userId;

    // Convertir stockParVariation en nombres purs
    if (data.stockParVariation) {
      const variations = {};
      for (const size in data.stockParVariation) {
        variations[size] = {};
        for (const color in data.stockParVariation[size]) {
          variations[size][color] = Number(data.stockParVariation[size][color]);
        }
      }
      data.stockParVariation = variations;
    }

    const produit = await Produits.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    if (produit.userId !== req.auth.userId)
      return res.status(403).json({ message: "Non autorisé" });

    // Images existantes envoyées depuis le frontend
    const existingImages = req.body.existingImages ? JSON.parse(req.body.existingImages) : [];

    // Supprimer les images retirées physiquement
    for (const img of produit.imageUrl) {
      if (!existingImages.includes(img)) {
        const filename = img.split("/images/")[1];
        const filePath = path.join("images", filename);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          console.warn(`Impossible de supprimer ${filePath}: ${err.message}`);
        }
      }
    }

    // Ajouter nouvelles images uploadées
    const newImages = (req.files || []).map(
      (file) => `${req.protocol}://${req.get("host")}/images/${file.filename}`
    );

    // Combiner images existantes + nouvelles
    data.imageUrl = [...existingImages, ...newImages];

    const updatedProduit = await Produits.findByIdAndUpdate(req.params.id, data, { new: true });

    const io = req.app.get("io");
    io.emit("produitModifie", updatedProduit);

    res.status(200).json({
      message: "Produit modifié avec succès",
      produit: updatedProduit,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: error.message });
  }
};

// ===============================
// SUPPRIMER UN PRODUIT
// ===============================
exports.deleteProduit = async (req, res) => {
  try {
    const produit = await Produits.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: "Produit non trouvé" });

    // Supprimer toutes les images physiquement
    for (const img of produit.imageUrl) {
      const filename = img.split("/images/")[1];
      const filePath = path.join("images", filename);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.warn(`Impossible de supprimer ${filePath}: ${err.message}`);
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
