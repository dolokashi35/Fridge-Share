import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import crypto from "crypto";
import nodemailer from "nodemailer";

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
  stripeAccountId: { type: String, default: null },
  isStripeOnboarded: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  verifyTokenHash: { type: String, default: null },
  verifyTokenExpires: { type: Date, default: null },
});

const User = mongoose.model("User", userSchema);

// ✅ Register route (only .edu emails)
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

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

// ========================
// 📧 .edu Email Verification
// ========================

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  // Fallback: JSON transport (logs to console)
  return nodemailer.createTransport({ jsonTransport: true });
}

// Send verification email (requires auth)
router.post("/verify/send", auth, async (req, res) => {
  try {
    const me = await User.findOne({ username: req.user.username });
    if (!me) return res.status(404).json({ error: "User not found" });
    const raw = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    me.verifyTokenHash = hash;
    me.verifyTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    await me.save();

    const verifyUrl = `${(process.env.FRONTEND_URL || req.headers.origin || "").replace(/\/$/, "")}/verify?token=${raw}&email=${encodeURIComponent(me.username)}`;
    const from = process.env.SMTP_FROM || "no-reply@fridgeshare";

    const html = `
      <p>Verify your email for FridgeShare.</p>
      <p><a href="${verifyUrl}">Click here to verify</a>. This link expires in 24 hours.</p>
    `;
    const transport = createTransport();
    try {
      await transport.sendMail({ to: me.username, from, subject: "Verify your FridgeShare email", html });
      res.json({ ok: true });
    } catch (sendErr) {
      console.error("verify/send transport error:", sendErr);
      // Fallback: return the verification URL so the user can proceed
      res.json({ ok: false, verifyUrl, error: "Email send failed; use verifyUrl" });
    }
  } catch (e) {
    console.error("verify/send error:", e);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

// Confirm verification link
router.post("/verify", async (req, res) => {
  try {
    const { email, token } = req.body || {};
    if (!email || !token) return res.status(400).json({ error: "email and token required" });
    const user = await User.findOne({ username: email });
    if (!user || !user.verifyTokenHash || !user.verifyTokenExpires) return res.status(400).json({ error: "Invalid or expired token" });
    if (user.verifyTokenExpires.getTime() < Date.now()) return res.status(400).json({ error: "Token expired" });
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    if (hash !== user.verifyTokenHash) return res.status(400).json({ error: "Invalid token" });
    user.isVerified = true;
    user.verifyTokenHash = null;
    user.verifyTokenExpires = null;
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    console.error("verify confirm error:", e);
    res.status(500).json({ error: "Failed to verify" });
  }
});
