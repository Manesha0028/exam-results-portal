const mongoose = require("mongoose");

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

    const parsedResults = parseExamResultsWorkbook(req.file.buffer);

    if (parsedResults.length === 0) {
      return res.status(400).json({ message: "No candidate records were found in the uploaded file." });
    }

    const operations = parsedResults.map((result) => ({
      updateOne: {
        filter: { indexNo: result.indexNo },
        update: { $set: result },
        upsert: true,
      },
    }));

    const writeResult = await ExamResult.bulkWrite(operations, { ordered: false });

    return res.status(200).json({
      message: "Exam results uploaded successfully.",
      recordsProcessed: parsedResults.length,
      insertedCount: writeResult.upsertedCount || 0,
      modifiedCount: writeResult.modifiedCount || 0,
      preview: parsedResults.slice(0, 5),
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

module.exports = {
  uploadExamResults,
};