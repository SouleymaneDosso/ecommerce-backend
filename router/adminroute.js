const express = require("express");

const router = express.Router();

const adminpage = require("../controller/admincontroller");
const auth = require('../authentification/auth')

router.post("/create", adminpage.signup);
router.post("/login", adminpage.login);

module.exports = router;
