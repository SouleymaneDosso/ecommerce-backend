const express = require("express");
const router = express.Router();
const authClient = require("../authentification/authClient");
const favoritesController = require("../controller/favoritesController");

router.get("/", authClient, favoritesController.getFavorites);
router.post("/toggle", authClient, favoritesController.toggleFavorite);

module.exports = router;
