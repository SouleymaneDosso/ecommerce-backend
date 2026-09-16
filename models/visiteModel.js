const mongoose = require("mongoose");

const visiteSchema = new mongoose.Schema(
  {
    // Identifiant anonyme du visiteur
    visitorId: {
      type: String,
      required: true,
      index: true,
    },

    // Si le visiteur est connecté, on pourra rattacher la visite
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Session de navigation
    sessionId: {
      type: String,
      required: true,
      index: true,
    },

    // Page visitée
    page: {
      type: String,
      required: true,
    },

    // Date de la visite
    visitedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Visite", visiteSchema);