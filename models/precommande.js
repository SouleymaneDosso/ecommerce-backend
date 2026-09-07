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

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
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

module.exports = mongoose.model(
  "Precommande",
  precommandeSchema,
);