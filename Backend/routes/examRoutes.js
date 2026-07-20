const express = require("express");

const { createExam, listExams } = require("../controllers/examController");

const router = express.Router();

router.post("/", createExam);
router.get("/", listExams);

module.exports = router;
