const express = require("express");
const router = express.Router();
const authClient = require("../authentification/authClient");
const favoritesController = require("../controller/favoritesController");

// Récupérer tous les favoris
router.get("/", authClient, favoritesController.getFavorites);

// Ajouter ou retirer un favori
router.post("/toggle", authClient, favoritesController.toggleFavorite);

// Supprimer un favori spécifique
router.delete("/:id", authClient, favoritesController.deleteFavorite);

module.exports = router;
