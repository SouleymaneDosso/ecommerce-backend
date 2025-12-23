const express = require("express");
const router = express.Router();
const userController = require("../controller/userController");
const passwordController = require("../controller/passwordController");

router.post("/forgot-password", passwordController.requestPasswordReset);
router.post("/reset-password", passwordController.resetPassword);


router.post("/signup", userController.signup);
router.post("/login", userController.login);

module.exports = router;
