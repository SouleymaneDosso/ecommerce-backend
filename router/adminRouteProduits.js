const express = require("express");
const authAdmin = require("../authentification/authAdmin");
const router = express.Router();
const mesProduits = require("../controller/controllerproduits");
const upload = require("../middleware/multer-config");

// ===============================
// CRUD PRODUITS (ADMIN)
// ===============================

// ➕ Créer un produit (multi-images)
router.post(
  "/",
  authAdmin,
  upload.array("images", 6),
  mesProduits.sauvegarderProduits
);

// ✏️ Modifier un produit (optionnellement images)
router.put(
  "/:id",
  authAdmin,
  upload.array("images", 6),
  mesProduits.updateProduit
);

// ❌ Supprimer un produit
router.delete(
  "/:id",
  authAdmin,
  mesProduits.deleteProduit
);

// ===============================
// COMMENTAIRES (ADMIN)
// ===============================
router.delete(
  "/:produitId/commentaires/:commentaireId",
  authAdmin,
  mesProduits.supprimerCommentaire
);

module.exports = router;
