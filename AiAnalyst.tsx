import React, { useState, useEffect, useRef } from "react";
import { Brain, Send, Sparkles, AlertCircle } from "lucide-react";
import { Product, ChatMessage } from "../types";

interface AiAnalystProps {
  allProducts: Product[];
  shopId: string;
}

export default function AiAnalyst({ allProducts, shopId }: AiAnalystProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "ai",
      text: "မင်္ဂလာပါဗျာ၊ ကျွန်တော်က Swift POS ရဲ့ AI Analyst ဖြစ်ပါတယ်။ ဆိုင်ရဲ့ ဝင်ငွေ၊ ထွက်ငွေ၊ စတော့ အခြေအနေတွေနဲ့ ပတ်သက်ပြီး ဘာများ ကူညီပေးရမလဲခင်ဗျာ။",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [staticInsight, setStaticInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to chat end
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate initial insights based on products
  const generateStaticInsights = async () => {
    if (allProducts.length === 0) {
      setStaticInsight("Data လုံလောက်မှု မရှိသေးပါ။ အရောင်းစာရင်းများ သို့မဟုတ် ကုန်ပစ္စည်းစာရင်းများ ပိုမိုသွင်းပေးရန် လိုအပ်သည်။");
      return;
    }

    setInsightLoading(true);
    try {
      const lowStockProducts = allProducts.filter(
        (p) => p.quantity <= (p.lowStockThreshold || 5)
      );

      const contextData = {
        totalProductsCount: allProducts.length,
        lowStockItems: lowStockProducts.map((p) => ({
          name: p.name,
          qty: p.quantity,
          category: p.category,
        })),
        inventoryValue: allProducts.reduce((sum, p) => sum + p.quantity * p.costPrice, 0),
        potentialSalesValue: allProducts.reduce((sum, p) => sum + p.quantity * p.retailPrice, 0),
      };

      const res = await fetch("/api/ai-analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "ဆိုင်ရဲ့ လက်ရှိစတော့အခြေအနေ (Low stock, potential values) ကိုကြည့်ပြီး ဆိုင်ရှင်အတွက် အရေးကြီးဆုံး စီးပွားရေးအကြံပြုချက် ၃ ချက်ကို အကျဉ်းချုပ်ပြီး မြန်မာလို ရေးပေးပါ။",
          context: contextData,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setStaticInsight(`အချက်အလက် မရယူနိုင်ပါ- ${data.error}`);
      } else {
        setStaticInsight(data.text || "အကြံပြုချက် မထွက်ပေါ်လာပါ။");
      }
    } catch (e: any) {
      setStaticInsight("အချက်အလက်များ သုံးသပ်ရန် အမှားအယွင်းရှိနေပါသည်။");
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    if (allProducts.length > 0) {
      generateStaticInsights();
    }
  }, [allProducts.length]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    // Add user message
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInputValue("");
    setLoading(true);

    try {
      const lowStock = allProducts.filter(p => p.quantity <= (p.lowStockThreshold || 5));
      const contextData = {
        lowStockCount: lowStock.length,
        totalProductsCount: allProducts.length,
        itemsSample: allProducts.slice(0, 15).map(p => ({
          name: p.name,
          category: p.category,
          stock: p.quantity,
          retailPrice: p.retailPrice
        }))
      };

      const res = await fetch("/api/ai-analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          context: contextData,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: `Error: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: data.text || "နားမလည်နိုင်သော အဖြေတစ်ခု ဖြစ်ပေါ်လာသည်။" },
        ]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "တောင်းပန်ပါတယ်ခင်ဗျာ၊ ဆာဗာနှင့် ချိတ်ဆက်မှု အဆင်မပြေဖြစ်သွားလို့ပါ။ ခဏနေမှ ထပ်ကြိုးစားကြည့်ပေးပါ။" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 p-4 sm:p-6 pb-24 overflow-y-auto h-full no-scrollbar relative z-10 font-sans text-slate-200">
      {/* Background Glows */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-purple-500/5 blur-[100px] rounded-full pointer-events-none"></div>

      {/* AI Header Banner */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] p-6 shadow-xl text-white relative overflow-hidden shrink-0">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
          <Brain size={150} />
        </div>
        <div className="relative z-10">
          <h2 className="font-black text-2xl mb-1 flex items-center gap-2 font-display">
            <Sparkles className="text-amber-300 animate-pulse" size={24} />
            AI Business Analyst
          </h2>
          <p className="text-violet-100 text-sm font-medium">
            ဆိုင်ရဲ့ စတော့တွေနဲ့ ကုန်ပစ္စည်းဒေတာတွေကို အခြေခံပြီး စီးပွားရေးအကြံပြုချက်များ တောင်းဆိုပါ။
          </p>
        </div>
      </div>

      {/* Static Insights Box */}
      <div className="bg-[#0a0a0a]/80 backdrop-blur-md p-5 rounded-[1.5rem] border border-white/5 shadow-sm space-y-3 shrink-0">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-display">
            <Sparkles className="text-indigo-400" size={14} /> Smart Insights
          </h3>
          <button
            onClick={generateStaticInsights}
            disabled={insightLoading}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition cursor-pointer"
          >
            {insightLoading ? "အသစ်ပြန်လုပ်နေသည်..." : "ပြန်လည်သုံးသပ်မည်"}
          </button>
        </div>
        <div className="text-sm font-medium text-slate-200 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/10 min-h-[60px] whitespace-pre-wrap">
          {insightLoading ? (
            <div className="flex items-center gap-2 text-slate-400 animate-pulse">
              <Sparkles size={16} className="animate-spin text-indigo-400" />
              စတော့ဒေတာများကို AI ဖြင့် ခွဲခြမ်းစိတ်ဖြာနေသည်...
            </div>
          ) : (
            staticInsight
          )}
        </div>
      </div>

      {/* Chat Section */}
      <div className="bg-[#0a0a0a]/80 backdrop-blur-md flex-1 p-4 rounded-[1.5rem] border border-white/5 shadow-sm flex flex-col min-h-[350px] overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-3 p-2 no-scrollbar text-sm min-h-0">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-2xl max-w-[80%] w-fit leading-relaxed ${
                m.sender === "user"
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white ml-auto shadow-md shadow-indigo-500/10"
                  : "bg-white/5 text-slate-200 border border-white/5"
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="bg-white/5 text-slate-400 p-3.5 rounded-2xl max-w-[80%] w-fit italic border border-white/5 flex items-center gap-2">
              <Sparkles className="animate-spin text-indigo-400" size={16} />
              AI စဉ်းစားနေသည်...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="flex gap-2 mt-3 border-t border-white/5 pt-3 shrink-0">
          <input
            id="ai-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="AI ဆီ အရောင်းနှင့်စတော့အကြောင်း မေးမြန်းပါ..."
            className="flex-1 p-3.5 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600"
          />
          <button
            onClick={handleSend}
            disabled={loading || !inputValue.trim()}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 disabled:opacity-50 text-white px-5 py-3.5 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
