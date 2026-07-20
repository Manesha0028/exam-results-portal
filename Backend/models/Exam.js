const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

examSchema.index({ name: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model("Exam", examSchema);
