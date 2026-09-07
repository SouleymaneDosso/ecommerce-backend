const Precommande = require("../models/precommande");
const Produits = require("../models/produits");
const Video = require("../models/video");
const User = require("../models/User");

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
      stock: { $lte: 0 },
    })
      .sort({ createdAt: -1 })
      .lean();

    const videos = await Video.find()
      .sort({ _id: -1 })
      .lean();

    const result = produits.map((produit) => {
      const imagePrincipale =
        produit.images?.find((img) => img.isMain)?.url ||
        produit.images?.[0]?.url ||
        "";

      /*
       * Pour l'instant on associe la vidéo la plus récente.
       * On pourra ensuite faire une vraie liaison Produit <-> Video.
       */
      const video = videos[0] || null;

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
      };
    });

    return res.status(200).json({
      modeles: result,
    });
  } catch (error) {
    console.error(
      "GET MODELES PRECOMMANDE ERROR:",
      error,
    );

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
        message:
          "Le numéro de dépôt n'est pas configuré sur le serveur",
      });
    }

    return res.status(200).json({
      numeroDepot,
      services: ["orange", "wave"],
    });
  } catch (error) {
    console.error(
      "GET INFOS DEPOT ERROR:",
      error,
    );

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
      referenceDepot,
    } = req.body;

    if (!produitId || !service || !referenceDepot) {
      return res.status(400).json({
        message:
          "Modèle, service et référence du dépôt sont requis",
      });
    }

    if (!["orange", "wave"].includes(service)) {
      return res.status(400).json({
        message: "Service de paiement invalide",
      });
    }

    const produit = await Produits.findById(produitId);

    if (!produit) {
      return res.status(404).json({
        message: "Modèle introuvable",
      });
    }

    const numeroDepot = getNumeroDepot();

    if (!numeroDepot) {
      return res.status(500).json({
        message:
          "Le numéro de dépôt n'est pas configuré",
      });
    }

    /*
     * Éviter qu'un même client envoie plusieurs
     * précommandes identiques en attente.
     */
    const dejaEnAttente =
      await Precommande.findOne({
        clientId: req.auth.userId,
        produitId: produit._id,
        statut: "PENDING",
      });

    if (dejaEnAttente) {
      return res.status(400).json({
        message:
          "Vous avez déjà une précommande en attente pour ce modèle",
        precommande: dejaEnAttente,
      });
    }

    const imagePrincipale =
      produit.images?.find(
        (img) => img.isMain,
      )?.url ||
      produit.images?.[0]?.url ||
      "";

    /*
     * Le montant du dépôt est actuellement calculé
     * à 30% du prix.
     */
    const montantDepot = Math.ceil(
      Number(produit.price) * 0.3,
    );

    const precommande =
      await Precommande.create({
        clientId: req.auth.userId,

        produitId: produit._id,

        modele: {
          title: produit.title,
          image: imagePrincipale,
          prix: Number(produit.price),
          video: "",
        },

        montantDepot,

        service,

        numeroDepot,

        referenceDepot:
          referenceDepot.trim(),

        statut: "PENDING",

        submittedAt: new Date(),
      });

    return res.status(201).json({
      message:
        "Précommande envoyée. Elle est en attente de vérification.",
      precommande,
    });
  } catch (error) {
    console.error(
      "CREER PRECOMMANDE ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Erreur lors de la création de la précommande",
      error: error.message,
    });
  }
};

/* =====================================================
   MES PRÉCOMMANDES
===================================================== */

exports.getMesPrecommandes = async (req, res) => {
  try {
    const precommandes =
      await Precommande.find({
        clientId: req.auth.userId,
      })
        .sort({ createdAt: -1 })
        .lean();

    return res.status(200).json({
      precommandes,
    });
  } catch (error) {
    console.error(
      "GET MES PRECOMMANDES ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Erreur lors de la récupération de vos précommandes",
    });
  }
};

/* =====================================================
   PRÉCOMMANDE PAR ID
===================================================== */

exports.getPrecommandeById = async (req, res) => {
  try {
    const { id } = req.params;

    const precommande =
      await Precommande.findOne({
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
    console.error(
      "GET PRECOMMANDE ERROR:",
      error,
    );

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
    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 20;

    const skip = (page - 1) * limit;

    const total =
      await Precommande.countDocuments();

    const precommandes =
      await Precommande.find()
        .populate(
          "clientId",
          "username email telephone",
        )
        .populate(
          "produitId",
          "title price images",
        )
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
    console.error(
      "ADMIN PRECOMMANDES ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Erreur lors de la récupération des précommandes",
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

    const precommande =
      await Precommande.findById(id);

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
        message:
          "Une précommande refusée ne peut pas être acceptée",
      });
    }

    precommande.statut = "ACCEPTED";
    precommande.adminComment =
      adminComment || "";
    precommande.verifieAt = new Date();

    if (req.admin?._id) {
      precommande.verifiePar =
        req.admin._id;
    }

    await precommande.save();

    return res.status(200).json({
      message: "Précommande acceptée",
      precommande,
    });
  } catch (error) {
    console.error(
      "ACCEPTER PRECOMMANDE ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Erreur lors de l'acceptation",
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

    const precommande =
      await Precommande.findById(id);

    if (!precommande) {
      return res.status(404).json({
        message: "Précommande introuvable",
      });
    }

    if (precommande.statut === "ACCEPTED") {
      return res.status(400).json({
        message:
          "Une précommande déjà acceptée ne peut pas être refusée",
      });
    }

    if (precommande.statut === "REJECTED") {
      return res.status(400).json({
        message: "Précommande déjà refusée",
      });
    }

    precommande.statut = "REJECTED";
    precommande.adminComment =
      adminComment || "";
    precommande.verifieAt = new Date();

    if (req.admin?._id) {
      precommande.verifiePar =
        req.admin._id;
    }

    await precommande.save();

    return res.status(200).json({
      message: "Précommande refusée",
      precommande,
    });
  } catch (error) {
    console.error(
      "REFUSER PRECOMMANDE ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Erreur lors du refus",
    });
  }
};