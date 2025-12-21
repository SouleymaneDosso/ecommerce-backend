
const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Produits", required: true },
}, { timestamps: true });

module.exports = mongoose.model("Favorite", favoriteSchema);

