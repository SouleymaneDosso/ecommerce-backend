const mongoose = require("mongoose");

const precommandeSchema = new mongoose.Schema(
  {
    /* =========================
       CLIENT
    ========================= */
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* =========================
       MODÈLE PRÉCOMMANDÉ
    ========================= */
    produitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produits",
      required: true,
      index: true,
    },

    modele: {
      title: {
        type: String,
        required: true,
      },

      image: {
        type: String,
        default: "",
      },

      video: {
        type: String,
        default: "",
      },

      prix: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    /* =========================
       VARIATION COMMANDÉE
    ========================= */

    taille: {
      type: String,
      default: "",
      trim: true,
    },

    couleur: {
      type: String,
      default: "",
      trim: true,
    },

    quantite: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    /* =========================
       DÉPÔT
    ========================= */

    montantDepot: {
      type: Number,
      required: true,
      min: 0,
    },

    service: {
      type: String,
      enum: ["orange", "wave"],
      required: true,
    },

    numeroDepot: {
      type: String,
      required: true,
      trim: true,
    },

    referenceDepot: {
      type: String,
      required: true,
      trim: true,
    },

    /* =========================
       STATUT
    ========================= */

    statut: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    /* =========================
       ADMIN
    ========================= */

    adminComment: {
      type: String,
      default: "",
      trim: true,
    },

    verifiePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    verifieAt: {
      type: Date,
      default: null,
    },

    /* =========================
       DATE DE SOUMISSION
    ========================= */

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================
   INDEX
========================= */

precommandeSchema.index({
  clientId: 1,
  createdAt: -1,
});

precommandeSchema.index({
  statut: 1,
  createdAt: -1,
});

precommandeSchema.index({
  produitId: 1,
  statut: 1,
});

module.exports = mongoose.model(
  "Precommande",
  precommandeSchema
);