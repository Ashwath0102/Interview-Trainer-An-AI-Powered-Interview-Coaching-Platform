require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
// Inline defaults for development (overridden by .env)
process.env.IBM_API_KEY = process.env.IBM_API_KEY || "rTUaVmUraoMVOg20k0glewNtHRMKo1EMLmdFzeXmXv98";
process.env.IBM_ML_URL = process.env.IBM_ML_URL || "https://us-south.ml.cloud.ibm.com";
process.env.IBM_PROJECT_ID = process.env.IBM_PROJECT_ID || "60b20a3f-d83b-442e-a387-a886d89212c6";
process.env.IBM_MODEL_ID = process.env.IBM_MODEL_ID || "ibm/granite-4-h-small";
const express = require("express");
const cors = require("cors");
const path = require("path");

const chatRouter = require("./routes/chat");
const questionsRouter = require("./routes/questions");
const resumeRouter = require("./routes/resume");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Serve static front-end
app.use(express.static(path.join(__dirname, "../public")));

// API routes
app.use("/api/chat", chatRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/resume", resumeRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", model: process.env.IBM_MODEL_ID, version: "1.0.0" });
});

// Catch-all: serve SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🎯 InterviewTrainer running at http://localhost:${PORT}`);
  console.log(`   Model : ${process.env.IBM_MODEL_ID}`);
  console.log(`   Project: ${process.env.IBM_PROJECT_ID}\n`);
});
