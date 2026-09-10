const mongoose = require("mongoose");

/* =====================================================
   PAIEMENT DU DÉPÔT / SOLDE
===================================================== */

const PaiementPrecommandeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["DEPOT", "SOLDE"],
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
      trim: true,
    },

    reference: {
      type: String,
      required: true,
      trim: true,
    },

    montantEnvoye: {
      type: Number,
      required: true,
      min: 0,
    },

    montantAttendu: {
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
      default: "",
      trim: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
    timestamps: false,
  }
);


/* =====================================================
   PRÉCOMMANDE
===================================================== */

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
       PRODUIT
    ========================= */

    produitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produits",
      required: true,
      index: true,
    },


    /* =========================
       SNAPSHOT PRODUIT
    ========================= */

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
       VARIATION
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
       MONTANTS
    ========================= */

    montantTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    montantDepot: {
      type: Number,
      required: true,
      min: 0,
    },

    montantSolde: {
      type: Number,
      required: true,
      min: 0,
    },


    /* =========================
       PAIEMENTS
    ========================= */

    paiements: {
      type: [PaiementPrecommandeSchema],
      default: [],
    },


    /* =========================
       STATUT PRÉCOMMANDE
    ========================= */

    statut: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "READY_TO_FINALIZE",
        "FINALIZATION_PENDING",
        "FINALIZED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "PENDING",
      index: true,
    },


    /* =========================
       DISPONIBILITÉ
    ========================= */

    disponiblePourFinalisation: {
      type: Boolean,
      default: false,
      index: true,
    },


    /* =========================
       COMMANDE FINALE
    ========================= */

    commandeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commandeapi",
      default: null,
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


/* =====================================================
   INDEX
===================================================== */

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

precommandeSchema.index({
  clientId: 1,
  statut: 1,
});


module.exports = mongoose.model(
  "Precommande",
  precommandeSchema
);