const express = require("express");
const multer = require("multer");

const { uploadExamResults, getExamResults } = require("../controllers/examResultController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = new Set([
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ]);

    const isExcelFile = /\.(xls|xlsx)$/i.test(file.originalname);

    if (!isExcelFile && !allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error("Only Excel .xls or .xlsx files are supported."));
    }

    return callback(null, true);
  },
});

router.post("/upload", upload.single("file"), uploadExamResults);
router.get("/", getExamResults);

module.exports = router;