const Commandeapi = require("../models/paiementmodel");

// Générer une référence unique pour chaque étape de paiement
const generateReference = (commandeId, step) => {
  return `${commandeId}-${step}-${Date.now()}`;
};

// POST /api/commandes
const creerCommande = async (req, res) => {
  try {
    const { client, panier, total, modePaiement } = req.body;

    // Créer les étapes de paiement
    let paiements = [];
    if (modePaiement === "installments") {
      const montantParEtape = total / 3;
      for (let i = 1; i <= 3; i++) {
        paiements.push({
          step: i,
          amount: montantParEtape,
          status: "UNPAID",
          reference: generateReference("CMD", i),
        });
      }
    } else {
      paiements.push({
        step: 1,
        amount: total,
        status: "UNPAID",
        reference: generateReference("CMD", 1),
      });
    }

    // Créer la commande
    const nouvelleCommande = new Commandeapi({
      client,
      panier,
      total,
      modePaiement,
      paiements,
      status: "PENDING",
    });

    await nouvelleCommande.save();

    res.status(201).json({
      message: "Commande créée avec succès",
      commande: nouvelleCommande,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors de la création de la commande" });
  }
};

module.exports = {
  creerCommande,
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

module.exports = {
  creerCommande,
  getCommandeById,
};
