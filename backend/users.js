import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ✅ Define schema and model
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profile: {
    name: String,
    college: String,
  },
  averageRating: { type: Number, default: 0 }, // Average rating from all completed sales
  salesCount: { type: Number, default: 0 }, // Total number of items sold (public)
  purchaseCount: { type: Number, default: 0 }, // Total number of items purchased (private)
});

const User = mongoose.model("User", userSchema);

// ✅ Register route (only .edu emails)
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    // ✅ enforce .edu email format
    const eduRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.edu$/i;
    if (!eduRegex.test(username)) {
      return res
        .status(400)
        .json({ error: "Only .edu email addresses are allowed" });
    }

    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "Account already exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET);
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Login route (must still be .edu)
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const eduRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.edu$/i;

    if (!eduRegex.test(username)) {
      return res
        .status(400)
        .json({ error: "Only .edu email addresses can log in" });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET);
    res.json({ token, username: user.username, profile: user.profile });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Save or update profile
router.post("/profile", async (req, res) => {
  try {
    const { username, name, college } = req.body;

    if (!username || !name || !college)
      return res.status(400).json({ error: "Missing fields" });

    const user = await User.findOneAndUpdate(
      { username },
      { profile: { name, college } },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "Profile updated successfully", user });
  } catch (err) {
    console.error("❌ Profile update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get user stats (rating, sales count, and purchase count) - for current user (private)
router.get("/stats", auth, async (req, res) => {
  try {
    const username = req.user.username;
    const user = await User.findOne({ username }).select("username averageRating salesCount purchaseCount");
    
    if (!user) return res.status(404).json({ error: "User not found" });
    
    res.json({
      username: user.username,
      averageRating: user.averageRating || 0,
      salesCount: user.salesCount || 0,
      purchaseCount: user.purchaseCount || 0, // Private - only for current user
    });
  } catch (err) {
    console.error("❌ Get user stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get user stats by username (public endpoint for viewing seller profiles - only shows sales)
router.get("/stats/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select("username averageRating salesCount");
    
    if (!user) return res.status(404).json({ error: "User not found" });
    
    res.json({
      username: user.username,
      averageRating: user.averageRating || 0,
      salesCount: user.salesCount || 0, // Public - only sales count
    });
  } catch (err) {
    console.error("❌ Get user stats by username error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Auth middleware
export function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ✅ Export router + model
export { router, User };
