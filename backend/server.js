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
import { router as userRouter } from "./users.js"; // ✅ Import user routes
import Item from "./models/Item.js"; // ✅ Import Item model
import Transaction from "./models/Transaction.js";
import ChatRoom from "./models/ChatRoom.js";

dotenv.config();
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://fridgeshare.vercel.app", "http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  }
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
    let description = "";
    
    // If we have detected text, use AI to create a smart description
    if (detectedText && detectedText.trim().length > 0) {
      const prompt = `Create a marketplace description for "${itemName}" using this product information: "${detectedText}"

Requirements:
- Use specific details from the text (brand, nutrition facts, features)
- Keep under 80 characters
- Be factual and appealing
- Mention key selling points

Examples:
- "Zero sugar, 15g protein. Need gone by weekend."
- "Organic brand, good condition. Moving out."
- "Fresh, expires next week. Don't need anymore."

Return JSON: { "description": "string" }`;

      try {
        const response = await geminiModel.generateContent(prompt);
        const geminiText = response.response.text();
        const jsonMatch = geminiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiResult = JSON.parse(jsonMatch[0]);
          description = aiResult.description || "";
        }
      } catch (e) {
        console.warn("⚠️ AI description generation failed, using fallback");
      }
    }
    
    // Fallback to simple templates if no text or AI fails
    if (!description) {
      const templates = [
        "Good condition. Need gone by weekend.",
        "Fresh. Bought too many.",
        "Expires next week.",
        "Good quality. Moving out.",
        "Fresh. Don't need anymore.",
        "Good condition. Going home for break."
      ];
      description = templates[Math.floor(Math.random() * templates.length)];
    }
    
    const json = { description };
    
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
app.get("/api/items/nearby", async (req, res) => {
  const { lat, lng, radius = 5000 } = req.query; // radius in meters
  
  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing latitude or longitude" });
  }

  try {
    const items = await Item.find({
      status: "active",
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
