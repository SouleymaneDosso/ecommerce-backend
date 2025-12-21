const express = require("express");
const auth = require("../authentification/auth");
const router = express.Router();
const mesProduits = require("../controller/controllerproduits");
const multer = require("../authentification/multer-config");

router.post("/", auth, multer, mesProduits.sauvegarderProduits);
router.get("/", mesProduits.getProduits);
router.get("/recommandations/:id", mesProduits.getRecommendations);
router.get("/:id", mesProduits.getProduitById);
router.put("/:id", auth, multer, mesProduits.updateProduit);
router.delete("/:produitId/commentaires/:commentaireId", auth, mesProduits.supprimerCommentaire);
router.delete("/:id", auth, mesProduits.deleteProduit);
router.post("/:id/commentaires", auth, mesProduits.ajouterCommentaire);

module.exports = router;
