const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

const Exam = require("./models/Exam");
const ExamResult = require("./models/ExamResult");
const ExamUpload = require("./models/ExamUpload");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const examRoutes = require("./routes/examRoutes");
const examResultRoutes = require("./routes/examResultRoutes");

dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = (process.env.MONGO_URI || "").trim();
const LOCAL_MONGO_URI = (process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/examportal").trim();
const ENABLE_LOCAL_MONGO_FALLBACK = (process.env.ENABLE_LOCAL_MONGO_FALLBACK || "true").trim().toLowerCase() !== "false";

function logMongoConnectionError(error, attemptedUri) {
  console.error("MongoDB connection failed:", error.message);

  const isSrvUri = attemptedUri.startsWith("mongodb+srv://");
  const isSrvLookupFailure = typeof error.message === "string" && error.message.includes("querySrv ECONNREFUSED");
  const isAtlasWhitelistError =
    typeof error.message === "string" &&
    error.message.includes("whitelisted");

  if (isSrvUri && isSrvLookupFailure) {
    console.error(
      "Atlas SRV lookup failed. Your current DNS or network cannot resolve the cluster SRV record. Use the Atlas standard connection string format (mongodb://...), or switch DNS/network and retry.",
    );
  }

  if (isAtlasWhitelistError) {
    console.error(
      "Atlas blocked this client IP. Add your current IP in Atlas Network Access, or use a local MongoDB URI for development.",
    );
  }
}

async function connectMongo(uri, label) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`MongoDB connected (${label})`);
  await syncModelIndexes();
}

async function startMongo() {
  if (!MONGO_URI) {
    console.log("MONGO_URI not set. Starting server without database connection.");
    return;
  }

  try {
    await connectMongo(MONGO_URI, "primary URI");
    return;
  } catch (error) {
    logMongoConnectionError(error, MONGO_URI);
  }

  const canTryLocalFallback =
    ENABLE_LOCAL_MONGO_FALLBACK &&
    LOCAL_MONGO_URI &&
    LOCAL_MONGO_URI !== MONGO_URI;

  if (!canTryLocalFallback) {
    console.error("MongoDB fallback is disabled or not configured. Backend is running without DB connection.");
    return;
  }

  console.log(`Attempting local MongoDB fallback: ${LOCAL_MONGO_URI}`);

  try {
    await connectMongo(LOCAL_MONGO_URI, "local fallback");
  } catch (fallbackError) {
    logMongoConnectionError(fallbackError, LOCAL_MONGO_URI);
    console.error("Local fallback connection failed. Backend is running without DB connection.");
  }
}

async function syncModelIndexes() {
  try {
    await ExamResult.collection.dropIndex("indexNo_1");
    console.log("Dropped legacy index: examresults.indexNo_1");
  } catch (error) {
    const isMissingIndexError =
      error?.codeName === "IndexNotFound" ||
      error?.code === 27 ||
      (typeof error?.message === "string" && error.message.includes("index not found"));

    if (!isMissingIndexError) {
      throw error;
    }
  }

  try {
    await ExamResult.collection.dropIndex("exam_1_indexNo_1");
    console.log("Dropped legacy index: examresults.exam_1_indexNo_1");
  } catch (error) {
    const isMissingIndexError =
      error?.codeName === "IndexNotFound" ||
      error?.code === 27 ||
      (typeof error?.message === "string" && error.message.includes("index not found"));

    if (!isMissingIndexError) {
      throw error;
    }
  }

  await Promise.all([Exam.syncIndexes(), ExamResult.syncIndexes(), ExamUpload.syncIndexes()]);
  console.log("MongoDB indexes synced");
}

app.use(cors());
app.use(express.json());

app.use("/api/admin", adminAuthRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/exam-results", examResultRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "backend" });
});

app.use((error, _req, res, _next) => {
  if (error.name === "MulterError") {
    return res.status(400).json({ message: error.message });
  }

  if (error.message === "Only Excel .xls or .xlsx files are supported.") {
    return res.status(400).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Internal server error." });
});

const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error("HTTP server failed:", error.message);
});

startMongo();
