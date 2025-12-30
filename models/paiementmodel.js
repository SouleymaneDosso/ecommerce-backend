const mongoose = require("mongoose");

const PaiementStepSchema = new mongoose.Schema({
  step: Number,
  amount: Number,
  status: { type: String, enum: ["UNPAID", "PAID"], default: "UNPAID" },
  reference: String
});

const CommandeSchema = new mongoose.Schema({
  client: {
    nom: String,
    prenom: String,
    adresse: String,
    ville: String,
    codePostal: String,
    pays: String
  },
  panier: [
    {
      produitId: String,
      nom: String,
      prix: Number,
      quantite: Number,
      couleur: String,
      taille: String
    }
  ],
  total: Number,
  modePaiement: { type: String, enum: ["full", "installments"], default: "full" },
  paiements: [PaiementStepSchema],
  status: { type: String, enum: ["PENDING", "PARTIALLY_PAID", "PAID"], default: "PENDING" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Commandeapi", CommandeSchema);
