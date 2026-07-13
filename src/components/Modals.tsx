import React, { useState, useEffect } from "react";
import { 
  X, Plus, Trash2, Calendar, DollarSign, Users, Shield, 
  MapPin, Phone, MessageSquare, AlertTriangle, ArrowDown, ArrowUp, RefreshCcw, CheckCircle
} from "lucide-react";
import { db } from "../firebase";
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, 
  onSnapshot, query, orderBy, limit, setDoc, serverTimestamp, where
} from "firebase/firestore";
import { Product, Customer, Supplier, ShopSettings, Expense, Purchase, Payroll, Shift } from "../types";
import { THEMES, getTheme } from "../lib/theme";
import { translations, Language } from "../lib/translations";

interface ModalsProps {
  modalType: string;
  shopId: string;
  shopName: string;
  shopSettings: ShopSettings;
  allProducts: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  lang?: Language;
  onClose: () => void;
  onSettingsSaved: (settings: ShopSettings) => void;
}

export default function Modals({
  modalType,
  shopId,
  shopName,
  shopSettings,
  allProducts,
  customers,
  suppliers,
  lang = "en",
  onClose,
  onSettingsSaved,
}: ModalsProps) {
  const t = translations[lang];
  // Common loading states
  const [loading, setLoading] = useState(false);

  // --- Modal - Add Product State ---
  const [pName, setPName] = useState("");
  const [pCat, setPCat] = useState("");
  const [pSku, setPSku] = useState("");
  const [pCost, setPCost] = useState(0);
  const [pRetail, setPRetail] = useState(0);
  const [pWhole, setPWhole] = useState(0);
  const [pQty, setPQty] = useState(10);

  // --- Modal - Add Customer State ---
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");

  // --- Modal - Settings State ---
  const [sName, setSName] = useState(shopSettings.shopName || shopName);
  const [sPhone, setSPhone] = useState(shopSettings.phone || "");
  const [sAdd, setSAdd] = useState(shopSettings.address || "");
  const [sFoot, setSFoot] = useState(shopSettings.footer || "ကျေးဇူးတင်ပါသည်ခင်ဗျာ။");
  const [sTheme, setSTheme] = useState(shopSettings.theme || "cosmic-indigo");

  // --- Modal - Supplier add State ---
  const [suppName, setSuppName] = useState("");

  // --- Lists with dynamic subscription inside modal ---
  const [listData, setListData] = useState<any[]>([]);

  useEffect(() => {
    if (!shopId) return;

    let q;
    let unsub = () => {};

    if (modalType === "sales-list") {
      q = query(collection(db, "shops", shopId, "sales"), orderBy("createdAt", "desc"), limit(50));
      unsub = onSnapshot(q, (snap) => {
        const items: any[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        setListData(items);
      });
    } else if (modalType === "purchase-list") {
      q = query(collection(db, "shops", shopId, "purchases"), orderBy("date", "desc"));
      unsub = onSnapshot(q, (snap) => {
        const items: any[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        setListData(items);
      });
    } else if (modalType === "expenses") {
      q = query(collection(db, "shops", shopId, "expenses"), orderBy("date", "desc"));
      unsub = onSnapshot(q, (snap) => {
        const items: any[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        setListData(items);
      });
    } else if (modalType === "payroll") {
      q = query(collection(db, "shops", shopId, "payroll"), orderBy("date", "desc"));
      unsub = onSnapshot(q, (snap) => {
        const items: any[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        setListData(items);
      });
    } else if (modalType === "cod") {
      q = query(collection(db, "shops", shopId, "sales"), where("paymentMethod", "==", "COD"));
      unsub = onSnapshot(q, (snap) => {
        const items: any[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        // Sort manually by date since multiple filters can trigger firebase index requirement
        items.sort((a, b) => {
          const tA = a.createdAt?.toMillis() || 0;
          const tB = b.createdAt?.toMillis() || 0;
          return tB - tA;
        });
        setListData(items);
      });
    } else if (modalType === "shifts") {
      q = query(collection(db, "shops", shopId, "shifts"), orderBy("time", "desc"), limit(20));
      unsub = onSnapshot(q, (snap) => {
        const items: any[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
        setListData(items);
      });
    }

    return () => unsub();
  }, [shopId, modalType]);

  // --- Modal actions ---

  const handleSaveProduct = async () => {
    if (!pName || pRetail <= 0) {
      alert(lang === "my" ? "အမည်နှင့် လက်လီစျေးနှုန်း ဖြည့်စွက်ပေးပါ။" : "Item name and retail price are required.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "shops", shopId, "products"), {
        name: pName,
        category: pCat || "General",
        sku: pSku || "sku-" + Date.now().toString().slice(-6),
        costPrice: pCost || 0,
        retailPrice: pRetail,
        wholesalePrice: pWhole || pRetail,
        quantity: pQty || 0,
        lowStockThreshold: 5,
      });
      alert(lang === "my" ? "ကုန်ပစ္စည်းအသစ် ထည့်သွင်းပြီးပါပြီ။" : "Product added successfully!");
      onClose();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (!cName) {
      alert(lang === "my" ? "ဝယ်သူအမည် ဖြည့်စွက်ပေးပါ။" : "Customer name is required.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "shops", shopId, "customers"), {
        name: cName,
        phone: cPhone || "",
        points: 0,
        debt: 0,
      });
      alert(lang === "my" ? "ဝယ်သူအသစ် ထည့်သွင်းပြီးပါပြီ။" : "Customer registered successfully!");
      setCName("");
      setCPhone("");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!sName) return;
    setLoading(true);
    try {
      const payload: ShopSettings = {
        shopName: sName,
        footer: sFoot,
        phone: sPhone,
        address: sAdd,
        theme: sTheme,
      };
      await setDoc(doc(db, "shops", shopId, "settings", "general"), payload, { merge: true });
      onSettingsSaved(payload);
      alert(lang === "my" ? "စနစ် ဆက်တင်များအား သိမ်းဆည်းပြီးပါပြီ။" : "Store configuration saved successfully.");
      onClose();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!suppName) return;
    try {
      await addDoc(collection(db, "shops", shopId, "suppliers"), {
        name: suppName,
        debt: 0,
      });
      setSuppName("");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleAddExpense = async (desc: string, amount: number) => {
    if (!desc || amount <= 0) return;
    try {
      await addDoc(collection(db, "shops", shopId, "expenses"), {
        desc,
        amount,
        date: serverTimestamp(),
      });
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleAddPurchase = async (desc: string, amount: number) => {
    if (!desc || amount <= 0) return;
    try {
      await addDoc(collection(db, "shops", shopId, "purchases"), {
        desc,
        amount,
        date: serverTimestamp(),
      });
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleAddPayroll = async (name: string, amount: number) => {
    if (!name || amount <= 0) return;
    try {
      await addDoc(collection(db, "shops", shopId, "payroll"), {
        name,
        amount,
        date: serverTimestamp(),
      });
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleClockInOut = async (type: "in" | "out") => {
    try {
      await addDoc(collection(db, "shops", shopId, "shifts"), {
        userId: "staff",
        type,
        time: serverTimestamp(),
      });
      alert(type === "in" ? t.shiftsClockInSuccess : t.shiftsClockOutSuccess);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // Stock Adjust Action helper
  const [adjProdId, setAdjProdId] = useState("");
  const [adjQty, setAdjQty] = useState(0);
  const handleStockAdjustment = async () => {
    if (!adjProdId) return;
    try {
      await updateDoc(doc(db, "shops", shopId, "products", adjProdId), {
        quantity: adjQty,
      });
      alert(t.adjustSuccess);
      setAdjProdId("");
      setAdjQty(0);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // COD Collector Status Update
  const handleCollectCOD = async (saleId: string) => {
    if (window.confirm(lang === "my" ? "ငွေကောက်ခံရရှိပြီးကြောင်း သေချာပါသလား?" : "Are you sure you have collected this cash?")) {
      try {
        await updateDoc(doc(db, "shops", shopId, "sales", saleId), {
          codStatus: "Collected",
          collectedAt: serverTimestamp(),
        });
      } catch (e: any) {
        alert("Error: " + e.message);
      }
    }
  };

  const getModalTitle = () => {
    switch (modalType) {
      case "add-product": return lang === "my" ? "ကုန်ပစ္စည်းအသစ် ထည့်မည်" : "Add New Product";
      case "settings": return lang === "my" ? "စနစ် ဆက်တင်များ" : "System Settings";
      case "customers": return lang === "my" ? "ဝယ်သူများစာရင်း" : "Customers Directory";
      case "suppliers": return lang === "my" ? "ဆပ်ပလိုင်ယာများ" : "Suppliers";
      case "cod": return lang === "my" ? "COD ကောက်ခံရန်စာရင်း" : "COD Tracking";
      case "expenses": return lang === "my" ? "စရိတ်မှတ်တမ်း (Expenses)" : "Expenses Manager";
      case "purchase-list": return lang === "my" ? "ဝယ်ယူမှုမှတ်တမ်း (Purchases)" : "Purchases Manager";
      case "payroll": return lang === "my" ? "ဝန်ထမ်းလစာ (Payroll)" : "Payroll Manager";
      case "low-stock": return lang === "my" ? "လက်ကျန်နည်းသောအချက်ပေးမှု" : "Low Stock Alerts";
      case "stock-adjust": return lang === "my" ? "စတော့ချိန်ညှိမှု" : "Stock Adjustment";
      case "shifts": return lang === "my" ? "ဝန်ထမ်းအဝင်အထွက် မှတ်တမ်း" : "Staff Shift Logs";
      case "sales-list": return lang === "my" ? "ဘောက်ချာမှတ်တမ်းစာရင်း" : "Sales Records History";
      default: return modalType.replace("-", " ");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-md p-4 font-sans">
      <div className="bg-[#0a0a0a]/95 rounded-[2rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-white/5 flex flex-col relative">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-48 h-48 bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 bg-purple-500/10 blur-[60px] rounded-full pointer-events-none"></div>

        {/* Modal Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0 relative z-10">
          <h2 className="text-xl font-black text-white capitalize tracking-tight font-display">
            {getModalTitle()}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-full flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body scrollable */}
        <div className="p-6 overflow-y-auto flex-1 no-scrollbar space-y-4 relative z-10">
          {/* 1. Modal: Add Product */}
          {modalType === "add-product" && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{lang === "my" ? "ကုန်ပစ္စည်းအမည် *" : "Item Name *"}</label>
                <input
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder={lang === "my" ? "ကုန်ပစ္စည်းအမည်..." : "Item Name..."}
                  className="w-full p-4 bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.category}</label>
                  <input
                    type="text"
                    value={pCat}
                    onChange={(e) => setPCat(e.target.value)}
                    placeholder={lang === "my" ? "အုပ်စု..." : "Category..."}
                    className="w-full p-4 bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.barcodeSku}</label>
                  <input
                    type="text"
                    value={pSku}
                    onChange={(e) => setPSku(e.target.value)}
                    placeholder="SKU / Barcode..."
                    className="w-full p-4 bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.costPrice}</label>
                  <input
                    type="number"
                    value={pCost}
                    onChange={(e) => setPCost(parseFloat(e.target.value) || 0)}
                    className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.retailPrice}</label>
                  <input
                    type="number"
                    value={pRetail}
                    onChange={(e) => setPRetail(parseFloat(e.target.value) || 0)}
                    className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.wholesalePrice}</label>
                  <input
                    type="number"
                    value={pWhole}
                    onChange={(e) => setPWhole(parseFloat(e.target.value) || 0)}
                    className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.stockQty}</label>
                  <input
                    type="number"
                    value={pQty}
                    onChange={(e) => setPQty(parseInt(e.target.value) || 0)}
                    className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveProduct}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 text-white font-black py-4 rounded-2xl text-sm mt-4 transition active:scale-98 cursor-pointer"
              >
                {loading ? t.saving : t.save}
              </button>
            </div>
          )}

          {/* 2. Modal: System Settings */}
          {modalType === "settings" && (
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{lang === "my" ? "ဆိုင်အမည်" : "Store Name"}</label>
                <input
                  type="text"
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{lang === "my" ? "ဖုန်းနံပါတ်" : "Phone Number"}</label>
                <input
                  type="text"
                  value={sPhone}
                  onChange={(e) => setSPhone(e.target.value)}
                  className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{lang === "my" ? "လိပ်စာ" : "Address"}</label>
                <input
                  type="text"
                  value={sAdd}
                  onChange={(e) => setSAdd(e.target.value)}
                  className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{lang === "my" ? "Receipt Footer / စာတို" : "Receipt Footer"}</label>
                <input
                  type="text"
                  value={sFoot}
                  onChange={(e) => setSFoot(e.target.value)}
                  className="w-full p-4 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.themeLabel}</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.values(THEMES).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSTheme(t.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                        sTheme === t.id
                          ? "bg-white/10 border-indigo-500 shadow-md"
                          : "bg-white/5 border-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex gap-1 shrink-0">
                        <span className={`w-3.5 h-3.5 rounded-full block bg-gradient-to-r ${t.gradient}`}></span>
                      </div>
                      <span className="text-xs font-bold text-white font-display">
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 text-white font-black py-4 rounded-2xl text-sm mt-4 transition cursor-pointer"
              >
                {loading ? t.saving : t.save}
              </button>
            </div>
          )}

          {/* 3. Modal: Customers Management */}
          {modalType === "customers" && (
            <div className="space-y-6">
              {/* Add Customer Form */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider font-display">{t.addCustomer}</p>
                <input
                  type="text"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder={lang === "my" ? "အမည် *" : "Name *"}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500/50"
                />
                <input
                  type="text"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder={lang === "my" ? "ဖုန်းနံပါတ်" : "Phone Number"}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={handleSaveCustomer}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3 rounded-xl text-xs font-black hover:brightness-110 transition cursor-pointer"
                >
                  {lang === "my" ? "အသစ်ထည့်သွင်းမည်" : "Add Customer"}
                </button>
              </div>

              {/* Customers list */}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest font-display">{t.customersListLabel}</p>
                {customers.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center shadow-sm"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white font-display">{c.name}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold">{c.phone || (lang === "my" ? "ဖုန်းမရှိပါ" : "No Phone")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg border ${
                        c.debt > 0 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      }`}>
                        {c.debt > 0 ? (lang === "my" ? `${c.debt.toLocaleString()} Ks ကျန်` : `${c.debt.toLocaleString()} Ks Debt`) : t.noDebt}
                      </span>
                      {c.debt > 0 && (
                        <button
                          onClick={async () => {
                            if (window.confirm(lang === "my" ? "ကြွေးမြီအကြေရှင်းလင်းမည်မှာ သေချာပါသလား?" : "Are you sure you want to clear this debt?")) {
                              await updateDoc(doc(db, "shops", shopId, "customers", c.id), { debt: 0 });
                            }
                          }}
                          className="bg-white/10 text-white hover:bg-white/20 font-black text-[10px] px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer"
                        >
                          {t.clearDebt}
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (window.confirm(lang === "my" ? "ဖျက်ပစ်ရန် သေချာပါသလား?" : "Are you sure you want to delete?")) {
                            await deleteDoc(doc(db, "shops", shopId, "customers", c.id));
                          }
                        }}
                        className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Modal: Suppliers */}
          {modalType === "suppliers" && (
            <div className="space-y-6">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex gap-2">
                <input
                  type="text"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  placeholder={t.supplierName}
                  className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={handleAddSupplier}
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 rounded-xl text-xs font-black cursor-pointer"
                >
                  {lang === "my" ? "ထည့်မည်" : "Add"}
                </button>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar">
                {suppliers.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center shadow-sm"
                  >
                    <span className="font-bold text-sm text-white font-display">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                        {s.debt > 0 ? (lang === "my" ? `${s.debt.toLocaleString()} Ks ကြွေးကျန်` : `${s.debt.toLocaleString()} Ks Debt`) : (lang === "my" ? "ကြွေးမရှိပါ" : "No Debt")}
                      </span>
                      {s.debt > 0 && (
                        <button
                          onClick={async () => {
                            await updateDoc(doc(db, "shops", shopId, "suppliers", s.id), { debt: 0 });
                          }}
                          className="bg-white/10 text-white border border-white/10 text-[10px] px-2.5 py-1.5 rounded-lg font-bold cursor-pointer"
                        >
                          Pay
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (window.confirm(lang === "my" ? "ဖျက်ပစ်ရန် သေချာပါသလား?" : "Are you sure you want to delete?")) {
                            await deleteDoc(doc(db, "shops", shopId, "suppliers", s.id));
                          }
                        }}
                        className="text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Modal: COD Tracking */}
          {modalType === "cod" && (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                <p className="text-[10px] font-black text-amber-400 uppercase mb-1">{lang === "my" ? "စုစုပေါင်းကောက်ခံရန် COD" : "Total Pending COD"}</p>
                <p className="text-xl font-black text-amber-300 font-display">
                  {listData
                    .filter((s) => s.codStatus === "Pending")
                    .reduce((sum, s) => sum + (s.total || 0), 0)
                    .toLocaleString()}{" "}
                  Ks
                </p>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
                {listData.map((s) => {
                  const isPending = s.codStatus === "Pending";
                  const itemsStr = (s.items || []).map((i: any) => i.name).join(", ");
                  return (
                    <div
                      key={s.id}
                      className="bg-white/5 p-4 rounded-xl border border-white/5 shadow-sm flex justify-between items-center"
                    >
                      <div className="overflow-hidden mr-2">
                        <p className="font-bold text-xs text-slate-200 truncate font-display">{itemsStr || (lang === "my" ? "အမည်မသိ ပစ္စည်းများ" : "Unknown Items")}</p>
                        <p className="text-[9px] text-slate-500 font-semibold">
                          {s.createdAt?.toDate().toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-black text-sm text-indigo-400 font-display">
                          {(s.total || 0).toLocaleString()} Ks
                        </span>
                        {isPending ? (
                          <button
                            onClick={() => handleCollectCOD(s.id)}
                            className="bg-white/10 text-white hover:bg-white/20 px-3 py-1.5 rounded-xl text-[10px] font-black border border-white/10 transition cursor-pointer"
                          >
                            {lang === "my" ? "ငွေလက်ခံမည်" : "Collect Cash"}
                          </button>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-1 rounded">
                            {lang === "my" ? "ကောက်ယူပြီး" : "Collected"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Modal: Expenses / Finance logs entry */}
          {(modalType === "expenses" || modalType === "purchase-list" || modalType === "payroll") && (
            <FinanceManager
              type={modalType}
              items={listData}
              lang={lang}
              onAddItem={
                modalType === "expenses"
                  ? handleAddExpense
                  : modalType === "purchase-list"
                  ? handleAddPurchase
                  : handleAddPayroll
              }
              shopId={shopId}
            />
          )}

          {/* 7. Modal: Low Stock Alerts */}
          {modalType === "low-stock" && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar">
              {allProducts
                .filter((p) => p.quantity <= (p.lowStockThreshold || 5))
                .map((p) => (
                  <div
                    key={p.id}
                    className="bg-white/5 p-4 rounded-2xl border border-rose-500/20 flex justify-between items-center shadow-sm"
                  >
                    <div>
                      <b className="text-white text-sm font-display">{p.name}</b>
                      <p className="text-[10px] text-slate-500 font-bold">{lang === "my" ? "အုပ်စု: " : "Category: "}{p.category}</p>
                    </div>
                    <span className="text-rose-400 bg-rose-500/10 font-black border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-display">
                      {p.quantity} {lang === "my" ? "ခုကျန်" : " Left"}
                    </span>
                  </div>
                ))}
              {allProducts.filter((p) => p.quantity <= (p.lowStockThreshold || 5)).length === 0 && (
                <div className="text-center py-10 text-slate-500 font-bold">
                  {lang === "my" ? "လက်ကျန်နည်းသောပစ္စည်း မရှိပါ။" : "No low stock items."}
                </div>
              )}
            </div>
          )}

          {/* 8. Modal: Stock Adjustment */}
          {modalType === "stock-adjust" && (
            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3 shadow-inner">
                <select
                  value={adjProdId}
                  onChange={(e) => setAdjProdId(e.target.value)}
                  className="w-full p-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-xs font-bold text-white outline-none cursor-pointer"
                >
                  <option value="" className="text-slate-500">{t.selectProduct}</option>
                  {allProducts.map((p) => (
                    <option key={p.id} value={p.id} className="text-white bg-[#0a0a0a]">
                      {p.name} ({lang === "my" ? "လက်ရှိ" : "Current"}: {p.quantity}{lang === "my" ? "ခု" : " pcs"})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={adjQty}
                    onChange={(e) => setAdjQty(parseInt(e.target.value) || 0)}
                    placeholder={t.newQuantity}
                    className="flex-1 p-3 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-semibold outline-none"
                  />
                  <button
                    onClick={handleStockAdjustment}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black px-6 py-3 rounded-xl text-xs hover:brightness-110 transition cursor-pointer"
                  >
                    {t.adjustBtn}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 9. Modal: Shift logs */}
          {modalType === "shifts" && (
            <div className="space-y-4">
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={() => handleClockInOut("in")}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
                >
                  {t.shiftsClockIn}
                </button>
                <button
                  onClick={() => handleClockInOut("out")}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
                >
                  {t.shiftsClockOut}
                </button>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar">
                {listData.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white/5 p-3 border border-white/5 rounded-xl flex justify-between items-center"
                  >
                    <span
                      className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${
                        s.type === "in" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-slate-400 border border-white/10"
                      }`}
                    >
                      {s.type === "in" ? (lang === "my" ? "အလုပ်ဝင်" : "IN") : (lang === "my" ? "အလုပ်ထွက်" : "OUT")}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {s.time?.toDate().toLocaleString() || ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. Modal: Sales historical ledger overview */}
          {modalType === "sales-list" && (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
              {listData.map((s) => {
                const itemsStr = (s.items || []).map((i: any) => i.name).join(", ");
                return (
                  <div
                    key={s.id}
                    className="bg-white/5 p-4 rounded-xl border border-white/5 shadow-sm flex justify-between items-center hover:border-white/10 transition"
                  >
                    <div className="overflow-hidden mr-2">
                      <p className="font-bold text-xs text-slate-200 truncate font-display">{itemsStr || (lang === "my" ? "အမည်မသိ ပစ္စည်းများ" : "Unknown Items")}</p>
                      <p className="text-[10px] font-semibold text-slate-500 mt-1">
                        {s.createdAt?.toDate().toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-black text-sm text-white font-display">{(s.total || 0).toLocaleString()} Ks</p>
                        <span className="text-[9px] font-bold text-slate-400 bg-white/5 border border-white/10 px-1 rounded font-display">
                          {s.paymentMethod}
                        </span>
                      </div>
                      <button
                        onClick={async () => {
                          if (window.confirm(t.deleteVoucherConfirm)) {
                            await deleteDoc(doc(db, "shops", shopId, "sales", s.id));
                          }
                        }}
                        className="text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 p-2 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Modals helper: Finance Manager for Expenses, Payroll, Purchases */
interface FinanceProps {
  type: string;
  items: any[];
  lang?: Language;
  onAddItem: (desc: string, amount: number) => void;
  shopId: string;
}

function FinanceManager({ type, items, lang = "en", onAddItem, shopId }: FinanceProps) {
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState(0);

  const handleSubmit = () => {
    onAddItem(desc, amt);
    setDesc("");
    setAmt(0);
  };

  const titleStr = type === "expenses" 
    ? (lang === "my" ? "စရိတ် (Expenses)" : "Expenses") 
    : type === "payroll" 
    ? (lang === "my" ? "လစာပေးချေမှု (Payroll)" : "Payroll") 
    : (lang === "my" ? "ကုန်ပစ္စည်းဝယ်ယူမှု (Purchases)" : "Purchases");

  const placeholderStr = type === "expenses" 
    ? (lang === "my" ? "အကြောင်းအရာ..." : "Description...") 
    : type === "payroll" 
    ? (lang === "my" ? "ဝန်ထမ်းအမည်..." : "Employee Name...") 
    : (lang === "my" ? "ဝယ်ယူသည့်ပစ္စည်း..." : "Purchased Item...");

  return (
    <div className="space-y-6">
      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={placeholderStr}
          className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500/50"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={amt}
            onChange={(e) => setAmt(parseFloat(e.target.value) || 0)}
            placeholder={lang === "my" ? "ပမာဏ (Ks)" : "Amount (Ks)"}
            className="w-28 p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={handleSubmit}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 rounded-xl text-xs font-black transition cursor-pointer"
          >
            {lang === "my" ? "ပေါင်းမည်" : "Add"}
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar">
        {items.map((i) => (
          <div
            key={i.id}
            className="bg-white/5 p-4 rounded-xl border border-white/5 shadow-sm flex justify-between items-center"
          >
            <div>
              <p className="font-bold text-xs text-slate-200 font-display">{i.desc || i.name}</p>
              <p className="text-[9px] text-slate-500 font-semibold">
                {i.date?.toDate().toLocaleDateString() || ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black text-sm text-rose-400 font-display">
                {(i.amount || 0).toLocaleString()} Ks
              </span>
              <button
                onClick={async () => {
                  if (window.confirm(lang === "my" ? "အချက်အလက်ကို ဖျက်ပစ်ပါမည်လား?" : "Are you sure you want to delete this item?")) {
                    await deleteDoc(doc(db, "shops", shopId, type, i.id));
                  }
                }}
                className="text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
