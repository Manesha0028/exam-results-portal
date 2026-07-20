const mongoose = require("mongoose");

const Exam = require("../models/Exam");

async function createExam(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database connection is not available." });
    }

    const name = (req.body.name || "").trim();
    const academicYear = (req.body.academicYear || "").trim();

    if (!name || !academicYear) {
      return res.status(400).json({ message: "Exam name and academic year are required." });
    }

    const created = await Exam.create({ name, academicYear });

    return res.status(201).json({
      message: "Exam created successfully.",
      exam: {
        id: created._id,
        name: created.name,
        academicYear: created.academicYear,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "This exam name and year already exists." });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function listExams(_req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database connection is not available." });
    }

    const exams = await Exam.find({}).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      exams: exams.map((exam) => ({
        id: exam._id,
        name: exam.name,
        academicYear: exam.academicYear,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createExam,
  listExams,
};
