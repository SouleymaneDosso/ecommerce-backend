require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();

// ===============================
// ROUTES
// ===============================
const singnupdmin = require("./router/adminroute");
const produitsAdmin = require("./router/adminRouteProduits");
const produitsClient = require("./router/clientRouteProduits");
const favorites = require("./router/favoritesRoute");
const userRoutes = require("./router/userRoutes");
const adminCompte = require("./router/adminCompteRoute");

// ===============================
// DATABASE
// ===============================
const mongoUri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@dosso.zaz8nb5.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`;

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ Connexion MongoDB réussie"))
  .catch((err) => console.error("❌ Connexion MongoDB échouée", err));

// ===============================
// MIDDLEWARES GLOBAUX
// ===============================

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  next();
});

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// ROUTES API
// ===============================
app.use("/api/user", userRoutes);
app.use("/api/admin", singnupdmin);
app.use("/api/admin/compte", adminCompte);
app.use("/api/produits", produitsAdmin);
app.use("/api/produits", produitsClient);
app.use("/api/favorites", favorites);

// ❌ SUPPRIMÉ : stockage local images
// app.use("/images", express.static(...));

// ===============================
// GESTION ERREURS
// ===============================
app.use((err, req, res, next) => {
  console.error("🔥 ERREUR GLOBALE :", err);
  res.status(500).json({ message: err.message });
});

module.exports = app;
