const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,        // ✅ API KEY
  api_secret: process.env.CLOUDINARY_API_SECRET, // ✅ API SECRET
});

module.exports = cloudinary;