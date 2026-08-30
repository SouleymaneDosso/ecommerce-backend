const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const livreurSchema = new mongoose.Schema(
  {
    /* =========================
       IDENTITÉ
       ========================= */

    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    telephone: {
      type: String,
      required: true,
      trim: true,
    },

    /* =========================
       MOT DE PASSE
       ========================= */

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    /* =========================
       COMPTE LIVREUR
       ========================= */

    actif: {
      type: Boolean,
      default: true,
    },

    statut: {
      type: String,
      enum: ["OFFLINE", "AVAILABLE", "BUSY"],
      default: "OFFLINE",
    },

    /* =========================
       LOCALISATION GPS
       ========================= */

    localisation: {
      latitude: {
        type: Number,
        default: null,
      },

      longitude: {
        type: Number,
        default: null,
      },

      derniereMiseAJour: {
        type: Date,
        default: null,
      },
    },

    /* =========================
       COMMANDE ACTUELLE
       ========================= */

    commandeActuelle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commandeapi",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/* =========================
   COMPARER PASSWORD
   ========================= */

livreurSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("Livreur", livreurSchema);