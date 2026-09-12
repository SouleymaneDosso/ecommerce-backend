const Precommande = require("../models/precommande");
const Produits = require("../models/produits");
const Video = require("../models/video");
const User = require("../models/User");
const mongoose = require("mongoose");
const Commandeapi = require("../models/paiementmodel");
const getNumeroDepot = () => {
  const numero = process.env.PRECOMMANDE_NUMERO_DEPOT;

  return numero ? numero.trim() : "";
};

/* =====================================================
   MODÈLES À VENIR
===================================================== */

exports.getModelesPrecommande = async (req, res) => {
  try {
    const produits = await Produits.find({
      precommande: true,
      disponible: false,
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

      // =========================
      // INFORMATIONS CLIENT
      // =========================
      client,
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
       VALIDATION CLIENT
    ========================= */

    if (!client || typeof client !== "object") {
      return res.status(400).json({
        message: "Les informations du client sont requises",
      });
    }

    const nom = String(client.nom || "").trim();
    const prenom = String(client.prenom || "").trim();
    const adresse = String(client.adresse || "").trim();
    const ville = String(client.ville || "").trim();
    const codePostal = String(client.codePostal || "").trim();
    const pays = String(client.pays || "").trim();
    const numero = String(client.numero || "").trim();

    if (!nom) {
      return res.status(400).json({
        message: "Le nom du client est requis",
      });
    }

    if (!prenom) {
      return res.status(400).json({
        message: "Le prénom du client est requis",
      });
    }

    if (!adresse) {
      return res.status(400).json({
        message: "L'adresse du client est requise",
      });
    }

    if (!ville) {
      return res.status(400).json({
        message: "La ville du client est requise",
      });
    }

    if (!codePostal) {
      return res.status(400).json({
        message: "Le code postal du client est requis",
      });
    }

    if (!pays) {
      return res.status(400).json({
        message: "Le pays du client est requis",
      });
    }

    if (!numero) {
      return res.status(400).json({
        message: "Le numéro du client est requis",
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

    if (!produit.precommande || produit.disponible) {
      return res.status(400).json({
        message: "Ce produit n'est plus ouvert à la précommande",
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
       NUMÉRO DE DÉPÔT ADMIN
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

    const dejaActive = await Precommande.findOne({
      clientId: req.auth.userId,
      produitId: produit._id,
      taille: taille || "",
      couleur: couleur || "",
      statut: {
        $in: [
          "PENDING",
          "ACCEPTED",
          "READY_TO_FINALIZE",
          "FINALIZATION_PENDING",
        ],
      },
    });

    if (dejaActive) {
      return res.status(400).json({
        message:
          "Vous avez déjà une précommande active pour cette variation.",
        precommande: dejaActive,
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
       CALCUL DES MONTANTS
    ========================= */

    const prixUnitaire = Number(produit.price);

    if (!Number.isFinite(prixUnitaire) || prixUnitaire <= 0) {
      return res.status(400).json({
        message: "Le prix du produit est invalide",
      });
    }

    const montantTotal = prixUnitaire * quantiteFinale;

    const montantDepotUnitaire =
      produit.montantDepot !== null &&
      produit.montantDepot !== undefined
        ? Number(produit.montantDepot)
        : Math.ceil(prixUnitaire * 0.3);

    if (
      !Number.isFinite(montantDepotUnitaire) ||
      montantDepotUnitaire <= 0
    ) {
      return res.status(400).json({
        message: "Le montant du dépôt doit être supérieur à 0",
      });
    }

    const montantDepot = montantDepotUnitaire * quantiteFinale;

    if (montantDepot > montantTotal) {
      return res.status(400).json({
        message: "Le montant du dépôt ne peut pas dépasser le prix total",
      });
    }

    const montantSolde = montantTotal - montantDepot;

    /* =========================
       CRÉATION PRÉCOMMANDE
    ========================= */

    const precommande = await Precommande.create({
      clientId: req.auth.userId,

      /* =========================
         SNAPSHOT CLIENT
      ========================= */

      client: {
        nom,
        prenom,
        adresse,
        ville,
        codePostal,
        pays,
        numero,
      },

      /* =========================
         PRODUIT
      ========================= */

      produitId: produit._id,

      modele: {
        title: produit.title,
        image: imagePrincipale,
        prix: prixUnitaire,
        video: video?.url || "",
      },

      /* =========================
         VARIATION
      ========================= */

      taille: taille || "",
      couleur: couleur || "",
      quantite: quantiteFinale,

      /* =========================
         MONTANTS
      ========================= */

      montantTotal,
      montantDepot,
      montantSolde,

      /* =========================
         PAIEMENT DU DÉPÔT
      ========================= */

      paiements: [
        {
          type: "DEPOT",
          service,
          numeroClient: numeroDepot.trim(),
          reference: referenceDepot.trim(),
          montantEnvoye: montantDepot,
          montantAttendu: montantDepot,
          status: "PENDING",
          submittedAt: new Date(),
        },
      ],

      /* =========================
         STATUT
      ========================= */

      statut: "PENDING",

      disponiblePourFinalisation: false,

      commandeId: null,

      submittedAt: new Date(),
    });

    /* =========================
       RÉPONSE
    ========================= */

    return res.status(201).json({
      message:
        "Précommande envoyée. Elle est en attente de vérification du dépôt.",

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

    if (precommande.statut === "REJECTED") {
      return res.status(400).json({
        message: "Une précommande refusée ne peut pas être acceptée",
      });
    }

    if (precommande.statut === "FINALIZED") {
      return res.status(400).json({
        message: "Cette précommande est déjà finalisée",
      });
    }

    /* =========================
       RECHERCHE DU DÉPÔT
    ========================= */

    const paiementDepot = precommande.paiements.find(
      (paiement) => paiement.type === "DEPOT",
    );

    if (!paiementDepot) {
      return res.status(400).json({
        message: "Aucun paiement de dépôt trouvé",
      });
    }

    if (paiementDepot.status === "CONFIRMED") {
      return res.status(400).json({
        message: "Le dépôt est déjà confirmé",
      });
    }

    if (paiementDepot.status === "REJECTED") {
      return res.status(400).json({
        message: "Le paiement du dépôt a été rejeté",
      });
    }

    /* =========================
       VÉRIFICATION DU MONTANT
    ========================= */

    if (
      Number(paiementDepot.montantEnvoye) !==
      Number(paiementDepot.montantAttendu)
    ) {
      return res.status(400).json({
        message: "Le montant du dépôt ne correspond pas au montant attendu",
      });
    }

    /* =========================
       VÉRIFICATION DU PRODUIT
    ========================= */

    const produit = await Produits.findById(precommande.produitId);

    if (!produit) {
      return res.status(404).json({
        message: "Produit introuvable.",
      });
    }

    /* =========================
       CONFIRMATION DU DÉPÔT
    ========================= */

    paiementDepot.status = "CONFIRMED";
    paiementDepot.confirmedAt = new Date();
    paiementDepot.adminComment = adminComment || "";

    /* =========================
       STATUT DE LA PRÉCOMMANDE
    ========================= */

    if (produit.disponible) {
      // Le produit est déjà disponible.
      // Le client peut donc passer directement au paiement du solde.

      precommande.statut = "READY_TO_FINALIZE";
      precommande.disponiblePourFinalisation = true;
    } else {
      // Le produit n'est pas encore disponible.
      // On attend sa disponibilité.

      precommande.statut = "ACCEPTED";
      precommande.disponiblePourFinalisation = false;
    }

    precommande.adminComment = adminComment || "";
    precommande.verifieAt = new Date();

    if (req.admin?._id) {
      precommande.verifiePar = req.admin._id;
    }

    await precommande.save();

    return res.status(200).json({
      message: "Dépôt confirmé avec succès",
      precommande,
    });
  } catch (error) {
    console.error("ACCEPTER PRECOMMANDE ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de la confirmation du dépôt",
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

    if (precommande.statut === "FINALIZED") {
      return res.status(400).json({
        message: "Une précommande finalisée ne peut pas être refusée",
      });
    }

    if (precommande.statut === "REJECTED") {
      return res.status(400).json({
        message: "Précommande déjà refusée",
      });
    }

    /* =========================
       RECHERCHE DU DÉPÔT
    ========================= */

    const paiementDepot = precommande.paiements.find(
      (paiement) => paiement.type === "DEPOT",
    );

    if (paiementDepot) {
      paiementDepot.status = "REJECTED";
      paiementDepot.adminComment = adminComment || "";
      paiementDepot.confirmedAt = null;
    }

    /* =========================
       PRÉCOMMANDE REFUSÉE
    ========================= */

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
      message: "Erreur lors du refus de la précommande",
    });
  }
};

/* =====================================================
    ADMIN : PRODUIT DISPONIBLE
 ===================================================== */

exports.rendreProduitDisponible = async (req, res) => {
  try {
    const { id: produitId } = req.params;

    /* =========================
       VALIDATION ID
    ========================= */

    if (!mongoose.Types.ObjectId.isValid(produitId)) {
      return res.status(400).json({
        message: "Identifiant du produit invalide",
      });
    }

    /* =========================
       RÉCUPÉRATION PRODUIT
    ========================= */

    const produit = await Produits.findById(produitId);

    if (!produit) {
      return res.status(404).json({
        message: "Produit introuvable",
      });
    }

    /* =========================
       VÉRIFICATION
    ========================= */

    if (!produit.precommande) {
      return res.status(400).json({
        message: "Ce produit n'est pas configuré comme précommande",
      });
    }

    if (produit.disponible) {
      return res.status(400).json({
        message: "Ce produit est déjà marqué comme disponible",
      });
    }

    /* =========================
       PRODUIT DISPONIBLE
    ========================= */

    produit.disponible = true;

    // Il ne doit plus apparaître comme nouveau modèle
    // à précommander.
    produit.precommande = false;

    await produit.save();

    /* =========================
       PRÉCOMMANDES ACCEPTÉES
    ========================= */

    const resultat = await Precommande.updateMany(
      {
        produitId: produit._id,
        statut: "ACCEPTED",
      },
      {
        $set: {
          statut: "READY_TO_FINALIZE",
          disponiblePourFinalisation: true,
        },
      },
    );

    /* =========================
       RÉPONSE
    ========================= */

    return res.status(200).json({
      message:
        "Produit marqué comme disponible. Les clients peuvent maintenant payer le solde.",

      produit: {
        _id: produit._id,
        title: produit.title,
        disponible: produit.disponible,
        precommande: produit.precommande,
      },

      precommandesPreparees: resultat.modifiedCount,
    });
  } catch (error) {
    console.error("RENDRE PRODUIT DISPONIBLE ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de la mise à disposition du produit",
    });
  }
};

/* =====================================================
   CLIENT : PAYER LE SOLDE
===================================================== */

exports.payerSoldePrecommande = async (req, res) => {
  try {
    const { id } = req.params;
    const { service, numeroClient, reference, montantEnvoye } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID de précommande invalide.",
      });
    }

    if (!["orange", "wave"].includes(service)) {
      return res.status(400).json({
        message: "Service de paiement invalide.",
      });
    }

    if (!numeroClient || !numeroClient.trim()) {
      return res.status(400).json({
        message: "Le numéro utilisé pour le paiement est requis.",
      });
    }

    if (!reference || !reference.trim()) {
      return res.status(400).json({
        message: "La référence du paiement est requise.",
      });
    }

    const precommande = await Precommande.findOne({
      _id: id,
      clientId: req.auth.userId,
    });

    if (!precommande) {
      return res.status(404).json({
        message: "Précommande introuvable.",
      });
    }

    if (
      precommande.statut !== "READY_TO_FINALIZE" ||
      !precommande.disponiblePourFinalisation
    ) {
      return res.status(400).json({
        message:
          "Cette précommande n'est pas encore disponible pour le paiement du solde.",
      });
    }

    // Empêche plusieurs paiements de solde simultanés.
    const paiementSoldeExistant = precommande.paiements.find(
      (paiement) =>
        paiement.type === "SOLDE" &&
        ["PENDING", "CONFIRMED"].includes(paiement.status),
    );

    if (paiementSoldeExistant) {
      return res.status(400).json({
        message:
          "Un paiement du solde est déjà en cours de vérification ou a déjà été confirmé.",
      });
    }

    const montantAttendu = Number(precommande.montantSolde);
    const montant = Number(montantEnvoye);

    if (!Number.isFinite(montantAttendu) || montantAttendu <= 0) {
      return res.status(400).json({
        message: "Le montant du solde est invalide.",
      });
    }

    if (!Number.isFinite(montant) || montant <= 0) {
      return res.status(400).json({
        message: "Le montant envoyé est invalide.",
      });
    }

    // Le client ne peut pas choisir le montant attendu.
    // Le serveur impose le montant du solde.
    if (montant !== montantAttendu) {
      return res.status(400).json({
        message: `Le montant attendu est de ${montantAttendu}.`,
        montantAttendu,
      });
    }

    precommande.paiements.push({
      type: "SOLDE",
      service,
      numeroClient: numeroClient.trim(),
      reference: reference.trim(),
      montantEnvoye: montant,
      montantAttendu,
      status: "PENDING",
      submittedAt: new Date(),
    });

    precommande.statut = "FINALIZATION_PENDING";

    await precommande.save();

    return res.status(200).json({
      message:
        "Paiement du solde enregistré. Il sera vérifié par l'administration.",
      precommande,
    });
  } catch (error) {
    console.error("Erreur payerSoldePrecommande:", error);

    return res.status(500).json({
      message: "Erreur serveur.",
      error: error.message,
    });
  }
};

exports.confirmerSoldePrecommande = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { id } = req.params;

    /* =========================
       VALIDATION ID
    ========================= */

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();

      return res.status(400).json({
        message: "Identifiant de précommande invalide.",
      });
    }

    /* =========================
       RÉCUPÉRATION PRÉCOMMANDE
    ========================= */

    const precommande = await Precommande.findById(id).session(session);

    if (!precommande) {
      await session.abortTransaction();

      return res.status(404).json({
        message: "Précommande introuvable.",
      });
    }

    /* =========================
       VÉRIFICATION STATUT
    ========================= */

    if (precommande.statut !== "FINALIZATION_PENDING") {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          "Cette précommande n'est pas prête à être finalisée.",
      });
    }

    /* =========================
       VÉRIFICATION COMMANDE
    ========================= */

    if (precommande.commandeId) {
      await session.abortTransaction();

      return res.status(400).json({
        message: "Cette précommande possède déjà une commande finale.",
      });
    }

    /* =========================
       VÉRIFICATION CLIENT
    ========================= */

    if (!precommande.client) {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          "Les informations du client sont absentes de cette précommande.",
      });
    }

    const {
      nom,
      prenom,
      adresse,
      ville,
      codePostal,
      pays,
      numero,
    } = precommande.client;

    if (
      !nom?.trim() ||
      !prenom?.trim() ||
      !adresse?.trim() ||
      !ville?.trim() ||
      !codePostal?.trim() ||
      !pays?.trim() ||
      !numero?.trim()
    ) {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          "Les informations de livraison de cette précommande sont incomplètes.",
      });
    }

    /* =========================
       RECHERCHE PAIEMENT SOLDE
    ========================= */

    const paiementSolde = precommande.paiements.find(
      (paiement) =>
        paiement.type === "SOLDE" &&
        paiement.status === "PENDING",
    );

    if (!paiementSolde) {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          "Aucun paiement de solde en attente n'a été trouvé.",
      });
    }

    /* =========================
       VÉRIFICATION MONTANT SOLDE
    ========================= */

    const montantSoldeAttendu = Number(precommande.montantSolde);
    const montantSoldeEnvoye = Number(
      paiementSolde.montantEnvoye,
    );

    if (
      !Number.isFinite(montantSoldeAttendu) ||
      !Number.isFinite(montantSoldeEnvoye)
    ) {
      await session.abortTransaction();

      return res.status(400).json({
        message: "Montant du solde invalide.",
      });
    }

    if (montantSoldeEnvoye < montantSoldeAttendu) {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          "Le montant du solde reçu est insuffisant.",
      });
    }

    /* =========================
       RÉCUPÉRATION PRODUIT
    ========================= */

    const produit = await Produits.findById(
      precommande.produitId,
    ).session(session);

    if (!produit) {
      await session.abortTransaction();

      return res.status(404).json({
        message: "Produit introuvable.",
      });
    }

    /* =========================
       VÉRIFICATION STOCK
    ========================= */

    const quantite = Number(precommande.quantite);

    if (!Number.isInteger(quantite) || quantite < 1) {
      await session.abortTransaction();

      return res.status(400).json({
        message: "La quantité de la précommande est invalide.",
      });
    }

    /*
      Le stock est organisé :
      couleur -> taille -> quantité
    */

    let stockDisponible = Number(produit.stock || 0);

    if (
      precommande.couleur &&
      precommande.taille &&
      produit.stockParVariation
    ) {
      const couleurKey = Object.keys(
        produit.stockParVariation,
      ).find(
        (key) =>
          String(key).trim().toLowerCase() ===
          String(precommande.couleur).trim().toLowerCase(),
      );

      if (couleurKey) {
        const variationsCouleur =
          produit.stockParVariation[couleurKey];

        if (
          variationsCouleur &&
          typeof variationsCouleur === "object"
        ) {
          const tailleKey = Object.keys(
            variationsCouleur,
          ).find(
            (key) =>
              String(key).trim().toLowerCase() ===
              String(precommande.taille)
                .trim()
                .toLowerCase(),
          );

          if (tailleKey) {
            stockDisponible = Number(
              variationsCouleur[tailleKey],
            );
          }
        }
      }
    }

    if (
      !Number.isFinite(stockDisponible) ||
      stockDisponible < quantite
    ) {
      await session.abortTransaction();

      return res.status(400).json({
        message:
          "Le stock disponible est insuffisant pour cette précommande.",
      });
    }

    /* =========================
       PAIEMENT DÉPÔT
    ========================= */

    const paiementDepot = precommande.paiements.find(
      (paiement) => paiement.type === "DEPOT",
    );

    /* =========================
       CRÉATION COMMANDE
    ========================= */

    const commande = new Commandeapi({
      /* =========================
         CLIENT
      ========================= */

      client: {
        userId: precommande.clientId,

        nom: nom.trim(),
        prenom: prenom.trim(),
        adresse: adresse.trim(),
        ville: ville.trim(),
        codePostal: codePostal.trim(),
        pays: pays.trim(),
        numero: numero.trim(),

        /*
          Aucune position GPS n'est inventée ici.
          Elle pourra être ajoutée plus tard si nécessaire.
        */
      },

      /* =========================
         PANIER
      ========================= */

      panier: [
        {
          produitId: produit._id,
          nom: precommande.modele.title,
          prix: precommande.modele.prix,
          image: precommande.modele.image || "",
          quantite: precommande.quantite,
          couleur: precommande.couleur || "",
          taille: precommande.taille || "",
        },
      ],

      /* =========================
         MONTANTS
      ========================= */

      totalProduits: precommande.montantTotal,

      fraisLivraison: 0,

      total: precommande.montantTotal,

      /* =========================
         PAIEMENT
      ========================= */

      modePaiement: "full",

      servicePaiement:
        paiementSolde.service,

      isPaid: true,

      paidAt: new Date(),

      statusCommande: "PAID",

      /* =========================
         ÉTAPES PAIEMENT
      ========================= */

      paiements: [
        {
          step: 1,
          amountExpected: precommande.montantTotal,
          status: "PAID",
          validatedAt: new Date(),
        },
      ],

      /* =========================
         PAIEMENTS REÇUS
      ========================= */

      paiementsRecus: [
        {
          step: 1,
          service:
            paiementDepot?.service ||
            paiementSolde.service,

          numeroClient:
            paiementDepot?.numeroClient || "",

          reference:
            paiementDepot?.reference || "",

          montantEnvoye:
            paiementDepot?.montantEnvoye ||
            precommande.montantDepot,

          status: "CONFIRMED",

          submittedAt:
            paiementDepot?.submittedAt ||
            new Date(),

          confirmedAt:
            paiementDepot?.confirmedAt ||
            new Date(),
        },

        {
          step: 2,
          service: paiementSolde.service,

          numeroClient:
            paiementSolde.numeroClient,

          reference:
            paiementSolde.reference,

          montantEnvoye:
            paiementSolde.montantEnvoye,

          status: "CONFIRMED",

          submittedAt:
            paiementSolde.submittedAt,

          confirmedAt: new Date(),
        },
      ],
    });

    /* =========================
       SAUVEGARDE COMMANDE
    ========================= */

    await commande.save({ session });

    /* =========================
       MISE À JOUR STOCK
    ========================= */

    if (
      precommande.couleur &&
      precommande.taille &&
      produit.stockParVariation
    ) {
      const couleurKey = Object.keys(
        produit.stockParVariation,
      ).find(
        (key) =>
          String(key).trim().toLowerCase() ===
          String(precommande.couleur)
            .trim()
            .toLowerCase(),
      );

      if (couleurKey) {
        const variationsCouleur =
          produit.stockParVariation[couleurKey];

        if (
          variationsCouleur &&
          typeof variationsCouleur === "object"
        ) {
          const tailleKey = Object.keys(
            variationsCouleur,
          ).find(
            (key) =>
              String(key).trim().toLowerCase() ===
              String(precommande.taille)
                .trim()
                .toLowerCase(),
          );

          if (tailleKey) {
            produit.stockParVariation[couleurKey][
              tailleKey
            ] =
              Number(
                produit.stockParVariation[couleurKey][
                  tailleKey
                ],
              ) - quantite;
          }
        }
      }
    } else {
      produit.stock =
        Number(produit.stock || 0) - quantite;
    }

    await produit.save({ session });

    /* =========================
       CONFIRMATION DU SOLDE
    ========================= */

    paiementSolde.status = "CONFIRMED";
    paiementSolde.confirmedAt = new Date();

    /* =========================
       FINALISATION PRÉCOMMANDE
    ========================= */

    precommande.statut = "FINALIZED";
    precommande.disponiblePourFinalisation = false;
    precommande.commandeId = commande._id;
    precommande.verifieAt = new Date();

    await precommande.save({ session });

    /* =========================
       VALIDATION TRANSACTION
    ========================= */

    await session.commitTransaction();

    return res.status(200).json({
      message:
        "Le solde a été confirmé et la commande finale a été créée.",

      commande,
      precommande,
    });
  } catch (error) {
    await session.abortTransaction();

    console.error(
      "Erreur confirmerSoldePrecommande:",
      error,
    );

    return res.status(500).json({
      message:
        "Erreur lors de la confirmation du solde.",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};



exports.rejeterSoldePrecommande = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminComment = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID de précommande invalide.",
      });
    }

    const precommande = await Precommande.findById(id);

    if (!precommande) {
      return res.status(404).json({
        message: "Précommande introuvable.",
      });
    }

    if (precommande.statut !== "FINALIZATION_PENDING") {
      return res.status(400).json({
        message:
          "Cette précommande n'est pas en attente de validation du solde.",
      });
    }

    const paiementSolde = [...precommande.paiements]
      .reverse()
      .find(
        (paiement) =>
          paiement.type === "SOLDE" && paiement.status === "PENDING",
      );

    if (!paiementSolde) {
      return res.status(400).json({
        message: "Aucun paiement du solde en attente.",
      });
    }

    paiementSolde.status = "REJECTED";
    paiementSolde.adminComment = String(adminComment).trim();

    precommande.statut = "READY_TO_FINALIZE";
    precommande.disponiblePourFinalisation = true;

    precommande.adminComment = String(adminComment).trim();

    precommande.verifieAt = new Date();

    if (req.auth?.userId) {
      precommande.verifiePar = req.auth.userId;
    }

    await precommande.save();

    return res.status(200).json({
      message:
        "Paiement du solde rejeté. Le client peut soumettre un nouveau paiement.",
      precommande,
    });
  } catch (error) {
    console.error("Erreur rejeterSoldePrecommande:", error);

    return res.status(500).json({
      message: "Erreur serveur.",
      error: error.message,
    });
  }
};
