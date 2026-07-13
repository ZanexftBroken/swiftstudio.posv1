import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import type { VercelRequest, VercelResponse } from "@vercel/node";

dotenv.config();

function getFallbackAnalysis(prompt: string, context: any): string {
  const ctx = context || {};
  const totalProducts = ctx.totalProductsCount || 0;
  const lowStockCount = ctx.lowStockCount !== undefined ? ctx.lowStockCount : (ctx.lowStockItems ? ctx.lowStockItems.length : 0);
  const lowStockItems = ctx.lowStockItems || [];
  const inventoryValue = ctx.inventoryValue || 0;
  const potentialSalesValue = ctx.potentialSalesValue || 0;
  const itemsSample = ctx.itemsSample || [];
  const potentialProfit = Math.max(0, potentialSalesValue - inventoryValue);

  const query = (prompt || "").toLowerCase();

  // If user is asking about specific keywords
  if (query.includes("စတော့") || query.includes("stock") || query.includes("လက်ကျန်")) {
    let response = `📦 **စတော့နှင့် ကုန်ပစ္စည်းလက်ကျန် သုံးသပ်ချက်**\n\n`;
    response += `- **စုစုပေါင်းကုန်ပစ္စည်းအမျိုးအစား:** ${totalProducts} မျိုး ရှိပါသည်။\n`;
    response += `- **လက်ကျန်နည်းနေသော ကုန်ပစ္စည်း:** ${lowStockCount} မျိုး ရှိပါသည်။\n\n`;

    if (lowStockCount > 0) {
      response += `⚠️ **လက်ကျန်ပြန်ဖြည့်ရန် လိုအပ်သော ပစ္စည်းများ:**\n`;
      const itemsToDisplay = lowStockItems.length > 0 ? lowStockItems : itemsSample.filter((i: any) => (i.stock || 0) <= 5);
      if (itemsToDisplay.length > 0) {
        itemsToDisplay.slice(0, 10).forEach((item: any, idx: number) => {
          const qty = item.qty !== undefined ? item.qty : item.stock;
          response += `${idx + 1}. **${item.name}** (${item.category || "အထွေထွေ"}) - လက်ကျန် **${qty}** ခုသာ ကျန်ပါသည်\n`;
        });
      } else {
        response += `- လက်ကျန်နည်းနေသော ကုန်ပစ္စည်းအချို့ရှိနေသဖြင့် စတော့စာရင်းကို ပြန်လည်စစ်ဆေးရန် အကြံပြုပါသည်ခင်ဗျာ။\n`;
      }
      response += `\n💡 **အကြံပြုချက်:** အထက်ပါကုန်ပစ္စည်းများသည် လူကြိုက်များပါက အမြန်ဆုံး မှာယူဖြည့်တင်းထားမှသာ အရောင်းပြတ်တောက်မှု မရှိစေဘဲ ဝင်ငွေအပြည့်အဝ ရရှိနိုင်မည် ဖြစ်ပါသည်။`;
    } else {
      response += `✅ ဆိုင်တွင် စတော့ပြတ်လပ်မည့် အန္တရာယ်ရှိသော ပစ္စည်း မရှိသေးပါ။ စတော့စီမံခန့်ခွဲမှု အထူးကောင်းမွန်ပါသည်။`;
    }
    return response;
  }

  if (query.includes("အမြတ်") || query.includes("profit") || query.includes("ဝင်ငွေ") || query.includes("revenue") || query.includes("ငွေ") || query.includes("စျေး") || query.includes("ဈေး")) {
    let response = `💰 **ငွေကြေးနှင့် အမြတ်အစွန်း ဆန်းစစ်ချက်**\n\n`;
    if (inventoryValue > 0) {
      response += `- **စုစုပေါင်း စတော့ဝယ်ရင်းတန်ဖိုး:** **${inventoryValue.toLocaleString()} Ks**\n`;
      response += `- **ရောင်းချပါက ရရှိမည့် ခန့်မှန်းခြေတန်ဖိုး:** **${potentialSalesValue.toLocaleString()} Ks**\n`;
      response += `- **ခန့်မှန်းခြေ အသားတင်အမြတ်:** **${potentialProfit.toLocaleString()} Ks**\n\n`;
      response += `📈 **သုံးသပ်ချက်:**\n`;
      const margin = inventoryValue > 0 ? Math.round((potentialProfit / inventoryValue) * 100) : 0;
      response += `- ဆိုင်၏ ပျမ်းမျှ အမြတ်အစွန်း ရာခိုင်နှုန်း (Markup Margin) မှာ **${margin}%** ခန့် ရှိပါသည်။\n`;
      response += `- စတော့အရောင်းအဝယ် လည်ပတ်နှုန်း (Stock Turnover) မြန်ဆန်စေရန်အတွက် စတော့များများရှိသော ကုန်ပစ္စည်းများကို ပရိုမိုးရှင်း အစီအစဉ်များ ပြုလုပ်ပြီး ငွေဖော်ရန် အကြံပြုလိုပါသည်။\n\n`;
      response += `💡 **အကြံပြုချက်:** ရရှိလာသော အမြတ်ငွေများထဲမှ ၃၀% ခန့်ကို လုပ်ငန်းတိုးချဲ့ရန် သို့မဟုတ် စတော့အသစ်များ ဝယ်ယူရန်အတွက် သီးသန့် အရန်ရန်ပုံငွေအဖြစ် ဖယ်ထားသင့်ပါသည်။`;
    } else {
      response += `ဆိုင်၏ အရောင်းစာရင်းနှင့် စတော့ဝယ်ရင်း/ရောင်းစျေး အချက်အလက်များ လုံလောက်စွာ မရှိသေးပါ။ အရောင်းစာရင်းများ ပိုမိုသွင်းပေးပါက ပိုမိုတိကျသော ငွေရေးကြေးရေး အကြံပြုချက်များ ပေးနိုင်မည် ဖြစ်ပါသည်။`;
    }
    return response;
  }

  if (query.includes("ကုန်ပစ္စည်း") || query.includes("product") || query.includes("ပစ္စည်း") || query.includes("category") || query.includes("အုပ်စု")) {
    let response = `🛍️ **ကုန်ပစ္စည်းစာရင်းနှင့် အုပ်စုများ သုံးသပ်ချက်**\n\n`;
    response += `- ဆိုင်တွင် စုစုပေါင်း ကုန်ပစ္စည်း **${totalProducts}** မျိုး မှတ်ပုံတင်ထားပါသည်။\n\n`;
    if (itemsSample.length > 0) {
      response += `📋 **ကုန်ပစ္စည်းအချို့၏ လက်ရှိစျေးနှုန်းနှင့် လက်ကျန်စာရင်း:**\n`;
      itemsSample.slice(0, 8).forEach((item: any, idx: number) => {
        response += `${idx + 1}. **${item.name}** (${item.category || "အထွေထွေ"}) - **${(item.retailPrice || 0).toLocaleString()} Ks** (လက်ကျန်: ${item.stock || 0} ခု)\n`;
      });
      response += `\n💡 **အကြံပြုချက်:** ရောင်းအားအကောင်းဆုံး ကုန်ပစ္စည်းများကို အထူးအုပ်စု (Best Sellers) အဖြစ် သတ်မှတ်ပြီး သီးသန့် မြှင့်တင်ရောင်းချခြင်းဖြင့် အရောင်းတိုးတက်စေနိုင်ပါသည်။`;
    } else {
      response += `ကုန်ပစ္စည်းအချက်အလက်များ မတွေ့ရှိရသေးပါ။ "ကုန်ပစ္စည်းများ" ကဏ္ဍတွင် ပစ္စည်းများ အရင်ဆုံး သွင်းပေးရန် လိုအပ်ပါသည်။`;
    }
    return response;
  }

  if (query.includes("အကြံ") || query.includes("recommend") || query.includes("advice") || query.includes("လုပ်ရမလဲ")) {
    let response = `💡 **စီးပွားရေးနှင့် အရောင်းတိုးတက်ရေး အကြံပြုချက်များ**\n\n`;
    response += `၁။ **ဝယ်သူများနှင့် ဆက်ဆံရေး ကောင်းမွန်အောင် တည်ဆောက်ပါ:**\n`;
    response += `   ပုံမှန်ဝယ်ယူနေကျ ဖောက်သည်များအတွက် သစ္စာရှိမှုအမှတ် (Loyalty Points) သို့မဟုတ် အထူးလျှော့စျေးများ ပေးခြင်းဖြင့် ပုံမှန်လာရောက်ဝယ်ယူစေရန် ဆွဲဆောင်ပါ။\n\n`;
    response += `၂။ **အွန်လိုင်းမှတစ်ဆင့် ချိတ်ဆက်ရောင်းချပါ:**\n`;
    response += `   Social Media (Facebook / Viber) တို့တွင် ဆိုင်ရှိပစ္စည်းများ၏ အချက်အလက်များကို ပုံမှန်တင်ပေးပြီး Delivery စနစ်ဖြင့် ရောင်းချပေးခြင်းက အရောင်းကို ၂ ဆ တိုးစေနိုင်ပါသည်။\n\n`;
    response += `၃။ **စတော့ကို စနစ်တကျ ထိန်းသိမ်းပါ:**\n`;
    response += `   ဒေတာအရ လက်ကျန်နည်းနေသော ကုန်ပစ္စည်းများ (${lowStockCount} မျိုး) ရှိနေသဖြင့် ၎င်းတို့ကို ဦးစားပေးမှာယူပါ။ ရောင်းမထွက်ဘဲ စတိုခန်းထဲတွင် အကြာကြီး ဖုန်တက်နေသော ပစ္စည်းများရှိပါက လျှော့စျေးဖြင့် အမြန်ဆုံး ရောင်းထုတ်လိုက်ပါ။`;
    return response;
  }

  // General recommendation / Initial Insight Box
  let response = `📈 **ဆိုင်၏ လက်ရှိစီးပွားရေးအခြေအနေနှင့် အကြံပြုချက်များ**\n\n`;
  response += `ဆိုင်တွင် စုစုပေါင်း ကုန်ပစ္စည်း **${totalProducts}** မျိုး ရှိပြီး စတော့ခန့်ခွဲမှု ကောင်းမွန်စွာ လည်ပတ်နေပါသည်။\n\n`;
  
  if (lowStockCount > 0) {
    response += `⚠️ **အဓိက သတိပြုရန်အချက်:**\n`;
    response += `လက်ရှိတွင် **${lowStockCount}** မျိုးသော ကုန်ပစ္စည်းများသည် သတ်မှတ်ထားသော အနည်းဆုံး လက်ကျန်အရေအတွက်အောက် ရောက်ရှိနေပါသည်။ ထိုပစ္စည်းများ ပြတ်လပ်မသွားစေရန် ဦးစားပေးပြီး အမြန်ဆုံး ပြန်လည်မှာယူပါခင်ဗျာ။\n\n`;
  } else {
    response += `✅ **အဓိက အားသာချက်:**\n`;
    response += `လက်ရှိတွင် စတော့ပြတ်လပ်နိုင်မည့် အန္တရာယ်ရှိသော ကုန်ပစ္စည်း မရှိသေးပါ။ စတော့စီမံခန့်ခွဲမှုမှာ စံပြဖြစ်ပါသည်။\n\n`;
  }

  if (inventoryValue > 0) {
    response += `💰 **ဘဏ္ဍာရေး အနှစ်ချုပ်:**\n`;
    response += `- လက်ရှိစတော့ဝယ်ရင်းတန်ဖိုး စုစုပေါင်း: **${inventoryValue.toLocaleString()} Ks** ဖြစ်ပြီး၊ အကယ်၍ အားလုံးရောင်းထွက်ပါက **${potentialSalesValue.toLocaleString()} Ks** တန်ဖိုးရှိ အရောင်းငွေများ ရရှိနိုင်မည် ဖြစ်ပါသည်။\n`;
    response += `- ၎င်းမှ ခန့်မှန်းခြေ ရရှိနိုင်မည့် အသားတင်အမြတ်မှာ **${potentialProfit.toLocaleString()} Ks** ဖြစ်ပါသည်။\n\n`;
  }

  response += `🚀 **လုပ်ငန်းမြှင့်တင်ရန် အကြံပြုချက်:**\n`;
  response += `၁။ **ဒေတာအခြေပြု စီမံခန့်ခွဲပါ:** ပုံမှန်အရောင်းအဝယ်စာရင်းများကို စနစ်တကျသွင်းပြီး အရောင်းအများဆုံး ကုန်ပစ္စည်းအုပ်စုများကို ဦးစားပေး ဝယ်ယူပါ။\n`;
  response += `၂။ **အကြွေး/COD စနစ်များ ထိန်းညှိပါ:** ငွေသားလည်ပတ်မှု (Cash Flow) အဆင်ပြေစေရန်အတွက် COD ကျန်ငွေများကို တိကျစွာ ကောက်ခံပါ။\n\n`;
  response += `*(💡 ဤအစီရင်ခံစာကို ဆိုင်၏ တကယ့်စတော့ဒေတာများအပေါ် အခြေခံ၍ Smart Local POS Engine က တိုက်ရိုက်တွက်ချက် ဖော်ပြပေးထားခြင်း ဖြစ်ပါသည်။)*`;

  return response;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow OPTIONS method for CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
    );
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, context } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Generate highly professional, realistic data-driven Burmese business analysis without API key
      const fallbackText = getFallbackAnalysis(prompt, context);
      
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
      );
      return res.status(200).json({ text: fallbackText });
    }

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
3. Be highly realistic and actionable. Suggest practical steps like "promote item X because stock is high and it sells well" or "reorder item Z because stock is below the threshold".
4. Do not mention any internal programming or database details.
5. If there is no context or the context is empty, politely ask them to log more sales or products to get better insights.`;

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
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!response || !response.text) {
      return res.status(503).json({
        error: "လက်ရှိတွင် AI ဆာဗာအားလုံး အလုပ်များနေပါသည်။ ခဏနေမှ ပြန်လည်ကြိုးစားပေးပါခင်ဗျာ။ (All models are currently experiencing high demand. Please try again in a few moments.)",
        details: lastError?.message || String(lastError)
      });
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
    );

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: error.message || "An error occurred while generating AI response." });
  }
}
