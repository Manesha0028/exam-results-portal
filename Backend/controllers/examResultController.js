const mongoose = require("mongoose");

const Exam = require("../models/Exam");
const ExamResult = require("../models/ExamResult");
const { ExamParseError, parseExamResultsWorkbook } = require("../services/examResultParser");

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

    const parsedResults = parseExamResultsWorkbook(req.file.buffer);

    if (parsedResults.length === 0) {
      return res.status(400).json({ message: "No candidate records were found in the uploaded file." });
    }

    const latestByIndexNo = new Map();
    parsedResults.forEach((result) => {
      latestByIndexNo.set(result.indexNo, result);
    });
    const uniqueResults = [...latestByIndexNo.values()];

    const operations = uniqueResults.map((result) => ({
      updateOne: {
        filter: { exam: examId, indexNo: result.indexNo },
        update: { $set: { ...result, exam: examId } },
        upsert: true,
      },
    }));

    const writeResult = await ExamResult.bulkWrite(operations, { ordered: false });

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

    const results = await ExamResult.find(filter)
      .populate("exam", "name academicYear")
      .sort({ indexNo: 1 })
      .lean();
    return res.status(200).json({ results });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadExamResults,
  getExamResults,
};