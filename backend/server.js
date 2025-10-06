const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { Configuration, OpenAIApi } = require("openai");
const mongoose = require("mongoose");
require("dotenv").config();

// ========================
// 🔗 MongoDB Connection
// ========================
mongoose
  .connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();
const port = process.env.PORT || 3001;

// ========================
// 🛡️ FIXED CORS (Manual Headers)
// ========================
const allowedOrigins = [
  "https://fridgeshare.vercel.app",
  "http://localhost:5173",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // ✅ Handle preflight requests properly
  }

  next();
});

// ========================
// 🧩 Middleware
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({ dest: "uploads/" });

// ========================
// 👁️ Google Vision Setup
// ========================
const vision = require("@google-cloud/vision");

let visionClient;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  visionClient = new vision.ImageAnnotatorClient({ credentials });
  console.log("✅ Google Vision client initialized with JSON credentials");
} else {
  visionClient = new vision.ImageAnnotatorClient(); // fallback for local dev
  console.warn("⚠️ Using default local credentials");
}

// ========================
// 🌐 Fetch Polyfill for Gemini API
// ========================
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ========================
// 👤 User Routes
// ========================
const { router: userRouter } = require("./users");
app.use("/users", userRouter);

// ========================
// 📦 Temporary In-Memory Stores
// ========================
const postedItems = [];
const messages = [];

// ========================
// 🏠 Root Route
// ========================
app.get("/", (req, res) => {
  res.json({ status: "Server running", mongo: "connected ✅" });
});

// ========================
// 🚀 Start Server
// ========================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
