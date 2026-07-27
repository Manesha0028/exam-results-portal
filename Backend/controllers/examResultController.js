const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");

const Exam = require("../models/Exam");
const ExamResult = require("../models/ExamResult");
const ExamUpload = require("../models/ExamUpload");
const { ExamParseError, parseExamResultsWorkbookForExam } = require("../services/examResultParser");

const UPLOAD_STORAGE_ROOT = path.join(__dirname, "..", "storage", "uploads");

function sanitizePathPart(value) {
  return (
    String(value || "")
      .trim()
      .replace(/[<>:\"/\\|?*]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\.+$/g, "")
      .slice(0, 120) || "upload"
  );
}

function getUploadFileExtension(fileName) {
  const ext = path.extname(fileName || "").toLowerCase();

  if (ext === ".xls" || ext === ".xlsx") {
    return ext;
  }

  return ".xlsx";
}

async function uploadExamResults(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "An Excel file is required." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database connection is not available. Check MONGO_URI and retry." });
    }

    const examId = (req.body.examId || "").trim();

    if (!examId) {
      return res.status(400).json({ message: "Exam selection is required before upload." });
    }

    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({ message: "Selected exam id is invalid." });
    }

    const exam = await Exam.findById(examId).lean();

    if (!exam) {
      return res.status(404).json({ message: "Selected exam was not found." });
    }

    const parsedResults = parseExamResultsWorkbookForExam(exam.name, req.file.buffer);

    if (parsedResults.length === 0) {
      return res.status(400).json({ message: "No candidate records were found in the uploaded file." });
    }

    const latestByIndexNo = new Map();
    parsedResults.forEach((result) => {
      latestByIndexNo.set(result.indexNo, result);
    });
    const uniqueResults = [...latestByIndexNo.values()];
    const uploadId = new mongoose.Types.ObjectId();
    const uploadFolder = path.join(
      UPLOAD_STORAGE_ROOT,
      sanitizePathPart(exam.academicYear),
      sanitizePathPart(exam.name),
    );
    const storedFileName = `${uploadId.toString()}${getUploadFileExtension(req.file.originalname)}`;
    const storedFilePath = path.join(uploadFolder, storedFileName);

    await fs.mkdir(uploadFolder, { recursive: true });
    await fs.writeFile(storedFilePath, req.file.buffer);

    const operations = uniqueResults.map((result) => ({
      updateOne: {
        filter: { upload: uploadId, indexNo: result.indexNo },
        update: { $set: { ...result, exam: examId, upload: uploadId } },
        upsert: true,
      },
    }));

    let writeResult;

    try {
      writeResult = await ExamResult.bulkWrite(operations, { ordered: false });

      await ExamUpload.create({
        _id: uploadId,
        exam: examId,
        originalFileName: req.file.originalname,
        storedFileName,
        storedFilePath,
        mimeType: req.file.mimetype || "",
        fileSize: req.file.size || 0,
        recordsProcessed: uniqueResults.length,
        insertedCount: writeResult.upsertedCount || 0,
        modifiedCount: writeResult.modifiedCount || 0,
        duplicatesIgnoredInFile: parsedResults.length - uniqueResults.length,
      });
    } catch (error) {
      await fs.unlink(storedFilePath).catch(() => {});
      throw error;
    }

    return res.status(200).json({
      message: "Exam results uploaded successfully.",
      recordsProcessed: uniqueResults.length,
      insertedCount: writeResult.upsertedCount || 0,
      modifiedCount: writeResult.modifiedCount || 0,
      duplicatesIgnoredInFile: parsedResults.length - uniqueResults.length,
      exam: {
        id: exam._id,
        name: exam.name,
        academicYear: exam.academicYear,
      },
      preview: uniqueResults.slice(0, 5),
    });
  } catch (error) {
    if (error instanceof ExamParseError) {
      return res.status(400).json({ message: error.message });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function getExamResults(_req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database connection is not available." });
    }

    const examId = (_req.query.examId || "").trim();
    const filter = {};

    if (examId) {
      if (!mongoose.Types.ObjectId.isValid(examId)) {
        return res.status(400).json({ message: "Selected exam id is invalid." });
      }

      filter.exam = examId;
    }

    const examUpload = examId
      ? await ExamUpload.findOne({ exam: examId }).sort({ createdAt: -1 }).select("_id").lean()
      : null;

    if (examId && examUpload?._id) {
      filter.upload = examUpload._id;
    } else if (examId) {
      filter.upload = null;
    }

    const results = await ExamResult.find(filter)
      .populate("exam", "name academicYear")
      .sort({ indexNo: 1 })
      .lean();
    return res.status(200).json({ results });
  } catch (error) {
    return next(error);
  }
}

async function listExamUploads(_req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database connection is not available." });
    }

    const uploads = await ExamUpload.find()
      .populate("exam", "name academicYear")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ uploads });
  } catch (error) {
    return next(error);
  }
}

async function downloadExamUpload(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database connection is not available." });
    }

    const uploadId = (req.params.uploadId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(uploadId)) {
      return res.status(400).json({ message: "Selected upload id is invalid." });
    }

    const upload = await ExamUpload.findById(uploadId).lean();

    if (!upload) {
      return res.status(404).json({ message: "Uploaded file was not found." });
    }

    return res.download(upload.storedFilePath, upload.originalFileName, (error) => {
      if (error) {
        next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteExamUpload(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database connection is not available." });
    }

    const uploadId = (req.params.uploadId || "").trim();

    if (!mongoose.Types.ObjectId.isValid(uploadId)) {
      return res.status(400).json({ message: "Selected upload id is invalid." });
    }

    const upload = await ExamUpload.findById(uploadId).lean();

    if (!upload) {
      return res.status(404).json({ message: "Uploaded file was not found." });
    }

    await Promise.all([
      ExamResult.deleteMany({ upload: upload._id }),
      fs.unlink(upload.storedFilePath).catch(() => {}),
    ]);

    await ExamUpload.deleteOne({ _id: upload._id });

    return res.status(200).json({ message: "Uploaded file and parsed results were deleted successfully." });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadExamResults,
  getExamResults,
  listExamUploads,
  downloadExamUpload,
  deleteExamUpload,
};