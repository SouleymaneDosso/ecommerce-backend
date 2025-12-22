const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Configuration Multer + Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "produits", // dossier sur Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "webp"], // formats autorisés
    transformation: [{ width: 800, height: 800, crop: "limit" }], // redimensionne si nécessaire
  },
});

const upload = multer({ storage: storage });

module.exports = upload.array("image"); // "image" doit correspondre au name de l'input sur le frontend


