const express = require("express");
const router = express.Router();

const adminpage = require("../controller/admincontroller");

router.post("/create", adminpage.signup);
router.post("/login",   adminpage.login);

module.exports = router;
