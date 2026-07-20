const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mark: {
      type: String,
      default: "",
      trim: true,
    },
    grade: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const examResultSchema = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
      index: true,
    },
    candidateName: {
      type: String,
      required: true,
      trim: true,
    },
    nicNumber: {
      type: String,
      required: true,
      trim: true,
    },
    indexNo: {
      type: String,
      required: true,
      trim: true,
    },
    center: {
      type: String,
      required: true,
      trim: true,
    },
    subjects: {
      type: [subjectSchema],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one subject is required.",
      },
    },
    total: {
      type: Number,
      default: null,
    },
    average: {
      type: String,
      default: "",
      trim: true,
    },
    finalGrade: {
      type: String,
      default: "",
      trim: true,
    },
    repeatSubjectCode: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

examResultSchema.index({ exam: 1, indexNo: 1 }, { unique: true });

module.exports = mongoose.model("ExamResult", examResultSchema);