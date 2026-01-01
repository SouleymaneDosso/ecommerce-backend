const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true }, // URL Cloudinary
    publicId: { type: String, required: true }, // pour suppression Cloudinary
    isMain: { type: Boolean, default: false }, // image principale
  },
  { _id: false }
);

const schemaproduits = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },

    images: {
      type: [imageSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: "Au moins une image est requise",
      },
    },

    userId: { type: String, required: true },
    price: { type: Number, required: true, index: true },
    stock: { type: Number, default: 0 },
    tailles: { type: [String], default: [] },
    couleurs: { type: [String], default: [] },
    averageRating: { type: Number, default: 0 },

    stockParVariation: {
      type: Map,
      of: { type: Map, of: Number },
      default: {},
    },

    commentaires: {
      type: [
        {
          user: String,
          message: String,
          rating: Number,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    hero: { type: Boolean, default: false },
    genre: {
      type: String,
      enum: ["homme", "femme", "enfant"],
      required: true,
    },
    categorie: {
      type: String,
      enum: ["haut", "bas", "robe", "chaussure", "tout"],
      required: true,
      index: true,
    },
    badge: {
      type: String,
      enum: ["new", "promo", null],
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // ✅ active les virtuals dans JSON
    toObject: { virtuals: true }, // ✅ active les virtuals dans toObject
  }
);
module.exports = mongoose.model("Produits", schemaproduits);
