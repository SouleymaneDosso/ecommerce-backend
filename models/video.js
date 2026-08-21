const mongoose = require("mongoose");
const Schema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String},
  url: { type: String, required: true },
  public_id: {type: String, required: true},
  thumbnail: { type: String, required: true }
});

module.exports = mongoose.model("Video", Schema);