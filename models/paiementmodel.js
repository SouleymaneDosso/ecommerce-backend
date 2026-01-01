const mongoose = require("mongoose");

/* =========================
   ÉTAPES DE PAIEMENT (THÉORIQUE)
   ========================= */
const PaiementStepSchema = new mongoose.Schema(
  {
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
  },
  { _id: false }
);

/* =========================
   PAIEMENT ENVOYÉ PAR LE CLIENT
   ========================= */
const PaiementRecuSchema = new mongoose.Schema(
  {
    step: {
      type: Number,
      required: true,
    },

    service: {
      type: String,
      enum: ["orange", "wave"],
      required: true,
    },

    numeroClient: {
      type: String,
      required: true,
    },

    reference: {
      type: String,
      required: true,
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
  },
  { timestamps: false }
);

/* =========================
   PRODUITS COMMANDÉS
   ========================= */
/* =========================
   PRODUITS COMMANDÉS
   ========================= */
const PanierItemSchema = new mongoose.Schema(
  {
    produitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    nom: { type: String, required: true }, // snapshot du nom
    prix: { type: Number, required: true }, // snapshot du prix
    image: { type: String }, // snapshot image
    quantite: { type: Number, required: true, min: 1 },
    couleur: String,
    taille: String,
  },
  { _id: false }
);

/* =========================
   COMMANDE
   ========================= */
const CommandeSchema = new mongoose.Schema(
  {
    /* ---------- CLIENT ---------- */
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

    /* ---------- PANIER ---------- */
    panier: {
      type: [PanierItemSchema],
      required: true,
      validate: (v) => v.length > 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    /* ---------- CONFIG PAIEMENT ---------- */
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

    /* ---------- PAIEMENTS ---------- */
    paiements: {
      type: [PaiementStepSchema],
      required: true,
    },

    paiementsRecus: {
      type: [PaiementRecuSchema],
      default: [],
    },

    /* ---------- STATUT ---------- */
    statusCommande: {
      type: String,
      enum: ["PENDING", "PARTIALLY_PAID", "PAID"],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
  }
);

/* =========================
   INDEXES PERFORMANCE
   ========================= */
CommandeSchema.index({ "client.userId": 1 });
CommandeSchema.index({ statusCommande: 1 });

module.exports = mongoose.model("Commandeapi", CommandeSchema);
