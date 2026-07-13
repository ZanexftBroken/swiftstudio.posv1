import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API routes go FIRST
  app.post("/api/ai-analyst", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({
          error: "GEMINI_API_KEY is not configured in environment variables. Please configure it in Settings > Secrets."
        });
      }

      // Lazy initialization of Gemini client
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const formattedContext = JSON.stringify(context, null, 2);

      const systemInstruction = `You are "Swift POS AI Analyst", an expert business analyst and financial advisor for a retail store or enterprise.
The user is viewing their store management dashboard, which contains real-time inventory and financial transactions.
Your goal is to provide insightful, professional, and practical advice to help them grow their sales, optimize stock, and manage expenses.

Context about the store (inventory, sales, or financials):
${formattedContext}

Guidelines:
1. Speak in Burmese (မြန်မာဘာသာ) by default, as the store owners and staff are based in Myanmar. If the user asks a question in English, you can reply in English.
2. Keep your answers clear, concise, highly professional, encouraging, and structured (use bullet points where appropriate).
3. Be highly realistic and actionable. Suggest practical steps like "promote item X because stock is high and it sells well" or "reorder item Y because stock is below the threshold".
4. Do not mention any internal programming or database details.
5. If there is no context or the context is empty, politely ask them to log more sales or products to get better insights.`;

      // Smart fallback chain to handle high demand / 503 Service Unavailable errors
      const modelsToTry = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"];
      let response = null;
      let lastError = null;

      for (const model of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: model,
            contents: prompt || "ဆိုင်ရဲ့ လက်ရှိအခြေအနေကို သုံးသပ်ပေးပြီး လုပ်ငန်းတိုးတက်ဖို့ အကြံပြုချက်တချို့ ပေးပါခင်ဗျာ။",
            config: {
              systemInstruction: systemInstruction,
              temperature: 0.7,
            },
          });
          if (response && response.text) {
            console.log(`Successfully generated content using model: ${model}`);
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${model} failed or is currently busy. Trying next fallback... Error:`, err.message || err);
          lastError = err;
        }
      }

      if (!response || !response.text) {
        return res.status(503).json({
          error: "လက်ရှိတွင် AI ဆာဗာအားလုံး အလုပ်များနေပါသည်။ ခဏနေမှ ပြန်လည်ကြိုးစားပေးပါခင်ဗျာ။ (All models are currently experiencing high demand. Please try again in a few moments.)",
          details: lastError?.message || String(lastError)
        });
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "An error occurred while generating AI response." });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
