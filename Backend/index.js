const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const examResultRoutes = require("./routes/examResultRoutes");

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = (process.env.MONGO_URI || "").trim();

function logMongoConnectionError(error) {
  console.error("MongoDB connection failed:", error.message);

  const isSrvUri = MONGO_URI.startsWith("mongodb+srv://");
  const isSrvLookupFailure = typeof error.message === "string" && error.message.includes("querySrv ECONNREFUSED");

  if (isSrvUri && isSrvLookupFailure) {
    console.error(
      "Atlas SRV lookup failed. Your current DNS or network cannot resolve the cluster SRV record. Use the Atlas standard connection string format (mongodb://...), or switch DNS/network and retry.",
    );
  }
}

app.use(cors());
app.use(express.json());

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

const mongoStartupPromise = MONGO_URI && MONGO_URI.trim()
  ? mongoose
      .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
      })
      .then(() => {
        console.log("MongoDB connected");
      })
      .catch((error) => {
        logMongoConnectionError(error);
      })
  : null;

if (!mongoStartupPromise) {
  console.log("MONGO_URI not set. Starting server without database connection.");
}
