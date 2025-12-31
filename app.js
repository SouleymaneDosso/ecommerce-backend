require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ===============================
// ROUTES
// ===============================
const singnupdmin = require("./router/adminroute");
const produitsAdmin = require("./router/adminRouteProduits");
const compteClient = require("./router/commandeRoutes")
const commandeRoutes = require("./router/commandeRoutes");
const produitsClient = require("./router/clientRouteProduits");
const favorites = require("./router/favoritesRoute");
const userRoutes = require("./router/userRoutes");
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
const corsOptions = {
  origin: ["http://localhost:5173", "https://ecommer-numa.vercel.app"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// ROUTES API
// ===============================
app.use("/api/user", userRoutes);
app.use("/api/compte", compteClient )
app.use("/api", commandeRoutes);
app.use("/api/admin", singnupdmin);
app.use("/api/produits", produitsAdmin);
app.use("/api/produits", produitsClient);
app.use("/api/favorites", favorites);

// ===============================
// GESTION ERREURS
// ===============================
app.use((err, req, res, next) => {
  console.error("🔥 ERREUR GLOBALE :", err);
  res.status(500).json({ message: err.message });
});

module.exports = app;
