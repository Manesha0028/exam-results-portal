const express = require("express");

const { createExam, listExams } = require("../controllers/examController");
const { requireAdminAuth } = require("../controllers/adminAuthController");

const router = express.Router();

router.post("/", requireAdminAuth, createExam);
router.get("/", listExams);

module.exports = router;
