// const express = require("express");
// const authAdmin = require("../authentification/authAdmin");
// const router = express.Router();
// const mesProduits = require("../controller/controllerproduits");
// const upload = require("../middleware/multer-config");

// // ===============================
// // CRUD PRODUITS (ADMIN)
// // ===============================

// // ➕ Créer un produit (multi-images)
// router.post(
//   "/",
//   authAdmin,
//   upload.array("images"),
//   mesProduits.sauvegarderProduits
// );

// // ✏️ Modifier un produit (optionnellement images)
// router.put(
//   "/:id",
//   authAdmin,
//   upload.array("images"),
//   mesProduits.updateProduit
// );

// // ❌ Supprimer un produit
// router.delete(
//   "/:id",
//   authAdmin,
//   mesProduits.deleteProduit
// );

// // ===============================
// // COMMENTAIRES (ADMIN)
// // ===============================
// router.delete(
//   "/:produitId/commentaires/:commentaireId",
//   authAdmin,
//   mesProduits.supprimerCommentaire
// );

// module.exports = router;


const express = require("express");
const authAdmin = require("../authentification/authAdmin");
const router = express.Router();
const mesProduits = require("../controller/controllerproduits");
const upload = require("../middleware/multer-config");

const fichiersProduit = upload.fields([
  { name: "images", maxCount: 10 },
  { name: "model3D", maxCount: 1 },
]);

// CRÉER un produit
router.post(
  "/",
  authAdmin,
  fichiersProduit,
  mesProduits.sauvegarderProduits
);

// MODIFIER un produit
router.put(
  "/:id",
  authAdmin,
  fichiersProduit,
  mesProduits.updateProduit
);

// SUPPRIMER un produit
router.delete(
  "/:id",
  authAdmin,
  mesProduits.deleteProduit
);

// SUPPRIMER un commentaire
router.delete(
  "/:produitId/commentaires/:commentaireId",
  authAdmin,
  mesProduits.supprimerCommentaire
);

module.exports = router;
