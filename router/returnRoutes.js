
const express = require("express");
const router = express.Router();

const authClient = require("../authentification/authClient");
const authAdmin = require("../authentification/authAdmin");
const upload = require("../config/multer");

const {
  createReturnRequest,
  getMyReturnRequests,
  getMyReturnRequestById,
  cancelReturnRequest,
  getAllReturnRequests,
  getReturnRequestAdmin,
  updateReturnRequestStatus,
} = require("../controller/returnController");

// CLIENT
router.post(
  "/returns",
  authClient,
  upload.array("photos", 5),
  createReturnRequest,
);

router.get("/returns", authClient, getMyReturnRequests);

router.get("/returns/:id", authClient, getMyReturnRequestById);

router.put(
  "/returns/:id/cancel",
  authClient,
  cancelReturnRequest,
);

// ADMIN
router.get(
  "/admin/returns",
  authAdmin,
  getAllReturnRequests,
);

router.get(
  "/admin/returns/:id",
  authAdmin,
  getReturnRequestAdmin,
);

router.put(
  "/admin/returns/:id/status",
  authAdmin,
  updateReturnRequestStatus,
);

module.exports = router;
