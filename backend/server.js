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
import { createServer } from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import qrcode from "qrcode";
import { router as userRouter, User, auth } from "./users.js"; // ✅ ESM named export
import Item from "./models/Item.js"; // ✅ Import Item model
import Transaction from "./models/Transaction.js";
import ChatRoom from "./models/ChatRoom.js";
import { uploadBase64ToS3, removeImageFromS3 } from "./upload.js";
import Offer from "./models/Offer.js";
import Message from "./models/Message.js";

dotenv.config();
const app = express();
const server = createServer(app);

// ========================
// 🛡️ Dynamic & Safe CORS Setup (Vercel + Render + env)
// ========================
const defaultAllowedOrigins = [
  "https://fridgeshare.vercel.app",
  "https://fridge-share.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];
const envAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const explicitAllowed = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];
const vercelMain = /^https:\/\/(fridge-share|fridgeshare)\.vercel\.app$/;
const vercelPreview = /^https:\/\/(fridge-share|fridgeshare)-[\w-]+\.vercel\.app$/;
const renderSubdomain = /^https:\/\/.*\.onrender\.com$/;
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow same-origin / non-browser
  return (
    explicitAllowed.includes(origin) ||
    vercelMain.test(origin) ||
    vercelPreview.test(origin) ||
    renderSubdomain.test(origin)
  );
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  },
});
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
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
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
    throw new Error("No Google credentials found. Vision features will be disabled.");
  }
} catch (err) {
  console.warn("⚠️ Vision disabled:", err.message);
  visionClient = null;
}

// ========================
// 🤖 Gemini Setup
// ========================
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
console.log("✅ Gemini 2.0 Flash initialized via API key");

// ========================
// 🖼️ Image Upload Endpoint (S3)
// ========================
app.post("/upload", async (req, res) => {
  try {
    const { base64Data, fileName } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "No image data provided" });
    }
    
    const url = await uploadBase64ToS3(base64Data, fileName);
    res.json({ url });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// ========================
// 🗑️ Delete Image Endpoint (S3)
// ========================
app.delete("/upload", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: "No image URL provided" });
    }
    
    await removeImageFromS3(imageUrl);
    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

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
  if (!visionClient) return res.status(503).json({ error: "Vision service unavailable" });
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  const imagePath = path.resolve(req.file.path);
  const quantity = req.body.quantity || "1";

  try {
    console.log("🧠 Enhanced Vision analysis:", imagePath);

    // Enhanced Vision API analysis with multiple detection methods
    const [labelResult] = await visionClient.labelDetection(imagePath);
    const [objectResult] = await visionClient.objectLocalization(imagePath);
    const [textResult] = await visionClient.textDetection(imagePath);
    const [logoResult] = await visionClient.logoDetection(imagePath);
    const [faceResult] = await visionClient.faceDetection(imagePath);
    
    let labels = labelResult.labelAnnotations || [];
    let objects = objectResult.localizedObjectAnnotations || [];
    let text = textResult.fullTextAnnotation?.text || "";
    let logos = logoResult.logoAnnotations || [];
    let faces = faceResult.faceAnnotations || [];

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

    // Add logos/brands (very important for food items)
    logos.forEach(logo => {
      if (logo.score > 0.3) {
        allDetections.push({
          name: logo.description,
          confidence: logo.score,
          type: 'logo'
        });
      }
    });

    // Filter out face-related detections (not relevant for food)
    allDetections = allDetections.filter(detection => 
      !detection.name.toLowerCase().includes('face') &&
      !detection.name.toLowerCase().includes('person') &&
      !detection.name.toLowerCase().includes('human') &&
      !detection.name.toLowerCase().includes('skin')
    );

    // Sort by confidence
    allDetections.sort((a, b) => b.confidence - a.confidence);

    // Use best detection
    const bestDetection = allDetections[0] || { name: "Unknown item", confidence: 0.0 };
    
    // Use Gemini to analyze detected text and improve item name/description
    let enhancedResult = {
      itemName: bestDetection.name,
      category: "Fresh",
      description: "",
      marketPrice: "1.00",
      discountedPrice: "0.50"
    };

    if (text && text.trim().length > 0) {
      try {
        const geminiPrompt = `
Analyze this food item image with multiple detection methods:

DETECTED TEXT: "${text}"
DETECTED LABELS: ${allDetections.slice(0, 5).map(d => d.name).join(', ')}
DETECTED OBJECTS: ${objects.slice(0, 3).map(o => o.name).join(', ')}
DETECTED LOGOS: ${logos.slice(0, 2).map(l => l.description).join(', ')}

Focus on FOOD ITEMS ONLY. Provide:
1. Most specific item name possible (include brand if detected)
2. Correct category (Produce, Dairy, Meat, Seafood, Frozen, Fresh, Drinks, Snacks, Canned, Spices, Sauces)
3. Brief description mentioning key details from text/labels

Return JSON:
{
  "itemName": "specific item name with brand",
  "category": "correct category",
  "description": "brief description with key details"
}
`;

        const response = await geminiModel.generateContent(geminiPrompt);
        const geminiText = response.response.text();
        
        const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiResult = JSON.parse(jsonMatch[0]);
          enhancedResult.itemName = aiResult.itemName || bestDetection.name;
          enhancedResult.category = aiResult.category || "Fresh";
          enhancedResult.description = aiResult.description || "";
        }
      } catch (e) {
        console.warn("⚠️ Text analysis failed, using Vision API only");
      }
    }

    // Enhanced fallback category detection using all detection methods
    if (enhancedResult.category === "Fresh") {
      const itemName = enhancedResult.itemName.toLowerCase();
      const allText = (text + " " + allDetections.map(d => d.name).join(" ")).toLowerCase();
      
      if (itemName.includes('apple') || itemName.includes('banana') || itemName.includes('fruit') || itemName.includes('vegetable') || 
          allText.includes('produce') || allText.includes('organic') || allText.includes('fresh')) {
        enhancedResult.category = "Produce";
      } else if (itemName.includes('milk') || itemName.includes('cheese') || itemName.includes('yogurt') || 
                 allText.includes('dairy') || allText.includes('cream')) {
        enhancedResult.category = "Dairy";
      } else if (itemName.includes('meat') || itemName.includes('chicken') || itemName.includes('beef') || 
                 allText.includes('protein') || allText.includes('poultry')) {
        enhancedResult.category = "Meat";
      } else if (allText.includes('frozen') || allText.includes('ice cream')) {
        enhancedResult.category = "Frozen";
      } else if (allText.includes('drink') || allText.includes('beverage') || allText.includes('juice')) {
        enhancedResult.category = "Drinks";
      } else if (allText.includes('snack') || allText.includes('chips') || allText.includes('candy')) {
        enhancedResult.category = "Snacks";
      }
    }

    console.log(`📷 Enhanced Detection: ${enhancedResult.itemName} (${allDetections.length} detections)`);

    res.json({
      itemName: enhancedResult.itemName,
      category: enhancedResult.category,
      description: enhancedResult.description,
      marketPrice: enhancedResult.marketPrice,
      discountedPrice: enhancedResult.discountedPrice,
      confidence: (bestDetection.confidence * 100).toFixed(1),
      detectedLabels: allDetections.map(d => d.name),
      detectedText: text,
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
// 🤝 POST /api/handoff
// ========================
app.post("/api/handoff", async (req, res) => {
  const { itemId, handoffTo, handoffNotes } = req.body;
  
  if (!itemId || !handoffTo) {
    return res.status(400).json({ error: "Missing itemId or handoffTo" });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Check if item is still available
    if (item.status !== "active") {
      return res.status(400).json({ error: "Item is no longer available" });
    }

    // Update item with handoff information
    item.handoffStatus = "pending";
    item.handoffTo = handoffTo;
    item.handoffNotes = handoffNotes || "";
    item.handoffDate = new Date();
    item.status = "handed_off";

    await item.save();

    console.log(`🤝 Handoff initiated: ${item.name} → ${handoffTo}`);
    res.json({ 
      success: true, 
      message: "Handoff initiated successfully",
      handoffStatus: item.handoffStatus,
      handoffTo: item.handoffTo,
      handoffDate: item.handoffDate
    });
  } catch (err) {
    console.error("❌ Handoff error:", err);
    res.status(500).json({ error: "Handoff failed" });
  }
});

// ========================
// ✅ POST /api/complete-handoff
// ========================
app.post("/api/complete-handoff", async (req, res) => {
  const { itemId } = req.body;
  
  if (!itemId) {
    return res.status(400).json({ error: "Missing itemId" });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (item.handoffStatus !== "pending") {
      return res.status(400).json({ error: "Item is not in pending handoff status" });
    }

    // Complete the handoff
    item.handoffStatus = "completed";
    item.status = "sold";

    await item.save();

    console.log(`✅ Handoff completed: ${item.name} → ${item.handoffTo}`);
    res.json({ 
      success: true, 
      message: "Handoff completed successfully",
      handoffStatus: item.handoffStatus
    });
  } catch (err) {
    console.error("❌ Complete handoff error:", err);
    res.status(500).json({ error: "Complete handoff failed" });
  }
});

// ========================
// ❌ POST /api/cancel-handoff
// ========================
app.post("/api/cancel-handoff", async (req, res) => {
  const { itemId } = req.body;
  
  if (!itemId) {
    return res.status(400).json({ error: "Missing itemId" });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (item.handoffStatus !== "pending") {
      return res.status(400).json({ error: "Item is not in pending handoff status" });
    }

    // Cancel the handoff and reactivate item
    item.handoffStatus = "cancelled";
    item.handoffTo = null;
    item.handoffNotes = "";
    item.handoffDate = null;
    item.status = "active";

    await item.save();

    console.log(`❌ Handoff cancelled: ${item.name}`);
    res.json({ 
      success: true, 
      message: "Handoff cancelled successfully",
      status: item.status
    });
  } catch (err) {
    console.error("❌ Cancel handoff error:", err);
    res.status(500).json({ error: "Cancel handoff failed" });
  }
});

// ========================
// 📋 GET /api/handoffs/:username
// ========================
app.get("/api/handoffs/:username", async (req, res) => {
  const { username } = req.params;
  
  try {
    // Get items handed off TO this user
    const receivedHandoffs = await Item.find({
      handoffTo: username,
      handoffStatus: "pending"
    }).sort({ handoffDate: -1 });

    // Get items handed off BY this user
    const sentHandoffs = await Item.find({
      username: username,
      handoffStatus: { $in: ["pending", "completed"] }
    }).sort({ handoffDate: -1 });

    res.json({
      received: receivedHandoffs,
      sent: sentHandoffs
    });
  } catch (err) {
    console.error("❌ Get handoffs error:", err);
    res.status(500).json({ error: "Failed to fetch handoffs" });
  }
});

// ========================
// 💬 POST /api/generate-description
// ========================
app.post("/api/generate-description", async (req, res) => {
  const { itemName, quantity, category, detectedText } = req.body;
  if (!itemName)
    return res.status(400).json({ error: "Missing itemName" });

  try {
    const dynamicPrompt = detectedText && detectedText.trim().length > 0
      ? `Create a marketplace description for "${itemName}" using this product information: "${detectedText}"

Requirements:
- Use specific details from the text (brand, nutrition facts, features)
- Keep under 80 characters
- Be factual and appealing
- Mention key selling points

Return JSON: { "description": "string" }`
      : `Create a concise, factual marketplace description (<=80 chars) for "${itemName}".
Return JSON: { "description": "string" }`;

    const response = await geminiModel.generateContent(dynamicPrompt);
    const geminiText = response.response.text();
    const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "AI did not return a valid description" });
    }

    const aiResult = JSON.parse(jsonMatch[0]);
    if (!aiResult?.description) {
      return res.status(502).json({ error: "AI did not return a description" });
    }

    console.log(`📝 Enhanced description for ${itemName}: ${aiResult.description.substring(0, 50)}...`);
    res.json({ description: aiResult.description });
  } catch (err) {
    console.error("❌ Description generation failed:", err);
    res.status(502).json({ error: "AI description generation failed" });
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "AI did not return pricing JSON" });
    }
    const pricingData = JSON.parse(jsonMatch[0]);
    if (!pricingData?.retailPrice || !pricingData?.suggestedPrice) {
      return res.status(502).json({ error: "AI pricing JSON incomplete" });
    }

    const qty = parseFloat(quantity) || 1;
    const retailPerUnit = parseFloat(pricingData.retailPrice);
    const suggestedPerUnit = parseFloat(pricingData.suggestedPrice);
    
    const totalRetail = retailPerUnit * qty;
    const totalSuggested = suggestedPerUnit * qty;
    const totalDiscounted = totalSuggested * 0.5; // requested: suggested * quantity * 0.5

    res.json({
      marketPrice: totalRetail.toFixed(2),
      discountedPrice: totalDiscounted.toFixed(2),
      basePrice: retailPerUnit.toFixed(2),
      quantity: qty,
      reasoning: pricingData.reasoning,
      aiEnhanced: true
    });

    console.log(
      `💰 Enhanced Pricing: ${itemName} - Retail: $${totalRetail.toFixed(2)}, Suggested: $${totalSuggested.toFixed(2)}, Discounted: $${totalDiscounted.toFixed(2)}`
    );

  } catch (err) {
    console.error("❌ Price generation failed:", err);
    res.status(502).json({ error: "AI price generation failed" });
  }
});

// ========================
// 📦 ITEM ROUTES
// ========================

// ========================
// 💬 Offer Routes (Buyer/Seller flow)
// ========================

// Query offers for current user (buyer or seller)
app.get("/api/offers", auth, async (req, res) => {
  try {
    const { role, itemId, status } = req.query; // role: 'buyer' | 'seller'
    const match = {};
    if (role === "buyer") match.buyerUsername = req.user.username;
    else if (role === "seller") match.sellerUsername = req.user.username;
    else match.$or = [{ buyerUsername: req.user.username }, { sellerUsername: req.user.username }];
    if (itemId) match.itemId = itemId;
    if (status) match.status = status;
    const offers = await Offer.find(match).sort({ createdAt: -1 }).lean();
    res.json(offers);
  } catch (err) {
    console.error("❌ List offers error:", err);
    res.status(500).json({ error: "Failed to list offers" });
  }
});

// Buyer creates an offer
app.post("/api/offers", auth, async (req, res) => {
  try {
    const { itemId, offerPrice, message } = req.body;
    if (!itemId || offerPrice == null) {
      return res.status(400).json({ error: "Missing itemId or offerPrice" });
    }
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (item.username === req.user.username) {
      return res.status(400).json({ error: "You cannot request your own item" });
    }
    const offer = await Offer.create({
      itemId,
      buyerUsername: req.user.username,
      sellerUsername: item.username,
      offerPrice: Number(offerPrice),
      message: message || "",
    });
    res.status(201).json({ success: true, offer });
  } catch (err) {
    console.error("❌ Create offer error:", err);
    res.status(500).json({ error: "Failed to create offer" });
  }
});

// Seller responds to an offer: accept/decline/counter
app.post("/api/offers/:id/respond", auth, async (req, res) => {
  try {
    const { action, counterPrice } = req.body; // action: 'accept' | 'decline' | 'counter'
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    if (offer.sellerUsername !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (action === "accept") {
      offer.status = "accepted";
      await offer.save();
      return res.json({ success: true, offer });
    }
    if (action === "decline") {
      offer.status = "declined";
      await offer.save();
      return res.json({ success: true, offer });
    }
    if (action === "counter") {
      // Negotiation should move to chat; sellers cannot counter via API
      return res.status(400).json({ error: "Seller counter via API is disabled. Use chat to negotiate." });
    }
    return res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    console.error("❌ Respond offer error:", err);
    res.status(500).json({ error: "Failed to respond to offer" });
  }
});

// Buyer schedules pickup (after accepted)
app.post("/api/offers/:id/schedule", auth, async (req, res) => {
  try {
    const { timeOption, preferredLocation } = req.body;
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    if (offer.buyerUsername !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (offer.status !== "accepted" && offer.status !== "countered") {
      return res.status(400).json({ error: "Offer not in accepted/countered state" });
    }
    offer.schedule = {
      timeOption: timeOption || null,
      preferredLocation: preferredLocation || "",
    };
    offer.status = "ready_for_pickup";
    await offer.save();
    res.json({ success: true, offer });
  } catch (err) {
    console.error("❌ Schedule offer error:", err);
    res.status(500).json({ error: "Failed to schedule pickup" });
  }
});

// Either party confirms completion
app.post("/api/offers/:id/complete", auth, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    if (![offer.buyerUsername, offer.sellerUsername].includes(req.user.username)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    offer.status = "completed";
    await offer.save();
    // Optionally mark item as sold
    await Item.findByIdAndUpdate(offer.itemId, { status: "sold" });
    res.json({ success: true, offer });
  } catch (err) {
    console.error("❌ Complete offer error:", err);
    res.status(500).json({ error: "Failed to complete offer" });
  }
});

// Buyer cancels a pending/countered offer
app.post("/api/offers/:id/cancel", auth, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    if (offer.buyerUsername !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!["pending", "countered"].includes(offer.status)) {
      return res.status(400).json({ error: "Only pending/countered offers can be cancelled" });
    }
    offer.status = "cancelled";
    await offer.save();
    res.json({ success: true, offer });
  } catch (err) {
    console.error("❌ Cancel offer error:", err);
    res.status(500).json({ error: "Failed to cancel offer" });
  }
});

// ========================
// ✉️ Simple Messages (for general chat)
// ========================
app.get("/api/messages", auth, async (req, res) => {
  try {
    const { peer } = req.query;
    const me = req.user.username;
    let match;
    if (peer) {
      match = {
        $or: [
          { from: me, to: peer },
          { from: peer, to: me }
        ]
      };
    } else {
      match = {
        $or: [{ from: me }, { to: me }]
      };
    }
    const docs = await Message.find(match).sort({ timestamp: 1 }).lean();
    const messages = docs.map((d) => ({
      id: d._id.toString(),
      from: d.from,
      to: d.to,
      content: d.content,
      timestamp: d.timestamp
    }));
    res.json({ messages });
  } catch (err) {
    console.error("❌ List messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

app.post("/api/messages", auth, async (req, res) => {
  try {
    const { to, content } = req.body;
    if (!to || !content) return res.status(400).json({ error: "Missing to or content" });
    const msg = await Message.create({
      from: req.user.username,
      to,
      content,
      timestamp: new Date()
    });
    res.status(201).json({
      message: {
        id: msg._id.toString(),
        from: msg.from,
        to: msg.to,
        content: msg.content,
        timestamp: msg.timestamp
      }
    });
  } catch (err) {
    console.error("❌ Send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// GET /items - Get all active items (same college as requester, exclude self)
app.get("/items", auth, async (req, res) => {
  try {
    const me = await User.findOne({ username: req.user.username }).lean();
    const myCollege = me?.profile?.college;
    if (!myCollege) {
      return res.status(400).json({ error: "User college not set" });
    }
    // Find all users in the same college except self
    const sameCollegeUsers = await User.find(
      { "profile.college": myCollege, username: { $ne: req.user.username } },
      { username: 1 }
    ).lean();
    const allowedUsernames = new Set(sameCollegeUsers.map(u => u.username));

    const items = await Item.find({ 
      status: "active",
      expiresAt: { $gt: new Date() },
      username: { $in: Array.from(allowedUsernames) }
    }).sort({ createdAt: -1 });
    
    res.json(items);
  } catch (err) {
    console.error("❌ Error fetching items:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// GET /items/mine - Get items posted by the authenticated user
app.get("/items/mine", auth, async (req, res) => {
  try {
    const items = await Item.find({
      username: req.user.username,
    }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("❌ Error fetching my items:", err);
    res.status(500).json({ error: "Failed to fetch my items" });
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

// POST /items - Create new item (auth; username from token)
app.post("/items", auth, async (req, res) => {
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
      location
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
      username: req.user.username,
      location: location || null, // Include location data
      expiresAt
    });

    await item.save();
    console.log(`✅ Item created: ${item.name} at ${location?.name || 'No location'}`);
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
// 🏥 Health Check Endpoint
// ========================
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    services: {
      mongodb: "connected",
      socketio: "active",
      vision: "ready",
      gemini: "ready"
    }
  });
});

// ========================
// 🧮 Helper Functions
// ========================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

// ========================
// 🗺️ GET /api/items/nearby - Map-First Discovery
// ========================
app.get("/api/items/nearby", auth, async (req, res) => {
  const { lat, lng, radius = 5000 } = req.query; // radius in meters
  
  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing latitude or longitude" });
  }

  try {
    // Filter by same college as requester and exclude self
    const me = await User.findOne({ username: req.user.username }).lean();
    const myCollege = me?.profile?.college;
    if (!myCollege) {
      return res.status(400).json({ error: "User college not set" });
    }
    const sameCollegeUsers = await User.find(
      { "profile.college": myCollege, username: { $ne: req.user.username } },
      { username: 1 }
    ).lean();
    const allowedUsernames = new Set(sameCollegeUsers.map(u => u.username));

    const items = await Item.find({
      status: "active",
      username: { $in: Array.from(allowedUsernames) },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      }
    }).limit(50);

    // Add distance calculation
    const itemsWithDistance = items.map(item => {
      const distance = calculateDistance(
        parseFloat(lat), parseFloat(lng),
        item.location.coordinates[1], item.location.coordinates[0]
      );
      return {
        ...item.toObject(),
        distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
      };
    });

    res.json(itemsWithDistance);
  } catch (err) {
    console.error("❌ Nearby items error:", err);
    res.status(500).json({ error: "Failed to fetch nearby items" });
  }
});

// ========================
// 💬 POST /api/transactions/start - Start Transaction & Chat
// ========================
app.post("/api/transactions/start", async (req, res) => {
  const { itemId, buyerId, buyerUsername } = req.body;
  
  if (!itemId || !buyerId || !buyerUsername) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (item.status !== "active") {
      return res.status(400).json({ error: "Item is no longer available" });
    }

    // Generate verification code and QR code
    const verificationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const qrCodeData = await qrcode.toDataURL(verificationCode);

    // Create transaction
    const transaction = new Transaction({
      itemId,
      sellerId: item.username,
      buyerId,
      verificationCode,
      qrCode: qrCodeData,
      chatRoomId: crypto.randomUUID()
    });

    await transaction.save();

    // Create chat room
    const chatRoom = new ChatRoom({
      transactionId: transaction._id,
      participants: [
        { userId: item.username, username: item.username },
        { userId: buyerId, username: buyerUsername }
      ]
    });

    await chatRoom.save();

    console.log(`💬 Transaction started: ${item.name} - ${buyerUsername} → ${item.username}`);

    res.json({
      success: true,
      transaction: transaction,
      chatRoom: chatRoom
    });
  } catch (err) {
    console.error("❌ Start transaction error:", err);
    res.status(500).json({ error: "Failed to start transaction" });
  }
});

// ========================
// 📍 POST /api/transactions/:id/location - Set Meeting Location
// ========================
app.post("/api/transactions/:id/location", async (req, res) => {
  const { id } = req.params;
  const { coordinates, name } = req.body;
  
  if (!coordinates || !name) {
    return res.status(400).json({ error: "Missing coordinates or location name" });
  }

  try {
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    transaction.location = {
      type: "Point",
      coordinates,
      name
    };

    await transaction.save();

    res.json({ success: true, location: transaction.location });
  } catch (err) {
    console.error("❌ Set location error:", err);
    res.status(500).json({ error: "Failed to set location" });
  }
});

// ========================
// ⏰ POST /api/transactions/:id/time - Set Pickup Time
// ========================
app.post("/api/transactions/:id/time", async (req, res) => {
  const { id } = req.params;
  const { start, end } = req.body;
  
  if (!start || !end) {
    return res.status(400).json({ error: "Missing start or end time" });
  }

  try {
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    transaction.pickupWindow = {
      start: new Date(start),
      end: new Date(end)
    };
    transaction.status = "confirmed";

    await transaction.save();

    res.json({ success: true, pickupWindow: transaction.pickupWindow });
  } catch (err) {
    console.error("❌ Set time error:", err);
    res.status(500).json({ error: "Failed to set pickup time" });
  }
});

// ========================
// ✅ POST /api/transactions/:id/verify - Verify Handoff
// ========================
app.post("/api/transactions/:id/verify", async (req, res) => {
  const { id } = req.params;
  const { verificationCode, userLocation } = req.body;
  
  if (!verificationCode) {
    return res.status(400).json({ error: "Missing verification code" });
  }

  try {
    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (transaction.verificationCode !== verificationCode.toUpperCase()) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Check if user is within 50m of meeting location
    if (userLocation && transaction.location) {
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        transaction.location.coordinates[1], transaction.location.coordinates[0]
      );
      
      if (distance > 0.05) { // 50 meters
        return res.status(400).json({ error: "You must be within 50m of the meeting location" });
      }
    }

    transaction.status = "completed";
    transaction.completedAt = new Date();

    // Update item status
    await Item.findByIdAndUpdate(transaction.itemId, { status: "sold" });

    await transaction.save();

    res.json({ success: true, transaction });
  } catch (err) {
    console.error("❌ Verify transaction error:", err);
    res.status(500).json({ error: "Failed to verify transaction" });
  }
});

// ========================
// 📋 GET /api/transactions/:userId - Get User Transactions
// ========================
app.get("/api/transactions/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const transactions = await Transaction.find({
      $or: [{ sellerId: userId }, { buyerId: userId }]
    }).populate('itemId').sort({ createdAt: -1 });

    res.json(transactions);
  } catch (err) {
    console.error("❌ Get transactions error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ========================
// 💬 GET /api/chat/:transactionId/messages - Get Chat Messages
// ========================
app.get("/api/chat/:transactionId/messages", async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const chatRoom = await ChatRoom.findOne({ transactionId });
    if (!chatRoom) {
      return res.status(404).json({ error: "Chat room not found" });
    }

    res.json(chatRoom.messages || []);
  } catch (err) {
    console.error("❌ Get chat messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ========================
// 🔌 Socket.IO Events
// ========================
io.on('connection', (socket) => {
  console.log(`👤 User connected: ${socket.id}`);

  // Join chat room
  socket.on('join-chat', async (data) => {
    const { transactionId, userId } = data;
    const roomName = `transaction-${transactionId}`;
    socket.join(roomName);
    
    // Update user online status
    await ChatRoom.findOneAndUpdate(
      { transactionId, 'participants.userId': userId },
      { 
        $set: { 
          'participants.$.isOnline': true,
          'participants.$.lastSeen': new Date()
        }
      }
    );
    
    socket.emit('joined-chat', { roomName, transactionId });
    console.log(`👥 User ${userId} joined chat for transaction ${transactionId}`);
  });

  // Send message
  socket.on('send-message', async (data) => {
    const { transactionId, senderId, senderUsername, content, type = 'text', locationData } = data;
    
    try {
      const chatRoom = await ChatRoom.findOne({ transactionId });
      if (!chatRoom) return;

      const message = {
        senderId,
        senderUsername,
        content,
        type,
        locationData,
        timestamp: new Date()
      };

      chatRoom.messages.push(message);
      chatRoom.lastMessageAt = new Date();
      await chatRoom.save();

      // Broadcast to room
      io.to(`transaction-${transactionId}`).emit('new-message', message);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Update location
  socket.on('update-location', async (data) => {
    const { transactionId, userId, coordinates } = data;
    
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) return;

      // Update user location in transaction
      if (transaction.sellerId === userId) {
        transaction.sellerLocation = {
          type: 'Point',
          coordinates,
          lastUpdated: new Date()
        };
      } else if (transaction.buyerId === userId) {
        transaction.buyerLocation = {
          type: 'Point',
          coordinates,
          lastUpdated: new Date()
        };
      }

      await transaction.save();

      // Broadcast location update
      io.to(`transaction-${transactionId}`).emit('location-updated', {
        userId,
        coordinates,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`👤 User disconnected: ${socket.id}`);
  });
});

// ========================
// 🚀 Start Server
// ========================
server.listen(port, () => {
  console.log(`🚀 FridgeShare backend running on port ${port} (Vision + Gemini + Auth + Socket.IO)`);
});
