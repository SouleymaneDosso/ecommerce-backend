require("dotenv").config();
const express = require("express");
const app = express();
const singnupdmin = require("./router/adminroute");
const produitsAdmin = require("./router/adminRouteProduits");
const produitsClient = require("./router/clientRouteProduits")
const favorites = require("./router/favoritesRoute");
const userRoutes = require("./router/userRoutes");
const adminCompte = require("./router/adminCompteRoute");
const path = require("path");


const mongoose = require("mongoose");

const mongoUri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@dosso.zaz8nb5.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`;

mongoose
  .connect(mongoUri)
  .then(() => console.log("Connexion MongoDB réussie !"))
  .catch((err) => console.log("Connexion échouée !", err));

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

app.use(express.json());
app.use("/api/user", userRoutes);
app.use("/api/admin", singnupdmin);
app.use("/api/admin/compte", adminCompte);
app.use("/api/produits", produitsAdmin);
app.use("/api/produits", produitsClient);
app.use("/api/favorites", favorites);
app.use("/images", express.static(path.join(__dirname, "images")));



app.use((err, req, res, next) => {
  console.error("🔥 ERREUR GLOBALE :", err);
  res.status(500).json({ message: err.message });
});

module.exports = app;
