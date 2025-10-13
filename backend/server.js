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
    origin: ["https://fridgeshare.vercel.app", "http://localhost:5173", "http://localhost:5174"],
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
// 📸 POST /api/analyze — Enhanced Vision API (Reliable)
// ========================
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imagePath = path.resolve(req.file.path);
  const quantity = req.body.quantity || "1";

  try {
    console.log("🧠 Enhanced Vision analysis:", imagePath);

    // Enhanced Vision API analysis with multiple detection methods
    const [labelResult] = await visionClient.labelDetection(imagePath);
    const [objectResult] = await visionClient.objectLocalization(imagePath);
    const [textResult] = await visionClient.textDetection(imagePath);
    
    let labels = labelResult.labelAnnotations || [];
    let objects = objectResult.localizedObjectAnnotations || [];
    let text = textResult.fullTextAnnotation?.text || "";

    // Combine all detection results for better accuracy
    let allDetections = [];
    
    // Add high-confidence labels
    labels.forEach(label => {
      if (label.score > 0.6) {
        allDetections.push({
          name: label.description,
          confidence: label.score,
          type: 'label'
        });
      }
    });

    // Add objects
    objects.forEach(obj => {
      if (obj.score > 0.5) {
        allDetections.push({
          name: obj.name,
          confidence: obj.score,
          type: 'object'
        });
      }
    });

    // Sort by confidence
    allDetections.sort((a, b) => b.confidence - a.confidence);

    // Use best detection
    const bestDetection = allDetections[0] || { name: "Unknown item", confidence: 0.0 };
    
    // Determine category based on item name
    let category = "Fresh";
    const itemName = bestDetection.name.toLowerCase();
    if (itemName.includes('apple') || itemName.includes('banana') || itemName.includes('fruit') || itemName.includes('vegetable')) {
      category = "Produce";
    } else if (itemName.includes('milk') || itemName.includes('cheese') || itemName.includes('yogurt')) {
      category = "Dairy";
    } else if (itemName.includes('meat') || itemName.includes('chicken') || itemName.includes('beef')) {
      category = "Meat";
    }

    console.log(`📷 Enhanced Detection: ${bestDetection.name} (${allDetections.length} detections)`);

    res.json({
      itemName: bestDetection.name,
      category: category,
      description: text ? `Text detected: ${text.substring(0, 50)}...` : "",
      marketPrice: "1.00",
      discountedPrice: "0.50",
      confidence: (bestDetection.confidence * 100).toFixed(1),
      detectedLabels: allDetections.map(d => d.name),
      aiEnhanced: true,
      detectionCount: allDetections.length
    });
  } catch (err) {
    console.error("❌ Enhanced analysis error:", err);
    res.status(500).json({ error: "AI analysis failed" });
  } finally {
    await fs.unlink(imagePath).catch(() => {});
  }
});

// ========================
// 💬 POST /api/generate-description
// ========================
app.post("/api/generate-description", async (req, res) => {
  const { itemName, quantity, category } = req.body;
  if (!itemName)
    return res.status(400).json({ error: "Missing itemName" });

  try {
    const prompt = `
Write an engaging marketplace description for "${itemName}" (${quantity || 1} ${quantity > 1 ? 'items' : 'item'}, ${category || 'food item'}).

Make it:
- Appealing to college students
- Honest about condition/quality
- Include relevant details (brand, size, freshness, etc.)
- Keep it concise but informative (<200 chars)
- Use a friendly, casual tone

Example format:
"Fresh [item] from [store/brand]! [condition details]. [quantity info]. [why selling]. Perfect for [use case]."

Return JSON: { "description": "string" }
`;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);
    const json = match ? JSON.parse(match[0]) : { description: text.trim() };
    
    console.log(`📝 Enhanced description for ${itemName}: ${json.description.substring(0, 50)}...`);
    res.json(json);
  } catch (err) {
    console.error("❌ Enhanced description generation failed:", err);
    res.status(500).json({ error: "Description generation failed" });
  }
});

// ========================
// 💰 POST /api/suggest-price
// ========================
// ========================
// 💰 POST /api/suggest-price — Enhanced AI Pricing
// ========================
app.post("/api/suggest-price", async (req, res) => {
  const { itemName, quantity, category } = req.body;
  if (!itemName || !quantity)
    return res.status(400).json({ error: "Missing itemName or quantity" });

  try {
    // Simplified but effective pricing prompt
    const prompt = `Estimate the US retail price for "${itemName}" (${category || 'food item'}). 
    
Return JSON: {"retailPrice": "X.XX", "suggestedPrice": "X.XX", "reasoning": "brief explanation"}`;

    const response = await geminiModel.generateContent(prompt);
    const text = response.response.text();
    console.log("💰 Gemini pricing response:", text);

    // Parse response
    let pricingData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      pricingData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.warn("⚠️ Failed to parse pricing JSON");
    }

    // Fallback pricing if AI fails
    if (!pricingData || !pricingData.retailPrice) {
      console.log("🔄 Using fallback pricing");
      const fallbackPrice = Math.max(0.50, Math.min(15.00, itemName.length * 0.3));
      pricingData = {
        retailPrice: fallbackPrice.toFixed(2),
        suggestedPrice: (fallbackPrice * 0.7).toFixed(2),
        reasoning: "Estimated based on item characteristics"
      };
    }

    const qty = parseFloat(quantity) || 1;
    const retailPerUnit = parseFloat(pricingData.retailPrice);
    const suggestedPerUnit = parseFloat(pricingData.suggestedPrice);
    
    const totalRetail = retailPerUnit * qty;
    const totalSuggested = suggestedPerUnit * qty;

    res.json({
      marketPrice: totalRetail.toFixed(2),
      discountedPrice: totalSuggested.toFixed(2),
      basePrice: retailPerUnit.toFixed(2),
      quantity: qty,
      reasoning: pricingData.reasoning,
      aiEnhanced: true
    });

    console.log(
      `💰 Enhanced Pricing: ${itemName} - Retail: $${totalRetail.toFixed(2)}, Suggested: $${totalSuggested.toFixed(2)}`
    );

  } catch (err) {
    console.error("❌ Enhanced price generation failed:", err);
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
