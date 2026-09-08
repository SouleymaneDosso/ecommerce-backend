const Precommande = require("../models/precommande");
const Produits = require("../models/produits");
const Video = require("../models/video");
const User = require("../models/User");
const mongoose = require("mongoose");

/* =====================================================
   NUMÉRO DE DÉPÔT
===================================================== */

const getNumeroDepot = () => {
  return process.env.PRECOMMANDE_NUMERO_DEPOT || "";
};

/* =====================================================
   MODÈLES À VENIR
===================================================== */

exports.getModelesPrecommande = async (req, res) => {
  try {
    const produits = await Produits.find({
      precommande: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    const videos = await Video.find({
      produitId: { $in: produits.map((produit) => produit._id) },
    }).lean();

    const videoMap = new Map(
      videos.map((video) => [video.produitId.toString(), video]),
    );

    const result = produits.map((produit) => {
      const imagePrincipale =
        produit.images?.find((img) => img.isMain)?.url ||
        produit.images?.[0]?.url ||
        "";

      const video = videoMap.get(produit._id.toString()) || null;

      return {
        _id: produit._id,
        title: produit.title,
        description: produit.description,
        price: produit.price,
        image: imagePrincipale,
        images: produit.images || [],
        video: video
          ? {
              _id: video._id,
              url: video.url,
              thumbnail: video.thumbnail,
              title: video.title,
            }
          : null,
        categorie: produit.categorie,
        genre: produit.genre,
        badge: produit.badge,
        tailles: produit.tailles || [],
        couleurs: produit.couleurs || [],
        stockParVariation: produit.stockParVariation || {},
        montantDepot: produit.montantDepot,
        dateDisponibilite: produit.dateDisponibilite,
      };
    });

    return res.status(200).json({
      modeles: result,
    });
  } catch (error) {
    console.error("GET MODELES PRECOMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de la récupération des modèles",
    });
  }
};

/* =====================================================
   INFORMATIONS DÉPÔT
===================================================== */

exports.getInformationsDepot = async (req, res) => {
  try {
    const numeroDepot = getNumeroDepot();

    if (!numeroDepot) {
      return res.status(500).json({
        message: "Le numéro de dépôt n'est pas configuré sur le serveur",
      });
    }

    return res.status(200).json({
      numeroDepot,
      services: ["orange", "wave"],
    });
  } catch (error) {
    console.error("GET INFOS DEPOT ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

/* =====================================================
   CRÉER UNE PRÉCOMMANDE
===================================================== */

exports.creerPrecommande = async (req, res) => {
  try {
    const {
      produitId,
      service,
      numeroDepot,
      referenceDepot,
      taille,
      couleur,
      quantite,
    } = req.body;

    /* =========================
       VALIDATION DE BASE
    ========================= */

    if (!produitId) {
      return res.status(400).json({
        message: "Le modèle est requis",
      });
    }

    if (!service) {
      return res.status(400).json({
        message: "Le service de paiement est requis",
      });
    }

    if (typeof referenceDepot !== "string" || !referenceDepot.trim()) {
      return res.status(400).json({
        message: "La référence du dépôt est requise",
      });
    }

    if (typeof numeroDepot !== "string" || !numeroDepot.trim()) {
      return res.status(400).json({
        message: "Le numéro utilisé pour le dépôt est requis",
      });
    }

    /* =========================
       VALIDATION SERVICE
    ========================= */

    if (!["orange", "wave"].includes(service)) {
      return res.status(400).json({
        message: "Service de paiement invalide",
      });
    }

    /* =========================
       VALIDATION ID
    ========================= */

    if (!mongoose.Types.ObjectId.isValid(produitId)) {
      return res.status(400).json({
        message: "Identifiant du modèle invalide",
      });
    }

    /* =========================
       QUANTITÉ
    ========================= */

    const quantiteFinale = Number(quantite);

    if (!Number.isInteger(quantiteFinale) || quantiteFinale < 1) {
      return res.status(400).json({
        message: "La quantité doit être un nombre entier supérieur à 0",
      });
    }

    /* =========================
       RÉCUPÉRATION PRODUIT
    ========================= */

    const produit = await Produits.findById(produitId);

    if (!produit) {
      return res.status(404).json({
        message: "Modèle introuvable",
      });
    }

    /* =========================
       VÉRIFICATION PRÉCOMMANDE
    ========================= */

    if (!produit.precommande) {
      return res.status(400).json({
        message: "Ce modèle n'est pas disponible en précommande",
      });
    }

    /* =========================
       VALIDATION TAILLE
    ========================= */

    if (Array.isArray(produit.tailles) && produit.tailles.length > 0) {
      if (!taille) {
        return res.status(400).json({
          message: "Veuillez sélectionner une taille",
        });
      }

      if (!produit.tailles.includes(taille)) {
        return res.status(400).json({
          message: "La taille sélectionnée est invalide",
        });
      }
    }

    /* =========================
       VALIDATION COULEUR
    ========================= */

    if (Array.isArray(produit.couleurs) && produit.couleurs.length > 0) {
      if (!couleur) {
        return res.status(400).json({
          message: "Veuillez sélectionner une couleur",
        });
      }

      if (!produit.couleurs.includes(couleur)) {
        return res.status(400).json({
          message: "La couleur sélectionnée est invalide",
        });
      }
    }

    /* =========================
       STOCK PAR VARIATION
    ========================= */

    let stockDisponible = 0;

    const stockParVariation = produit.stockParVariation;

    if (stockParVariation && taille) {
      let variationTaille = null;

      /*
        Mongoose Map
      */
      if (typeof stockParVariation.get === "function") {
        variationTaille = stockParVariation.get(taille);
      } else {
        /*
          Objet JSON
        */
        variationTaille = stockParVariation[taille];
      }

      /* =========================
         AVEC COULEUR
      ========================= */

      if (couleur) {
        if (variationTaille) {
          if (typeof variationTaille.get === "function") {
            stockDisponible = Number(variationTaille.get(couleur) || 0);
          } else {
            stockDisponible = Number(variationTaille[couleur] || 0);
          }
        }
      } else {

      /* =========================
         SANS COULEUR
      ========================= */
        if (typeof variationTaille === "number") {
          stockDisponible = variationTaille;
        } else if (variationTaille?.general !== undefined) {
          stockDisponible = Number(variationTaille.general || 0);
        }
      }
    }

    /* =========================
       VÉRIFICATION STOCK
    ========================= */

    if (stockDisponible <= 0) {
      return res.status(400).json({
        message: "Cette variation n'est actuellement plus disponible",
      });
    }

    if (quantiteFinale > stockDisponible) {
      return res.status(400).json({
        message: `Stock insuffisant. Il reste seulement ${stockDisponible} article(s) pour cette variation.`,
      });
    }

    /* =========================
       NUMÉRO DE DÉPÔT
    ========================= */

    const numeroDepotAdmin = getNumeroDepot();

    if (!numeroDepotAdmin) {
      return res.status(500).json({
        message: "Le numéro de dépôt n'est pas configuré",
      });
    }

    /* =========================
       PRÉCOMMANDE EXISTANTE
    ========================= */

    const dejaEnAttente = await Precommande.findOne({
      clientId: req.auth.userId,
      produitId: produit._id,
      statut: "PENDING",
    });

    if (dejaEnAttente) {
      return res.status(400).json({
        message: "Vous avez déjà une précommande en attente pour ce modèle",
        precommande: dejaEnAttente,
      });
    }

    /* =========================
       IMAGE PRINCIPALE
    ========================= */

    const imagePrincipale =
      produit.images?.find((img) => img.isMain)?.url ||
      produit.images?.[0]?.url ||
      "";

    /* =========================
       VIDÉO
    ========================= */

    const video = produit.videoId
      ? await Video.findById(produit.videoId).lean()
      : null;

    /* =========================
       DÉPÔT UNITAIRE
    ========================= */

    const montantDepotUnitaire =
      produit.montantDepot !== null && produit.montantDepot !== undefined
        ? Number(produit.montantDepot)
        : Math.ceil(Number(produit.price) * 0.3);

    if (montantDepotUnitaire <= 0) {
      return res.status(400).json({
        message: "Le montant du dépôt doit être supérieur à 0",
      });
    }

    /* =========================
       DÉPÔT TOTAL
    ========================= */

    const montantDepot = montantDepotUnitaire * quantiteFinale;

    /* =========================
       CRÉATION
    ========================= */

    const precommande = await Precommande.create({
      clientId: req.auth.userId,

      produitId: produit._id,

      modele: {
        title: produit.title,

        image: imagePrincipale,

        prix: Number(produit.price),

        video: video?.url || "",
      },

      /* =========================
           VARIATION
        ========================= */

      taille: taille || "",

      couleur: couleur || "",

      quantite: quantiteFinale,

      /* =========================
           DÉPÔT
        ========================= */

      montantDepot,

      service,

      /*
          On conserve le numéro du client
          qui a effectué le dépôt.
        */
      numeroDepot: numeroDepot.trim(),

      referenceDepot: referenceDepot.trim(),

      /* =========================
           STATUT
        ========================= */

      statut: "PENDING",

      submittedAt: new Date(),
    });

    /* =========================
       RÉPONSE
    ========================= */

    return res.status(201).json({
      message: "Précommande envoyée. Elle est en attente de vérification.",

      precommande,
    });
  } catch (error) {
    console.error("CREER PRECOMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de la création de la précommande",

      error: error.message,
    });
  }
};

/* =====================================================
   MES PRÉCOMMANDES
===================================================== */

exports.getMesPrecommandes = async (req, res) => {
  try {
    const precommandes = await Precommande.find({
      clientId: req.auth.userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      precommandes,
    });
  } catch (error) {
    console.error("GET MES PRECOMMANDES ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de la récupération de vos précommandes",
    });
  }
};

/* =====================================================
   PRÉCOMMANDE PAR ID
===================================================== */

exports.getPrecommandeById = async (req, res) => {
  try {
    const { id } = req.params;

    const precommande = await Precommande.findOne({
      _id: id,
      clientId: req.auth.userId,
    }).lean();

    if (!precommande) {
      return res.status(404).json({
        message: "Précommande introuvable",
      });
    }

    return res.status(200).json({
      precommande,
    });
  } catch (error) {
    console.error("GET PRECOMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};

/* =====================================================
   ADMIN : TOUTES LES PRÉCOMMANDES
===================================================== */

exports.getPrecommandesAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 20;

    const skip = (page - 1) * limit;

    const total = await Precommande.countDocuments();

    const precommandes = await Precommande.find()
      .populate("clientId", "username email telephone")
      .populate("produitId", "title price images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      precommandes,
    });
  } catch (error) {
    console.error("ADMIN PRECOMMANDES ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de la récupération des précommandes",
    });
  }
};

/* =====================================================
   ADMIN : ACCEPTER
===================================================== */

exports.accepterPrecommande = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminComment } = req.body;

    const precommande = await Precommande.findById(id);

    if (!precommande) {
      return res.status(404).json({
        message: "Précommande introuvable",
      });
    }

    if (precommande.statut === "ACCEPTED") {
      return res.status(400).json({
        message: "Précommande déjà acceptée",
      });
    }

    if (precommande.statut === "REJECTED") {
      return res.status(400).json({
        message: "Une précommande refusée ne peut pas être acceptée",
      });
    }

    precommande.statut = "ACCEPTED";
    precommande.adminComment = adminComment || "";
    precommande.verifieAt = new Date();

    if (req.admin?._id) {
      precommande.verifiePar = req.admin._id;
    }

    await precommande.save();

    return res.status(200).json({
      message: "Précommande acceptée",
      precommande,
    });
  } catch (error) {
    console.error("ACCEPTER PRECOMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de l'acceptation",
    });
  }
};

/* =====================================================
   ADMIN : REFUSER
===================================================== */

exports.refuserPrecommande = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminComment } = req.body;

    const precommande = await Precommande.findById(id);

    if (!precommande) {
      return res.status(404).json({
        message: "Précommande introuvable",
      });
    }

    if (precommande.statut === "ACCEPTED") {
      return res.status(400).json({
        message: "Une précommande déjà acceptée ne peut pas être refusée",
      });
    }

    if (precommande.statut === "REJECTED") {
      return res.status(400).json({
        message: "Précommande déjà refusée",
      });
    }

    precommande.statut = "REJECTED";
    precommande.adminComment = adminComment || "";
    precommande.verifieAt = new Date();

    if (req.admin?._id) {
      precommande.verifiePar = req.admin._id;
    }

    await precommande.save();

    return res.status(200).json({
      message: "Précommande refusée",
      precommande,
    });
  } catch (error) {
    console.error("REFUSER PRECOMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors du refus",
    });
  }
};
