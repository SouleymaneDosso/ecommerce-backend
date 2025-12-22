const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary"); // notre config Cloudinary

// Configuration du storage Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "ecommerce", // nom du dossier dans Cloudinary
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

// Export pour gérer plusieurs images
module.exports = multer({ storage }).array("image");
