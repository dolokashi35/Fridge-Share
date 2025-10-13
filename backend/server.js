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
import { router as userRouter } from "./users.js"; // ✅ Import user routes
import Item from "./models/Item.js"; // ✅ Import Item model

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

// ========================
// 🛡️ Middleware
// ========================
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
// 👥 Mount User Routes
// ========================
app.use("/users", userRouter); // ✅ Enables /users/register, /users/login, /users/profile

// ========================
// 👁️ Google Vision Setup
// ========================
let visionClient;
try {
  let credentials;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    // ✅ Render-safe (base64-encoded JSON env var)
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    visionClient = new vision.ImageAnnotatorClient({ credentials });
    console.log("✅ Google Vision initialized from environment JSON");
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // ✅ Local dev (path to service-account.json)
    visionClient = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    console.log("✅ Google Vision initialized from key file");
  } else {
    throw new Error("No Google credentials found.");
  }
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
  res.json({ status: "✅ FridgeShare backend running (Vision + Gemini + Auth)" })
);

// ========================
// 📸 POST /api/analyze — Vision Only (no auto description)
// ========================
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imagePath = path.resolve(req.file.path);
  const quantity = req.body.quantity || "1";

  try {
    console.log("🧠 Analyzing image:", imagePath);

    // Label detection
    const [labelResult] = await visionClient.labelDetection(imagePath);
    let labels = labelResult.labelAnnotations || [];

    // Fallbacks: Object + Text detection
    if (!labels.length) {
      console.warn("⚠️ No labels found, trying object localization...");
      const [objRes] = await visionClient.objectLocalization(imagePath);
      const objects = objRes.localizedObjectAnnotations || [];
      if (objects.length)
        labels = [{ description: objects[0].name, score: objects[0].score }];
    }

    if (!labels.length) {
      console.warn("⚠️ Trying text detection...");
      const [textRes] = await visionClient.textDetection(imagePath);
      const text = textRes.fullTextAnnotation?.text;
      if (text) {
        const firstWord = text.split(/\s+/)[0];
        labels = [{ description: firstWord, score: 0.5 }];
      }
    }

    // Final fallback
    if (!labels.length)
      labels = [{ description: "Unknown item", score: 0.0 }];

    const itemName = labels[0].description;
    const confidence = labels[0].score || 0.5;

    console.log(`📷 Detected: ${itemName} (${(confidence * 100).toFixed(1)}%)`);

    // Return Vision-only result
    res.json({
      itemName,
      description: "",
      marketPrice: "0.00",
      discountedPrice: "0.00",
      confidence: (confidence * 100).toFixed(1),
      detectedLabels: labels.map((l) => l.description),
    });
  } catch (err) {
    console.error("❌ Vision error:", err);
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
// ========================
// 💰 POST /api/suggest-price (Smarter logic: scale by quantity)
// ========================
app.post("/api/suggest-price", async (req, res) => {
  const { itemName, quantity } = req.body;
  if (!itemName || !quantity)
    return res.status(400).json({ error: "Missing itemName or quantity" });

  try {
    // 1️⃣ Ask Gemini for *base price per single unit*
    const prompt = `
You are an AI pricing assistant. Estimate the average *U.S. retail price* for ONE unit of "${itemName}".
Return only JSON like this:
{ "basePrice": "string (USD)" }
`;

    const response = await geminiModel.generateContent(prompt);
    const text = response.response.text();

    // 2️⃣ Parse safely
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      json = match ? JSON.parse(match[0]) : { basePrice: "1.00" };
    }

    // 3️⃣ Extract numeric price
    const base = parseFloat((json.basePrice || "1.00").replace(/[^0-9.]/g, "")) || 1.0;

    // 4️⃣ Compute total & markdown
    const qty = parseFloat(quantity) || 1;
    const marketPrice = base * qty;
    const discountedPrice = marketPrice * 0.5;

    // 5️⃣ Respond
    res.json({
      marketPrice: marketPrice.toFixed(2),
      discountedPrice: discountedPrice.toFixed(2),
      basePrice: base.toFixed(2),
      quantity: qty,
    });

    console.log(
      `💰 Base: $${base.toFixed(2)} x ${qty} = $${marketPrice.toFixed(2)} → discounted $${discountedPrice.toFixed(2)}`
    );

  } catch (err) {
    console.error("❌ Price generation failed:", err);
    res.status(500).json({ error: "Price generation failed" });
  }
});

// ========================
// 📦 ITEM ROUTES
// ========================

// GET /items - Get all active items
app.get("/items", async (req, res) => {
  try {
    const items = await Item.find({ 
      status: "active",
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
    
    res.json(items);
  } catch (err) {
    console.error("❌ Error fetching items:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// GET /items/:id - Get single item
app.get("/items/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (err) {
    console.error("❌ Error fetching item:", err);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

// POST /items - Create new item
app.post("/items", async (req, res) => {
  try {
    const {
      name,
      category,
      price,
      description,
      quantity,
      purchaseDate,
      expirationDate,
      listingDuration,
      transferMethods,
      imageUrl,
      username
    } = req.body;

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(listingDuration));

    const item = new Item({
      name,
      category,
      price: parseFloat(price),
      description,
      quantity: parseInt(quantity),
      purchaseDate: new Date(purchaseDate),
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      listingDuration: parseInt(listingDuration),
      transferMethods,
      imageUrl,
      username,
      expiresAt
    });

    await item.save();
    res.status(201).json(item);
  } catch (err) {
    console.error("❌ Error creating item:", err);
    res.status(500).json({ error: "Failed to create item" });
  }
});

// PUT /items/:id - Update item
app.put("/items/:id", async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    
    res.json(item);
  } catch (err) {
    console.error("❌ Error updating item:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /items/:id - Delete item
app.delete("/items/:id", async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting item:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ========================
// 🚀 Start Server
// ========================
app.listen(port, () =>
  console.log(`🚀 FridgeShare backend running on port ${port} (Vision + Gemini + Auth)`)
);
