const cloudinary = require("cloudinary").v2;

// Configuration Cloudinary avec tes variables d'environnement
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_SECRET,
  api_secret: process.env.CLOUDINARY_API_KEY,
});

module.exports = cloudinary;
