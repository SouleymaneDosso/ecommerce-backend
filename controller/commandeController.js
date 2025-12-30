const Commandeapi = require("../models/paiementmodel");

// Générer une référence unique pour chaque étape de paiement
const generateReference = (commandeId, step) => {
  return `${commandeId}-STEP${step}-${Date.now()}`;
};

// POST /api/commandes
const creerCommande = async (req, res) => {
  try {
    const { client, panier, total, modePaiement, servicePaiement } = req.body;

    const nouvelleCommande = new Commandeapi({
      client,
      panier,
      total,
      modePaiement,
      servicePaiement,
      paiements: [], // sera créé après si installments
      status: "PENDING",
    });

    // Création automatique des étapes si paiement en plusieurs fois
    if (modePaiement === "installments") {
      const montantParEtape = total / 3;
      for (let i = 1; i <= 3; i++) {
        nouvelleCommande.paiements.push({
          step: i,
          amount: montantParEtape,
          status: "UNPAID",
          reference: `${nouvelleCommande._id}-STEP${i}-${Date.now()}`,
        });
      }
    } else {
      nouvelleCommande.paiements.push({
        step: 1,
        amount: total,
        status: "UNPAID",
        reference: `${nouvelleCommande._id}-STEP1-${Date.now()}`,
      });
    }

    await nouvelleCommande.save();
    res.status(201).json({ message: "Commande créée avec succès", commande: nouvelleCommande });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la création de la commande", error: error.message });
  }
};


// GET /api/commandes/:id
const getCommandeById = async (req, res) => {
  try {
    const { id } = req.params;

    const commande = await Commandeapi.findById(id);

    if (!commande) {
      return res.status(404).json({ message: "Commande introuvable" });
    }

    res.status(200).json(commande);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/////ADMIN///////

// GET /api/admin/commandes?page=1&limit=10
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

// PUT /api/commandes/:id/paiement
const validerPaiement = async (req, res) => {
  try {
    const { id } = req.params;
    const { step } = req.body;

    if (!step) return res.status(400).json({ message: "Step requis" });

    const stepNumber = Number(step);

    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande non trouvée" });

    const paiementStep = commande.paiements.find((p) => p.step === stepNumber);

    if (!paiementStep)
      return res.status(404).json({ message: "Étape de paiement non trouvée" });

    if (paiementStep.status === "PAID")
      return res.status(400).json({ message: "Cette étape a déjà été payée" });

    paiementStep.status = "PAID";

    // Mettre à jour le statut global
    const toutesPayees = commande.paiements.every((p) => p.status === "PAID");
    if (toutesPayees) commande.status = "PAID";
    else commande.status = "PARTIALLY_PAID";

    await commande.save();

    res.status(200).json({ message: `Étape ${stepNumber} validée`, commande });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la validation du paiement" });
  }
};

// PUT /api/admin/commandes/:id/valider-etape
const validerEtapeAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { step, montantRecu, referenceClient } = req.body;

    if (!step || !montantRecu || !referenceClient)
      return res.status(400).json({ message: "Tous les champs sont requis" });

    const stepNumber = Number(step);

    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande non trouvée" });

    const paiementStep = commande.paiements.find((p) => p.step === stepNumber);
    if (!paiementStep)
      return res.status(404).json({ message: "Étape de paiement non trouvée" });

    if (montantRecu < paiementStep.amount)
      return res.status(400).json({ message: "Montant reçu insuffisant" });

    paiementStep.status = "PAID";
    paiementStep.reference = referenceClient;

    // Mise à jour du statut global
    const toutesPayees = commande.paiements.every((p) => p.status === "PAID");
    if (toutesPayees) commande.status = "PAID";
    else commande.status = "PARTIALLY_PAID";

    await commande.save();

    res
      .status(200)
      .json({ message: `Étape ${stepNumber} validée par admin`, commande });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de la validation" });
  }
};

// POST /api/commandes/:id/paiement-semi
const paiementSemi = async (req, res) => {
  try {
    const { id } = req.params;
    const { numeroPaiement, montant, reference } = req.body;

    if (!numeroPaiement || !montant || !reference)
      return res.status(400).json({ message: "Tous les champs sont requis" });

    const commande = await Commandeapi.findById(id);
    if (!commande) return res.status(404).json({ message: "Commande non trouvée" });

    if (!commande.paiementsRecus) commande.paiementsRecus = [];

    // Ajouter le paiement reçu
    commande.paiementsRecus.push({
      numeroPaiement,
      montant,
      reference,
      date: new Date(),
    });

    // Trouver la première étape UNPAID
    const paiementStep = commande.paiements.find((p) => p.status === "UNPAID");
    if (paiementStep) {
      paiementStep.status = "PAID";
      paiementStep.reference = reference;
    }

    // Mettre à jour le statut global
    const toutesPayees = commande.paiements.every((p) => p.status === "PAID");
    if (toutesPayees) commande.status = "PAID";
    else if (commande.paiements.some((p) => p.status === "PAID"))
      commande.status = "PARTIALLY_PAID";

    await commande.save();

    res.status(200).json({ message: "Paiement enregistré avec succès", commande });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur lors de l'enregistrement du paiement" });
  }
};


module.exports = {
  creerCommande,
  getCommandeById,
  getCommandesAdmin,
  validerPaiement,
  validerEtapeAdmin,
  paiementSemi,
};
