const Commandeapi = require("../models/paiementmodel");

// Générer une référence unique pour chaque étape de paiement
const generateReference = (commandeId, step) => {
  return `${commandeId}-STEP${step}-${Date.now()}`;
};

/* =========================
   CREATION COMMANDE
   ========================= */
const creerCommande = async (req, res) => {
  try {
    const { client, panier, total, modePaiement, servicePaiement } = req.body;

    if (!client || !panier || !total || !servicePaiement) {
      return res.status(400).json({ message: "Champs requis manquants" });
    }

    const nouvelleCommande = new Commandeapi({
      client: {
        userId: req.auth.userId,
        ...client,
      },
      panier,
      total,
      modePaiement,
      servicePaiement,
      paiements: [],
      paiementsRecus: [],
      statusCommande: "PENDING",
    });

    // Créer les étapes de paiement
    if (modePaiement === "installments") {
      const montantParEtape = total / 3;
      for (let i = 1; i <= 3; i++) {
        nouvelleCommande.paiements.push({
          step: i,
          amountExpected: montantParEtape,
          status: "UNPAID",
          reference: generateReference(nouvelleCommande._id, i),
          validatedAt: null,
        });
      }
    } else {
      nouvelleCommande.paiements.push({
        step: 1,
        amountExpected: total,
        status: "UNPAID",
        reference: generateReference(nouvelleCommande._id, 1),
        validatedAt: null,
      });
    }

    await nouvelleCommande.save();
    res.status(201).json({
      message: "Commande créée avec succès",
      commande: nouvelleCommande,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Erreur lors de la création de la commande",
      error: err.message,
    });
  }
};

/* =========================
   GET COMMANDE PAR ID
   ========================= */
const getCommandeById = async (req, res) => {
  try {
    const { id } = req.params;
    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });
    res.status(200).json(commande);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =========================
   GET COMMANDES ADMIN
   ========================= */
const getCommandesAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Commandeapi.countDocuments();
    const commandes = await Commandeapi.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      commandes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =========================
   PAIEMENT SEMI-MANUEL (CLIENT)
   ========================= */
const paiementSemi = async (req, res) => {
  try {
    const { id } = req.params;
    const { step, numeroClient, montantEnvoye, reference, service } = req.body;

    if (!step || !numeroClient || !montantEnvoye || !reference || !service) {
      return res.status(400).json({ message: "Champs manquants" });
    }

    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });

    const paiementStep = commande.paiements.find(
      (p) => p.step === Number(step)
    );
    if (!paiementStep)
      return res.status(404).json({ message: "Étape invalide" });

    // Ajouter paiement reçu en PENDING
    commande.paiementsRecus.push({
      step: Number(step),
      service,
      numeroClient,
      reference,
      montantEnvoye,
      status: "PENDING",
      submittedAt: new Date(),
    });

    // Marquer l'étape comme PENDING si elle était UNPAID
    if (paiementStep.status === "UNPAID") paiementStep.status = "PENDING";

    await commande.save();

    res.status(200).json({
      message: "Paiement soumis, en attente de validation admin",
      commande,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur paiement semi-manuel" });
  }
};

/* =========================
   CONFIRMER PAIEMENT (ADMIN)
   ========================= */
const confirmerPaiementAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { paiementRecuId, adminComment } = req.body;

    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande introuvable" });

    const paiementRecu = commande.paiementsRecus.id(paiementRecuId);
    if (!paiementRecu)
      return res.status(404).json({ message: "Paiement non trouvé" });

    if (paiementRecu.status === "CONFIRMED") {
      return res.status(400).json({ message: "Paiement déjà confirmé" });
    }

    // Confirmer le paiement
    paiementRecu.status = "CONFIRMED";
    paiementRecu.confirmedAt = new Date();
    paiementRecu.adminComment = adminComment || "";

    // Mettre à jour l'étape correspondante
    const paiementStep = commande.paiements.find(
      (p) => p.step === paiementRecu.step
    );
    if (paiementStep) {
      paiementStep.status = "PAID";
      paiementStep.validatedAt = new Date();
    }

    // Mettre à jour le statut global
    if (commande.paiements.every((p) => p.status === "PAID")) {
      commande.statusCommande = "PAID";
    } else {
      commande.statusCommande = "PARTIALLY_PAID";
    }

    await commande.save();
    res.status(200).json({ message: "Paiement confirmé", commande });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur validation admin" });
  }
};

module.exports = {
  creerCommande,
  getCommandeById,
  getCommandesAdmin,
  paiementSemi,
  confirmerPaiementAdmin,
};
