const express = require("express");
const authAdmin = require("../authentification/authAdmin");
const router = express.Router();
const mesProduits = require("../controller/controllerproduits");
const multer = require("../authentification/multer-config");

// 🔹 CRUD produits (Admin)
router.post("/", authAdmin, multer, mesProduits.sauvegarderProduits);
router.put("/:id", authAdmin, multer, mesProduits.updateProduit);
router.delete("/:id", authAdmin, mesProduits.deleteProduit);

// 🔹 Gestion commentaires (Admin)
router.delete("/:produitId/commentaires/:commentaireId", authAdmin, mesProduits.supprimerCommentaire);

module.exports = router;
