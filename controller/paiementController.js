const Commandeapi = require("../models/paiementmodel");

// PUT /api/commandes/:id/paiement
const validerPaiement = async (req, res) => {
  try {
    const { id } = req.params; // ID de la commande
    const { step } = req.body; // Numéro de l'étape à valider

    // Récupérer la commande
    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande non trouvée" });

    // Trouver l'étape
    const paiementStep = commande.paiements.find((p) => p.step === step);
    if (!paiementStep)
      return res.status(404).json({ message: "Étape de paiement non trouvée" });

    // Vérifier si déjà payé
    if (paiementStep.status === "PAID")
      return res.status(400).json({ message: "Cette étape a déjà été payée" });

    // Valider l'étape
    paiementStep.status = "PAID";

    // Mettre à jour le statut global de la commande
    const toutesPayees = commande.paiements.every((p) => p.status === "PAID");
    if (toutesPayees) {
      commande.status = "PAID";
    } else if (commande.paiements.some((p) => p.status === "PAID")) {
      commande.status = "PARTIALLY_PAID";
    }

    await commande.save();

    res.status(200).json({
      message: `Étape ${step} validée`,
      commande,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors de la validation du paiement" });
  }
};

module.exports = {
  validerPaiement,
};

// PUT /api/admin/commandes/:id/valider-etape
const validerEtapeAdmin = async (req, res) => {
  try {
    const { id } = req.params; // ID commande
    const { step, montantRecu, referenceClient } = req.body; // infos admin

    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande non trouvée" });

    const paiementStep = commande.paiements.find((p) => p.step === step);
    if (!paiementStep)
      return res.status(404).json({ message: "Étape de paiement non trouvée" });

    // Vérification : montant reçu >= montant attendu
    if (montantRecu < paiementStep.amount)
      return res.status(400).json({ message: "Montant reçu insuffisant" });

    paiementStep.status = "PAID";
    paiementStep.reference = referenceClient; // sauvegarde référence client

    // Mise à jour statut global
    const toutesPayees = commande.paiements.every((p) => p.status === "PAID");
    if (toutesPayees) commande.status = "PAID";
    else commande.status = "PARTIALLY_PAID";

    await commande.save();

    res.status(200).json({
      message: `Étape ${step} validée par admin`,
      commande,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur lors de la validation" });
  }
};

const paiementSemi = async (req, res) => {
  try {
    const { id } = req.params;
    const { numeroPaiement, montant, reference } = req.body;

    const commande = await Commandeapi.findById(id);
    if (!commande)
      return res.status(404).json({ message: "Commande non trouvée" });

    // Ajouter le paiement semi-manuel à un tableau de vérification
    if (!commande.paiementsReçus) commande.paiementsReçus = [];
    commande.paiementsReçus.push({
      numeroPaiement,
      montant,
      reference,
      date: new Date(),
    });

    await commande.save();

    res.status(200).json({ message: "Paiement enregistré", commande });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  validerPaiement,
  validerEtapeAdmin,
  paiementSemi,
};
