const mongoose = require("mongoose");
const { Readable } = require("stream");

const Commandeapi = require("../models/paiementmodel");
const ReturnRequest = require("../models/ReturnRequest");
const cloudinary = require("../config/cloudinary");

const STATUTS_BLOQUANTS = ["PENDING", "APPROVED"];

const uploadToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "numa/returns",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    Readable.from(file.buffer).pipe(stream);
  });

const deleteCloudinaryPhotos = async (photos = []) => {
  await Promise.all(
    photos.map((photo) =>
      cloudinary.uploader
        .destroy(photo.publicId)
        .catch((error) => console.error("Cloudinary delete:", error.message)),
    ),
  );
};

const parseItems = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return JSON.parse(value);
  return [];
};

/* =====================================
   CLIENT : CRÉER UNE DEMANDE
===================================== */
exports.createReturnRequest = async (req, res) => {
  let uploadedPhotos = [];

  try {
    const { commandeId, solutionSouhaitee, description, numeroWhatsApp } =
      req.body;
    const items = parseItems(req.body.items);

    if (!mongoose.isValidObjectId(commandeId)) {
      return res
        .status(400)
        .json({ message: "Identifiant de commande invalide" });
    }

    if (!["REMBOURSEMENT", "ECHANGE"].includes(solutionSouhaitee)) {
      return res.status(400).json({ message: "Solution souhaitée invalide" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Sélectionne au moins un article" });
    }

    if (items.length > 20) {
      return res.status(400).json({ message: "Trop d'articles sélectionnés" });
    }

    const commande = await Commandeapi.findOne({
      _id: commandeId,
      "client.userId": req.auth.userId,
    });

    if (!commande) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    if (commande.statusCommande !== "DELIVERED") {
      return res.status(400).json({
        message: "Les retours sont possibles uniquement après livraison",
      });
    }

    const indexes = items.map((item) => Number(item.panierIndex));

    if (
      indexes.some(
        (index) =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= commande.panier.length,
      ) ||
      new Set(indexes).size !== indexes.length
    ) {
      return res.status(400).json({ message: "Sélection d'articles invalide" });
    }

    const existingRequests = await ReturnRequest.find({
      commandeId: commande._id,
      statut: { $in: STATUTS_BLOQUANTS },
    }).lean();

    const alreadyRequested = new Set(
      existingRequests.flatMap((request) =>
        request.items.map((item) => item.panierIndex),
      ),
    );

    for (const item of items) {
      const index = Number(item.panierIndex);

      if (alreadyRequested.has(index)) {
        return res.status(409).json({
          message: `L'article "${commande.panier[index].nom}" fait déjà l'objet d'une demande de retour`,
        });
      }

      if (!item.motif || typeof item.motif !== "string" || !item.motif.trim()) {
        return res.status(400).json({
          message: "Un motif est obligatoire pour chaque article",
        });
      }
    }
    if (typeof numeroWhatsApp !== "string" || !numeroWhatsApp.trim()) {
      return res.status(400).json({
        message: "Veuillez renseigner votre numéro WhatsApp.",
      });
    }

    const whatsapp = numeroWhatsApp.trim();
    // Les informations de chaque article proviennent exclusivement de la commande.
    const returnItems = items.map((item) => {
      const index = Number(item.panierIndex);
      const ligne = commande.panier[index];

      return {
        panierIndex: index,
        produitId: ligne.produitId,
        nom: ligne.nom,
        prix: ligne.prix,
        image: ligne.image || "",
        quantite: ligne.quantite,
        couleur: ligne.couleur || "",
        taille: ligne.taille || "",
        motif: item.motif.trim(),
      };
    });

    const files = req.files || [];

    uploadedPhotos = await Promise.all(
      files.map((file) => uploadToCloudinary(file)),
    );

    const demande = await ReturnRequest.create({
      commandeId: commande._id,
      clientId: req.auth.userId,
      items: returnItems,
      description: typeof description === "string" ? description.trim() : "",
      solutionSouhaitee,
      numeroWhatsApp: whatsapp,
      photos: uploadedPhotos,
    });

    return res.status(201).json({
      message: "Demande de retour enregistrée",
      demande,
    });
  } catch (error) {
    await deleteCloudinaryPhotos(uploadedPhotos);

    console.error("CREATE RETURN ERROR:", error);

    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: "Format des articles invalide" });
    }

    return res
      .status(500)
      .json({ message: "Erreur lors de la création du retour" });
  }
};

/* =====================================
   CLIENT : MES DEMANDES
===================================== */
exports.getMyReturnRequests = async (req, res) => {
  try {
    const demandes = await ReturnRequest.find({
      clientId: req.auth.userId,
    })
      .populate("commandeId", "numeroCommande statusCommande total createdAt")
      .sort({ createdAt: -1 });

    return res.json(demandes);
  } catch (error) {
    console.error("GET MY RETURNS ERROR:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =====================================
   CLIENT : DÉTAIL D'UNE DEMANDE
===================================== */
exports.getMyReturnRequestById = async (req, res) => {
  try {
    const demande = await ReturnRequest.findOne({
      _id: req.params.id,
      clientId: req.auth.userId,
    }).populate("commandeId", "statusCommande numeroCommande total createdAt");

    if (!demande) {
      return res.status(404).json({ message: "Demande introuvable" });
    }

    return res.json(demande);
  } catch (error) {
    console.error("GET RETURN ERROR:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =====================================
   CLIENT : ANNULER UNE DEMANDE
===================================== */
exports.cancelReturnRequest = async (req, res) => {
  try {
    const demande = await ReturnRequest.findOne({
      _id: req.params.id,
      clientId: req.auth.userId,
    });

    if (!demande) {
      return res.status(404).json({ message: "Demande introuvable" });
    }

    if (demande.statut !== "PENDING") {
      return res.status(400).json({
        message: "Seules les demandes en attente peuvent être annulées",
      });
    }

    demande.statut = "CANCELLED";
    await demande.save();

    await deleteCloudinaryPhotos(demande.photos);

    return res.json({ message: "Demande annulée", demande });
  } catch (error) {
    console.error("CANCEL RETURN ERROR:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =====================================
   ADMIN : LISTE DES DEMANDES
===================================== */
exports.getAllReturnRequests = async (req, res) => {
  try {
    const filter = {};

    if (req.query.statut) {
      filter.statut = req.query.statut;
    }

    const demandes = await ReturnRequest.find(filter)
      .populate("clientId", "username email")
      .populate(
        "commandeId",
        "numeroCommande numeroCommande total statusCommande createdAt client",
      )
      .sort({ createdAt: -1 });

    return res.json(demandes);
  } catch (error) {
    console.error("ADMIN RETURNS ERROR:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =====================================
   ADMIN : DÉTAIL D'UNE DEMANDE
===================================== */
exports.getReturnRequestAdmin = async (req, res) => {
  try {
    const demande = await ReturnRequest.findById(req.params.id)
      .populate("clientId", "username email")
      .populate("commandeId");

    if (!demande) {
      return res.status(404).json({ message: "Demande introuvable" });
    }

    return res.json(demande);
  } catch (error) {
    console.error("ADMIN RETURN DETAIL ERROR:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =====================================
   ADMIN : TRAITER UNE DEMANDE
===================================== */
exports.updateReturnRequestStatus = async (req, res) => {
  try {
    const { statut, commentaireAdmin } = req.body;

    const transitions = {
      APPROVED: ["PENDING"],
      REJECTED: ["PENDING"],
      COMPLETED: ["APPROVED"],
    };

    if (!transitions[statut]) {
      return res.status(400).json({ message: "Statut demandé invalide" });
    }

    const demande = await ReturnRequest.findById(req.params.id);

    if (!demande) {
      return res.status(404).json({ message: "Demande introuvable" });
    }

    if (!transitions[statut].includes(demande.statut)) {
      return res.status(400).json({
        message: `Impossible de passer de ${demande.statut} à ${statut}`,
      });
    }

    demande.statut = statut;
    demande.commentaireAdmin =
      typeof commentaireAdmin === "string" ? commentaireAdmin.trim() : "";

    demande.traitePar = req.admin._id;
    demande.traiteLe = new Date();

    if (statut === "COMPLETED") {
      demande.completedAt = new Date();
    }

    await demande.save();

    return res.json({
      message: "Demande mise à jour",
      demande,
    });
  } catch (error) {
    console.error("UPDATE RETURN ERROR:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
