// ========================
// 📦 Imports & Setup
// ========================
import express from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import vision from "@google-cloud/vision";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();
const port = process.env.PORT || 8080;

// ========================
// 🔗 MongoDB Connection
// ========================
mongoose
  .connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.use(
  cors({
    origin: ["https://fridgeshare.vercel.app", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });

// ========================
// 👁️ Google Vision Setup
// ========================
let visionClient;
try {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  visionClient = new vision.ImageAnnotatorClient({ credentials });
  console.log("✅ Google Vision initialized with env credentials");
} catch (err) {
  console.error("❌ Failed to initialize Vision client:", err.message);
  process.exit(1);
}

// ========================
// 🤖 Gemini Setup
// ========================
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
console.log("✅ Gemini 2.0 Flash initialized via API key");

// ========================
// 🏠 Root Route
// ========================
app.get("/", (_, res) =>
  res.json({ status: "✅ FridgeShare AI backend running (Vision + Gemini)" })
);

// ========================
// 📸 POST /api/analyze — Vision + Gemini with fallbacks
// ========================
// ========================
// 📸 POST /api/analyze — Vision only (no auto Gemini description)
// ========================
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imagePath = path.resolve(req.file.path);
  const quantity = req.body.quantity || "1";

  try {
    console.log("🧠 Analyzing image:", imagePath);

    // 1️⃣ Label Detection
    const [labelResult] = await visionClient.labelDetection(imagePath);
    let labels = labelResult.labelAnnotations || [];

    // 2️⃣ Object Localization fallback
    if (!labels.length) {
      console.warn("⚠️ No labels detected. Trying object localization...");
      const [objRes] = await visionClient.objectLocalization(imagePath);
      const objects = objRes.localizedObjectAnnotations || [];
      if (objects.length)
        labels = [{ description: objects[0].name, score: objects[0].score }];
    }

    // 3️⃣ Text Detection fallback
    if (!labels.length) {
      console.warn("⚠️ No objects found. Trying text detection...");
      const [textRes] = await visionClient.textDetection(imagePath);
      const text = textRes.fullTextAnnotation?.text;
      if (text) {
        const firstWord = text.split(/\s+/)[0];
        labels = [{ description: firstWord, score: 0.5 }];
      }
    }

    // 4️⃣ Final fallback
    if (!labels.length)
      labels = [{ description: "Unknown item", score: 0.0 }];

    const itemName = labels[0].description;
    const confidence = labels[0].score || 0.5;
    console.log(
      "📷 Detected:",
      itemName,
      `(${(confidence * 100).toFixed(1)}%)`
    );

    // ✅ Skip Gemini generation entirely — just return Vision data
    res.json({
      itemName,
      description: "", // will be empty until user clicks "Generate Description"
      marketPrice: "0.00",
      discountedPrice: "0.00",
      confidence: (confidence * 100).toFixed(1),
      detectedLabels: labels.map((l) => l.description),
    });
  } catch (err) {
    console.error("❌ Error analyzing image:", err);
    res.status(500).json({ error: "Vision analysis failed" });
  } finally {
    await fs.unlink(imagePath).catch(() => {});
  }
});

// ========================
// 💬 POST /api/generate-description
// ========================
app.post("/api/generate-description", async (req, res) => {
  const { itemName, quantity } = req.body;
  if (!itemName)
    return res.status(400).json({ error: "Missing itemName" });

  try {
    const prompt = `
Write a short, friendly (<200 chars) product description for "${itemName}" (quantity: ${quantity || 1})  
in the context of a community food sharing app.  
Return JSON: { "description": "string" }
`;
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : { description: text.trim() };
    res.json(json);
  } catch (err) {
    console.error("❌ Description generation failed:", err);
    res.status(500).json({ error: "Generation failed" });
  }
});

// ========================
// 💰 POST /api/suggest-price
// ========================
app.post("/api/suggest-price", async (req, res) => {
  const { itemName, quantity } = req.body;
  if (!itemName || !quantity)
    return res.status(400).json({ error: "Missing itemName or quantity" });

  try {
    const prompt = `
Estimate the average U.S. retail price for ${quantity} of "${itemName}".  
Then apply a 50% markdown for community resale.  
Return ONLY valid JSON:  
{
 "marketPrice": "string (USD)",
 "discountedPrice": "string (USD)"
}
`;

    const response = await geminiModel.generateContent(prompt);
    const text = response.response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      json = match ? JSON.parse(match[0]) : {
        marketPrice: "0.00",
        discountedPrice: "0.00",
      };
    }

    const market = parseFloat(json.marketPrice.replace(/[^0-9.]/g, "")) || 0;
    const discounted =
      parseFloat(json.discountedPrice.replace(/[^0-9.]/g, "")) || market / 2;

    json.marketPrice = market.toFixed(2);
    json.discountedPrice = discounted.toFixed(2);

    res.json(json);
  } catch (err) {
    console.error("❌ Error generating price:", err);
    res.status(500).json({ error: "Price generation failed" });
  }
});

// ========================
// 🚀 Start Server
// ========================
app.listen(port, () =>
  console.log(`🚀 FridgeShare AI running on port ${port} (Vision + Gemini API)`)
);
