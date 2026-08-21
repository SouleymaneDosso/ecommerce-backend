const multer = require("multer");

const storage = multer.memoryStorage();

const unpload = multer({
  storage,
});

module.exports = unpload;
