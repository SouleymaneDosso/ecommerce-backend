const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    public_id: {
      type: String,
      required: true,
    },

    thumbnail: {
      type: String,
      required: true,
    },

    // Vidéo éventuellement rattachée à un produit
    produitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Produits",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Video", Schema);