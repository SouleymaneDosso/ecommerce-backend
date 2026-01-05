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
const compteClient = require("./router/compteRoutes");
const commandeRoutes = require("./router/commandeRoutes");
const produitsClient = require("./router/clientRouteProduits");
const favorites = require("./router/favoritesRoute");
const userRoutes = require("./router/userRoutes");
const resetPassword = require("./router/authRoutes")
const  newsletterRoute = require("./router/newsletter")
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

// CORS - autoriser ton frontend numa.luxe et Render
const allowedOrigins = [
  "http://localhost:5173",
  "https://ecommer-numa.vercel.app",
  "https://numa.luxe",
  "https://www.numa.luxe",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Autorise les requêtes serveur à serveur (pas de origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Body parsers - augmenter la limite pour gros panier ou images
app.use(express.json({ limit: "10mb" })); // 10 MB
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===============================
// ROUTES API
// ===============================
app.use("/api/user", userRoutes);
app.use("/api/compte", compteClient);
app.use("/api/auth", resetPassword );
app.use("/api", commandeRoutes);
app.use("/api/admin", singnupdmin);
app.use("/api/produits", produitsAdmin);
app.use("/api/produits", produitsClient);
app.use("/api/favorites", favorites);
app.use("/api/newsletter", newsletterRoute);

// ===============================
// GESTION ERREURS
// ===============================
app.use((err, req, res, next) => {
  console.error("🔥 ERREUR GLOBALE :", err);
  res.status(500).json({ message: err.message });
});

// ===============================
// EXPORT
// ===============================
module.exports = app;
