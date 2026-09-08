const express = require("express");
const router = express.Router();

const ajoutervideo = require("../controller/video");
const multer = require("../config/multer");
const authAdmin = require("../authentification/authAdmin");

// ======================================
// VIDÉOS SOUS-HERO — EXISTANT
// ======================================

router.post(
  "/upload",
  authAdmin,
  multer.array("videos"),
  ajoutervideo.uploadervideo
);

// ======================================
// VIDÉO ASSOCIÉE À UN PRODUIT
// ======================================

router.post(
  "/upload-produit",
  authAdmin,
  multer.array("video", 1),
  ajoutervideo.uploadVideoProduit
);

// ======================================
// RÉCUPÉRER LES VIDÉOS
// ======================================

router.get(
  "/videos",
  authAdmin,
  ajoutervideo.getVideos
);

// ======================================
// SUPPRIMER UNE VIDÉO
// ======================================

router.delete(
  "/videos/:id",
  authAdmin,
  ajoutervideo.deletevideo
);

router.get(
  "/produits",
  ajoutervideo.getVideosProduitsPublic
);

module.exports = router;