const express = require("express");

const router = express.Router();

const ajoutervideo = require("../controller/video");

const multer = require("../config/multer");

// ======================================
// VIDÉOS SOUS-HERO — EXISTANT
// ======================================

router.post(
  "/upload",
  multer.array("videos"),
  ajoutervideo.uploadervideo
);

// ======================================
// VIDÉO ASSOCIÉE À UN PRODUIT
// ======================================

router.post(
  "/upload-produit",
  multer.array("video", 1),
  ajoutervideo.uploadVideoProduit
);

// ======================================
// RÉCUPÉRER LES VIDÉOS
// ======================================

router.get(
  "/videos",
  ajoutervideo.getVideos
);

// ======================================
// SUPPRIMER UNE VIDÉO
// ======================================

router.delete(
  "/videos/:id",
  ajoutervideo.deletevideo
);

module.exports = router;