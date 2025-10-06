const express = require("express");
const cors = require("cors");
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
// 🛡️ CORS Setup
// ========================
const allowedOrigins = [
  "https://fridgeshare.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow non-browser clients
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed for this origin: " + origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// handle OPTIONS (preflight) requests explicitly
app.options("*", cors());

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
  visionClient = new vision.ImageAnnotatorClient(); // local fallback
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
