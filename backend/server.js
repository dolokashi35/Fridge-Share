const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { Configuration, OpenAIApi } = require("openai");
const mongoose = require("mongoose");
require("dotenv").config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.DB_NAME,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({ dest: "uploads/" });

const vision = require("@google-cloud/vision");

// Load credentials from environment JSON (Render)
let visionClient;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  visionClient = new vision.ImageAnnotatorClient({ credentials });
  console.log("✅ Google Vision client initialized with JSON credentials");
} else {
  visionClient = new vision.ImageAnnotatorClient(); // fallback for local dev
  console.warn("⚠️  Using default credentials (local only)");
}


// Add fetch for Gemini API
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// User router and auth
const { router: userRouter, auth, users } = require('./users');
app.use(userRouter);

// In-memory store for posted items
const postedItems = [];

// In-memory messages store
const messages = [];

// Home route
app.get("/", (req, res) => {
  res.send("Server is running and MongoDB connected!");
});

// ...rest of your endpoints (recognize, messages, items)...

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});