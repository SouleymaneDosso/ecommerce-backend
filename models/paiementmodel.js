const mongoose = require("mongoose");

/* =========================
   ÉTAPES DE PAIEMENT (THÉORIE)
   ========================= */
const PaiementStepSchema = new mongoose.Schema({
  step: {
    type: Number,
    required: true,
  },

  amountExpected: {
    type: Number,
    required: true,
    min: 0,
  },

  status: {
    type: String,
    enum: ["UNPAID", "PENDING", "PAID"],
    default: "UNPAID",
  },

  validatedAt: {
    type: Date,
  },
});

/* =========================
   PAIEMENT ENVOYÉ PAR LE CLIENT (RÉALITÉ)
   ========================= */
const PaiementRecuSchema = new mongoose.Schema({
  step: {
    type: Number,
    required: true, // 🔑 étape concernée
  },

  service: {
    type: String,
    enum: ["orange", "wave"],
    required: true,
  },

  numeroClient: {
    type: String,
    required: true, // 📱 numéro utilisé pour payer
  },

  reference: {
    type: String,
    required: true, // 🧾 ID de transaction
  },

  montantEnvoye: {
    type: Number,
    required: true,
    min: 0,
  },

  status: {
    type: String,
    enum: ["PENDING", "CONFIRMED", "REJECTED"],
    default: "PENDING",
  },

  adminComment: {
    type: String,
  },

  submittedAt: {
    type: Date,
    default: Date.now,
  },

  confirmedAt: {
    type: Date,
  },
});

/* =========================
   COMMANDE
   ========================= */
const CommandeSchema = new mongoose.Schema(
  {
    /* ----- CLIENT ----- */
    client: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      nom: { type: String, required: true },
      prenom: { type: String, required: true },
      adresse: { type: String, required: true },
      ville: { type: String, required: true },
      codePostal: { type: String, required: true },
      pays: { type: String, required: true },
    },

    /* ----- PANIER ----- */
    panier: [
      {
        produitId: { type: String, required: true },
        nom: { type: String, required: true },
        prix: { type: Number, required: true },
        quantite: { type: Number, required: true },
        couleur: { type: String },
        taille: { type: String },
      },
    ],

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    /* ----- CONFIG PAIEMENT ----- */
    modePaiement: {
      type: String,
      enum: ["full", "installments"],
      default: "full",
    },

    servicePaiement: {
      type: String,
      enum: ["orange", "wave"],
      required: true,
    },

    /* ----- PAIEMENTS ----- */
    paiements: [PaiementStepSchema], // ce qui est attendu
    paiementsRecus: [PaiementRecuSchema], // ce que le client envoie

    /* ----- STATUT COMMANDE ----- */
    statusCommande: {
      type: String,
      enum: ["PENDING", "PARTIALLY_PAID", "PAID"],
      default: "PENDING",
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

module.exports = mongoose.model("Commandeapi", CommandeSchema);
