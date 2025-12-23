const mongoose = require("mongoose");

const commandeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  produits: [
    {
      produitId: { type: mongoose.Schema.Types.ObjectId, ref: "Produits", required: true },
      quantite: { type: Number, required: true },
      prix: { type: Number, required: true },
    }
  ],
  total: { type: Number, required: true },
  statut: { type: String, enum: ["en cours", "envoyé", "livré", "annulé"], default: "en cours" },
  adresseLivraison: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Commande", commandeSchema);
