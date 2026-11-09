
const mongoose = require("mongoose");

const ReturnItemSchema = new mongoose.Schema(
  {
    panierIndex: { type: Number, required: true },
    produitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produits",
      required: true,
    },
    nom: { type: String, required: true },
    prix: { type: Number, required: true },
    image: { type: String, default: "" },
    quantite: { type: Number, required: true },
    couleur: { type: String, default: "" },
    taille: { type: String, default: "" },
    motif: { type: String, required: true },
  },
  { _id: false },
);

const ReturnPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const ReturnRequestSchema = new mongoose.Schema(
  {
    commandeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commandeapi",
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: {
      type: [ReturnItemSchema],
      required: true,
    },

    numeroWhatsApp: {
      type: String,
      required: true,
      trim: true,
    },

    description: { type: String, default: "" },

    solutionSouhaitee: {
      type: String,
      enum: ["REMBOURSEMENT", "ECHANGE"],
      required: true,
    },

    photos: [ReturnPhotoSchema],

    statut: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "COMPLETED",
      ],
      default: "PENDING",
      index: true,
    },

    commentaireAdmin: { type: String, default: "" },

    traitePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    traiteLe: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ReturnRequestSchema.index({ clientId: 1, createdAt: -1 });
ReturnRequestSchema.index({ commandeId: 1, statut: 1 });

module.exports = mongoose.model("ReturnRequest", ReturnRequestSchema);
