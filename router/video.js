const express = require("express");
const router = express.Router();
const ajoutervideo = require("../controller/video");
const multer = require("../config/multer");

router.post("/upload", multer.array("videos"), ajoutervideo.uploadervideo);

router.get("/videos", ajoutervideo.getVideos);
router.delete("/videos/:id", ajoutervideo.deletevideo);

module.exports = router; 