const Commandeapi = require("../models/paiementmodel");

// PUT /api/commandes/:id/paiement
const validerPaiement = async (req, res) => {
  try {
    const { id } = req.params;           // ID de la commande
    const { step } = req.body;           // Numéro de l'étape à valider

    // Récupérer la commande
    const commande = await Commandeapi.findById(id);
    if (!commande) return res.status(404).json({ message: "Commande non trouvée" });

    // Trouver l'étape
    const paiementStep = commande.paiements.find(p => p.step === step);
    if (!paiementStep) return res.status(404).json({ message: "Étape de paiement non trouvée" });

    // Vérifier si déjà payé
    if (paiementStep.status === "PAID")
      return res.status(400).json({ message: "Cette étape a déjà été payée" });

    // Valider l'étape
    paiementStep.status = "PAID";

    // Mettre à jour le statut global de la commande
    const toutesPayees = commande.paiements.every(p => p.status === "PAID");
    if (toutesPayees) {
      commande.status = "PAID";
    } else if (commande.paiements.some(p => p.status === "PAID")) {
      commande.status = "PARTIALLY_PAID";
    }

    await commande.save();

    res.status(200).json({
      message: `Étape ${step} validée`,
      commande
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la validation du paiement" });
  }
};

module.exports = {
  validerPaiement
};
