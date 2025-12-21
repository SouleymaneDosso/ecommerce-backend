const express = require("express");
const router = express.Router();
const auth = require("../authentification/auth");
const favoritesController = require("../controller/favoritesController");

router.get("/", auth, favoritesController.getFavorites);
router.post("/toggle", auth, favoritesController.toggleFavorite);

module.exports = router;
