
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

// Google Cloud Vision setup
const vision = require("@google-cloud/vision");
const visionClient = new vision.ImageAnnotatorClient();

// Add fetch for Gemini API
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({ dest: "uploads/" });

const { router: userRouter, auth, users } = require('./users');
app.use(userRouter);

app.post("/recognize", upload.single("image"), async (req, res) => {
  console.log("/recognize endpoint hit");
  console.log("Request body:", req.body);
  try {
    let itemName = null;
    let quantity = 1;
    // If itemName is sent in the body (JSON or urlencoded), use it directly
    if (req.body && req.body.itemName) {
      itemName = req.body.itemName;
      console.log("Using confirmed item name from frontend:", itemName);
      if (req.body.quantity) {
        quantity = parseFloat(req.body.quantity) || 1;
      }
    } else if (req.file) {
      // Otherwise, use Vision to detect the item
      console.log("Received file:", req.file.originalname, req.file.mimetype, req.file.size, "bytes");
      const filePath = req.file.path;
      const [result] = await visionClient.labelDetection(filePath);
      const labels = result.labelAnnotations;
      itemName = labels && labels.length > 0 ? labels[0].description : "Unknown food";
      console.log("Vision top label:", itemName);
      fs.unlinkSync(filePath);
    } else {
      console.log("No image or item name provided");
      return res.status(400).json({ error: "No image or item name provided" });
    }

    // Mock market price lookup (replace with real API if available)
    function getMarketPrice(item) {
      // Simple mock prices
      const prices = {
        banana: 0.5,
        apple: 0.7,
        bread: 2.5,
        milk: 3.0,
        egg: 0.2,
        rice: 1.0,
        chicken: 5.0,
        beef: 7.0,
        cheese: 4.0
      };
      const key = item.toLowerCase().split(' ')[0];
      return prices[key] || 2.0; // default price
    }

    // Generate AI description (Gemini API)
    const geminiApiKey = process.env.GEMINI_API_KEY;
    let price = '';
    let description = '';
    let aiText = '';
    if (geminiApiKey) {
      const prompt = `Write a 1-sentence description for selling this food item: ${itemName}`;
      const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-002:generateContent?key=' + geminiApiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const geminiData = await geminiRes.json();
      console.log("Gemini API raw response:", JSON.stringify(geminiData, null, 2));
      aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      description = aiText;
    } else {
      description = `A fresh and delicious ${itemName}.`;
    }

    // Calculate price: market price * quantity * 0.5 (50% discount)
    const marketPrice = getMarketPrice(itemName);
    const totalPrice = (marketPrice * quantity * 0.5).toFixed(2);
    price = `$${totalPrice}`;

    res.json({
      item: itemName,
      description,
      price,
      raw_ai: aiText
    });
  } catch (err) {
    console.error('Recognition error:', err && err.response ? err.response.data : err);
    res.status(500).json({ error: "Recognition failed", details: err && err.message ? err.message : String(err) });
  }
});

// In-memory messages store
const messages = [];

// Messaging endpoints
// Send a message
app.post('/api/messages', auth, (req, res) => {
  const { to, content } = req.body;
  if (!to || !content) {
    return res.status(400).json({ error: 'Recipient and content required' });
  }
  const message = {
    id: uuidv4(),
    from: req.user.username,
    to,
    content,
    timestamp: new Date().toISOString(),
  };
  messages.push(message);
  res.status(201).json({ message: 'Message sent', data: message });
});

// Get messages for logged-in user (inbox)
app.get('/api/messages', auth, (req, res) => {
  const user = req.user.username;
  const userMessages = messages.filter(
    (msg) => msg.to === user || msg.from === user
  );
  res.json({ messages: userMessages });
});

app.listen(3001, () => {
  console.log("Backend listening on port 3001");
});
// In-memory store for posted items
const postedItems = [];

// Endpoint to post a new item
app.post('/items', auth, (req, res) => {
  const item = req.body;
  item.id = Date.now();
  // Ensure price is a number
  if (typeof item.price === 'string') {
    item.price = parseFloat(item.price.replace('$',''));
  }
  // Attach user info
  item.userId = req.user.id;
  item.username = req.user.username;
  postedItems.push(item);
  res.json({ success: true, item });
});


// Endpoint to get all posted items
app.get('/items', (req, res) => {
  res.json(postedItems);
});

// Endpoint to get a single item by id
app.get('/items/:id', (req, res) => {
  const id = req.params.id;
  const item = postedItems.find(it => String(it.id) === String(id));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});