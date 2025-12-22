const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Stockage Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "produits",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

const upload = multer({ storage });

// Middleware pour transformer les fichiers Multer en { url, public_id }
const multerCloudinary = (req, res, next) => {
  upload.array("image")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    
    // Transforme req.files pour avoir { url, public_id }
    if (req.files) {
      req.files = req.files.map(file => ({
        url: file.path,         // URL Cloudinary
        public_id: file.filename // public_id pour suppression
      }));
    }
    next();
  });
};

module.exports = multerCloudinary;
