const express = require("express");

const { loginAdmin, loginAdminOperation } = require("../controllers/adminAuthController");

const router = express.Router();

router.post("/login", loginAdmin);
router.post("/operation-login", loginAdminOperation);

module.exports = router;