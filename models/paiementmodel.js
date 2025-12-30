const mongoose = require("mongoose");

const PaiementStepSchema = new mongoose.Schema({
  step: { type: Number, required: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["UNPAID", "PAID"], default: "UNPAID" },
  reference: { type: String }
});

const PaiementRecuSchema = new mongoose.Schema({
  numeroPaiement: { type: String, required: true },
  montant: { type: Number, required: true, min: 0 },
  reference: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const CommandeSchema = new mongoose.Schema({
  client: {
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
    adresse: { type: String, required: true },
    ville: { type: String, required: true },
    codePostal: { type: String, required: true },
    pays: { type: String, required: true }
  },
  panier: [
    {
      produitId: { type: String, required: true },
      nom: { type: String, required: true },
      prix: { type: Number, required: true, min: 0 },
      quantite: { type: Number, required: true, min: 1 },
      couleur: String,
      taille: String
    }
  ],
  total: { type: Number, required: true, min: 0 },
  modePaiement: { type: String, enum: ["full", "installments"], default: "full" },
  servicePaiement: { type: String, enum: ["orange", "wave"], default: "orange" },
  paiements: [PaiementStepSchema],
  paiementsReçus: [PaiementRecuSchema],
  status: { type: String, enum: ["PENDING", "PARTIALLY_PAID", "PAID"], default: "PENDING" },
}, { timestamps: true }); // createdAt & updatedAt

module.exports = mongoose.model("Commandeapi", CommandeSchema);

