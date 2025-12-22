const mongoose = require("mongoose")
const schemaproduits = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: [Object], required: true }, // { url, public_id }
    userId: { type: String, required: true },
    price: { type: Number, required: true, index: true }, // 🔹 index pour recherche rapide
    stock: { type: Number, default: 0 },
    tailles: { type: [String], default: [] },
    couleurs: { type: [String], default: [] },
    stockParVariation: { type: Map, of: { type: Map, of: Number }, default: {} },
    commentaires: { type: [
      { user: String, message: String, rating: Number, createdAt: { type: Date, default: Date.now } }
    ], default: [] },
    hero: { type: Boolean, default: false },
    genre: { type: String, enum: ["homme", "femme", "enfant"], required: true },
    categorie: { type: String, enum: ["haut", "bas", "robe", "chaussure", "tout"], required: true, index: true }, // 🔹 index
    badge: { type: String, enum: ["new", "promo", null], default: null }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// 🔹 Virtual "isNew"
schemaproduits.virtual("isNew").get(function () {
  const created = this.createdAt || new Date();
  const days = Number(process.env.NEW_PRODUCT_DAYS) || 7;
  return Date.now() - created.getTime() < days * 86400000;
});

module.exports = mongoose.model("Produits", schemaproduits);
