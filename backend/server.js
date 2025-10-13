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
const geminiModel = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.1,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
  }
});
console.log("✅ Gemini 1.5 Flash (Enhanced) initialized via API key");

// ========================
// 🏠 Root Route
// ========================
app.get("/", (_, res) =>
  res.json({ status: "✅ FridgeShare backend running (Vision + Gemini + Auth)" })
);

// ========================
// 📸 POST /api/analyze — Enhanced AI Analysis
// ========================
app.post("/api/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imagePath = path.resolve(req.file.path);
  const quantity = req.body.quantity || "1";

  try {
    console.log("🧠 Enhanced AI analysis:", imagePath);

    // Read image for Gemini
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    // Enhanced Vision API analysis
    const [labelResult] = await visionClient.labelDetection(imagePath);
    const [objectResult] = await visionClient.objectLocalization(imagePath);
    const [textResult] = await visionClient.textDetection(imagePath);
    
    let labels = labelResult.labelAnnotations || [];
    let objects = objectResult.localizedObjectAnnotations || [];
    let text = textResult.fullTextAnnotation?.text || "";

    // Use Gemini 1.5 Pro for advanced image understanding
    const geminiPrompt = `
    Analyze this food/grocery item image and provide:
    1. Exact item name (be specific: "Red Delicious Apple" not just "Apple")
    2. Category (Produce, Dairy, Meat, etc.)
    3. Brief description (brand, size, condition)
    4. Estimated retail price per unit in USD
    5. Confidence level (0-100%)

    Vision API detected: ${labels.map(l => l.description).join(', ')}
    Objects: ${objects.map(o => o.name).join(', ')}
    Text: ${text}

    Return JSON format:
    {
      "itemName": "specific item name",
      "category": "category name", 
      "description": "brief description",
      "estimatedPrice": "X.XX",
      "confidence": 85
    }
    `;

    const geminiResponse = await geminiModel.generateContent([
      geminiPrompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const geminiText = geminiResponse.response.text();
    console.log("🤖 Gemini response:", geminiText);

    // Parse Gemini response
    let aiResult;
    try {
      const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
      aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.warn("⚠️ Failed to parse Gemini JSON");
    }

    // Fallback to Vision API if Gemini fails
    if (!aiResult || !aiResult.itemName) {
      console.log("🔄 Falling back to Vision API");
      if (!labels.length && objects.length) {
        labels = [{ description: objects[0].name, score: objects[0].score }];
      }
      if (!labels.length && text) {
        const firstWord = text.split(/\s+/)[0];
        labels = [{ description: firstWord, score: 0.5 }];
      }
      if (!labels.length) {
        labels = [{ description: "Unknown item", score: 0.0 }];
      }
      
      aiResult = {
        itemName: labels[0].description,
        category: "Fresh",
        description: "",
        estimatedPrice: "1.00",
        confidence: (labels[0].score || 0.5) * 100
      };
    }

    console.log(`📷 AI Detected: ${aiResult.itemName} (${aiResult.confidence}%)`);

    res.json({
      itemName: aiResult.itemName,
      category: aiResult.category,
      description: aiResult.description,
      marketPrice: aiResult.estimatedPrice,
      discountedPrice: (parseFloat(aiResult.estimatedPrice) * 0.5).toFixed(2),
      confidence: aiResult.confidence.toString(),
      detectedLabels: labels.map((l) => l.description),
      aiEnhanced: true
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
