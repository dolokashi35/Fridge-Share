const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 👇 works with AI Studio free-tier keys
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

    const result = await model.generateContent("Say 'Gemini is working!'");
    console.log("✅ Gemini reply:", result.response.text());
  } catch (err) {
    console.error("❌ Gemini test error:", err);
  }
}

testGemini();
