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
// 🛡️ Dynamic & Safe CORS Setup
// ========================
const allowedOrigins = [
  "https://fridgeshare.vercel.app",
  "http://localhost:5173",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow main + preview domains dynamically
  if (
    allowedOrigins.includes(origin) ||
    /^https:\/\/fridge-share-[\w-]+\.vercel\.app$/.test(origin)
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
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
  visionClient = new vision.ImageAnnotatorClient();
  console.warn("⚠️ Using default local credentials");
}

// ========================
// 🌐 Fetch Polyfill (for Gemini API or future use)
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
