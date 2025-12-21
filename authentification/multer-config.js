const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Types MIME autorisés
const MIME_TYPES = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

// Crée le dossier images s'il n'existe pas
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, 'images'); // dossier de stockage
  },
  filename: (req, file, callback) => {
    const name = file.originalname.split(' ').join('_').replace(/[^a-zA-Z0-9_-]/g, '');
    const extension = MIME_TYPES[file.mimetype];
    callback(null, name + '_' + Date.now() + '.' + extension);
  }
});

// Filtrage des fichiers autorisés
const fileFilter = (req, file, callback) => {
  if (MIME_TYPES[file.mimetype]) {
    callback(null, true);
  } else {
    callback(new Error('Type de fichier non autorisé'), false);
  }
};

// Export pour plusieurs images
module.exports = multer({ storage: storage, fileFilter: fileFilter }).array('image');
