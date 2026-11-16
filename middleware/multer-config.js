// const multer = require("multer");
// const { CloudinaryStorage } = require("multer-storage-cloudinary");
// const cloudinary = require("../config/cloudinary");

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: "produits",
//     allowed_formats: ["jpg", "jpeg", "png", "webp"],
//     transformation: [
//       { width: 1200, height: 1200, crop: "limit", quality: "auto" },
//     ],
//   },
// });

// const upload = multer({
//   storage,
//   limits: {
//     fileSize: 5 * 1024 * 1024, // 5MB
//   },
// });

// module.exports = upload;



const multer = require("multer");
const { Transform } = require("stream");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "produits",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 1200, height: 1200, crop: "limit", quality: "auto" },
    ],
  },
});

const modelStorage = multer.memoryStorage();

function limitStream(file, maxSize) {
  let size = 0;

  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;

      if (size > maxSize) {
        return callback(
          new multer.MulterError("LIMIT_FILE_SIZE", file.fieldname)
        );
      }

      callback(null, chunk);
    },
  });

  file.stream.pipe(limiter);

  return limiter;
}

const storage = {
  _handleFile(req, file, callback) {
    const maxSize =
      file.fieldname === "images"
        ? 5 * 1024 * 1024
        : 50 * 1024 * 1024;

    const routedFile = {
      ...file,
      stream: limitStream(file, maxSize),
    };

    if (file.fieldname === "images") {
      return imageStorage._handleFile(req, routedFile, callback);
    }

    if (file.fieldname === "model3D") {
      return modelStorage._handleFile(req, routedFile, callback);
    }

    callback(new Error("Champ de fichier non autorisé"));
  },

  _removeFile(req, file, callback) {
    if (file.fieldname === "images") {
      return imageStorage._removeFile(req, file, callback);
    }

    return modelStorage._removeFile(req, file, callback);
  },
};

const upload = multer({
  storage,
  limits: {
    files: 11,
  },
  fileFilter(req, file, callback) {
    if (
      file.fieldname === "model3D" &&
      !file.originalname.toLowerCase().endsWith(".glb")
    ) {
      return callback(new Error("Seuls les fichiers .glb sont acceptés"));
    }

    if (!["images", "model3D"].includes(file.fieldname)) {
      return callback(new Error("Champ de fichier non autorisé"));
    }

    callback(null, true);
  },
});

module.exports = upload;
