const Produits = require("../models/produits");
const fs = require("fs");

// ===============================
// AJOUTER UN PRODUIT (Admin)
// ===============================
exports.sauvegarderProduits = (req, res, next) => {
  const imagesSauvegarger = JSON.parse(req.body.produit);
  delete imagesSauvegarger._id;
  delete imagesSauvegarger._userId;
  const produit = new Produits({
    ...imagesSauvegarger,
    userId: req.auth.userId,
    imageUrl: `${req.protocol}://${req.get("host")}/images/${req.file.filename}`,
  });

  produit
    .save()
    .then(() => {
      res.status(201).json({ message: "Objet enregistré !" });
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};

// ===============================
// MODIFIER UN PRODUIT (Admin / Propriétaire)
// ===============================
exports.updateProduit = (req, res, next) => {
  const modifierProduit = req.file
    ? {
        ...JSON.parse(req.body.produit),
        imageUrl: `${req.protocol}://${req.get("host")}/images/${req.file.filename}`,
      }
    : { ...req.body };

  delete modifierProduit._userId;
  Produits.findOne({ _id: req.params.id })
    .then((produit) => {
      if (produit.userId != req.auth.userId) {
        res.status(401).json({ message: "Not authorized" });
      } else {
        Produits.updateOne(
          { _id: req.params.id },
          { ...modifierProduit, _id: req.params.id }
        )
          .then(() => res.status(200).json({ message: "Objet modifié!" }))
          .catch((error) => res.status(401).json({ error }));
      }
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};
// ===============================
// SUPPRIMER UN PRODUIT
// ===============================
exports.deleteProduit = (req, res, next) => {
  Produits.findOne({ _id: req.params.id })
    .then((produit) => {
      if (produit.userId != req.auth.userId) {
        res.status(401).json({ message: "Not authorized" });
      } else {
        const filename = produit.imageUrl.split("/images/")[1];
        fs.unlink(`images/${filename}`, () => {
          Produits.deleteOne({ _id: req.params.id })
            .then(() => {
              res.status(200).json({ message: "Objet supprimé !" });
            })
            .catch((error) => res.status(401).json({ error }));
        });
      }
    })
    .catch((error) => {
      res.status(500).json({ error });
    });
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
