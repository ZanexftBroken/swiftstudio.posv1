import React, { useState, useEffect, useMemo } from "react";
import { 
  Store, Settings, LogOut, ArrowLeft, Plus, Search, 
  Trash2, Layers, Landmark, BarChart3, Brain, LayoutDashboard, 
  ShoppingCart, Package, ListChecks, Users, HelpCircle, Truck, 
  Clock, DollarSign, ArrowUpRight
} from "lucide-react";
import { auth, db } from "./firebase";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, doc, getDoc, onSnapshot, query, orderBy, limit,
  where, getDocs, setDoc, serverTimestamp
} from "firebase/firestore";

import { Product, Customer, Supplier, ShopSettings } from "./types";
import { getTheme } from "./lib/theme";
import PosView from "./components/PosView";
import Modals from "./components/Modals";
import AiAnalyst from "./components/AiAnalyst";
import { translations, Language } from "./lib/translations";

export default function App() {
  // Authentication & session state
  const [user, setUser] = useState<any>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState("My Store");
  const [shopSettings, setShopSettings] = useState<ShopSettings>({
    shopName: "My Store",
    phone: "",
    address: "",
    footer: "Thank you!",
  });

  const theme = useMemo(() => getTheme(shopSettings.theme), [shopSettings.theme]);

  // Language localization state
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("lang");
    return (saved === "my" || saved === "en") ? saved : "en";
  });

  const t = translations[lang];

  // Login form state
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerShopName, setRegisterShopName] = useState("");

  // Router views
  const [currentView, setCurrentView] = useState<
    "dashboard" | "pos" | "products" | "reports" | "ai-analyst"
  >("dashboard");

  // Global collection states
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);

  // Modals controller
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Search in inventory
  const [invSearch, setInvSearch] = useState("");

  // Track held carts globally
  const [heldOrders, setHeldOrders] = useState<any[]>([]);

  // --- Auth State Listener ---
  useEffect(() => {
    // Check local storage master login override first
    const isMaster = localStorage.getItem("master_logged_in") === "true";
    if (isMaster) {
      setShopId("master_shop");
      setShopName("SWIFT POS");
      setUser({ uid: "master_user", email: "master@pos.local" });
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const emailPrefix = u.email ? u.email.split("@")[0].toLowerCase() : "";
        let userData: any = null;

        try {
          // 1. Try UID document
          const userDocRef = doc(db, "users", u.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            userData = userDoc.data();
          } else if (emailPrefix) {
            // 2. Try emailPrefix document ID
            const prefixDocRef = doc(db, "users", emailPrefix);
            const prefixDoc = await getDoc(prefixDocRef);
            if (prefixDoc.exists()) {
              userData = prefixDoc.data();
            } else {
              // 3. Query username == emailPrefix
              const q = query(collection(db, "users"), where("username", "==", emailPrefix));
              const querySnap = await getDocs(q);
              if (!querySnap.empty) {
                userData = querySnap.docs[0].data();
              }
            }
          }

          // 4. Auto-creation fallback for admin/Firebase-console created auth accounts
          if (!userData) {
            const newShopId = "shop_" + u.uid.substring(0, 8);
            userData = {
              shopId: newShopId,
              shopName: "My Store",
              username: emailPrefix || "user",
              role: "user",
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year default
              createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, "users", u.uid), userData);
            await setDoc(doc(db, "shops", newShopId), {
              shopName: "My Store",
              createdAt: serverTimestamp()
            });
            await setDoc(doc(db, "shops", newShopId, "settings", "general"), {
              shopName: "My Store",
              phone: "",
              address: "",
              footer: "Thank you!",
              theme: "cosmic-slate"
            });
          }

          // 5. Expiry Verification
          if (new Date() > new Date(userData.expiryDate)) {
            setLoginErr("လိုင်စင်သက်တမ်း ကုန်ဆုံးသွားပါပြီ။ ကျေးဇူးပြု၍ ဆက်သွယ်ပါ။ (Your license key has expired. Please contact support.)");
            signOut(auth);
            setUser(null);
            setShopId(null);
            return;
          }

          setShopId(userData.shopId);
          setShopName(userData.shopName || "My Store");
        } catch (error: any) {
          console.error("Auth bootstrap error:", error);
        }
      } else {
        setUser(null);
        setShopId(null);
      }
    });
    return () => unsub();
  }, []);

  // --- Store settings listener ---
  useEffect(() => {
    if (!shopId) return;
    const configRef = doc(db, "shops", shopId, "settings", "general");
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ShopSettings;
        setShopSettings(data);
        setShopName(data.shopName || shopName);
      }
    });
    return () => unsubscribe();
  }, [shopId]);

  // --- Real-time Data Listeners ---
  useEffect(() => {
    if (!shopId) return;

    // Listen products
    const prodQ = query(collection(db, "shops", shopId, "products"), orderBy("name"));
    const unsubProd = onSnapshot(prodQ, (snap) => {
      const items: Product[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(items);
    });

    // Listen customers
    const custQ = query(collection(db, "shops", shopId, "customers"), orderBy("name"));
    const unsubCust = onSnapshot(custQ, (snap) => {
      const items: Customer[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(items);
    });

    // Listen suppliers
    const suppQ = query(collection(db, "shops", shopId, "suppliers"), orderBy("name"));
    const unsubSupp = onSnapshot(suppQ, (snap) => {
      const items: Supplier[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(items);
    });

    // Listen sales
    const salesQ = query(collection(db, "shops", shopId, "sales"), orderBy("createdAt", "desc"), limit(100));
    const unsubSales = onSnapshot(salesQ, (snap) => {
      const items: any[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setSalesHistory(items);
    });

    // Listen expenses
    const expQ = query(collection(db, "shops", shopId, "expenses"));
    const unsubExp = onSnapshot(expQ, (snap) => {
      const items: any[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setExpenses(items);
    });

    // Listen purchases
    const purQ = query(collection(db, "shops", shopId, "purchases"));
    const unsubPur = onSnapshot(purQ, (snap) => {
      const items: any[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setPurchases(items);
    });

    // Listen payroll
    const payQ = query(collection(db, "shops", shopId, "payroll"));
    const unsubPay = onSnapshot(payQ, (snap) => {
      const items: any[] = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setPayroll(items);
    });

    return () => {
      unsubProd();
      unsubCust();
      unsubSupp();
      unsubSales();
      unsubExp();
      unsubPur();
      unsubPay();
    };
  }, [shopId]);

  // --- Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr("");
    setLoginLoading(true);

    if (loginUser.trim() === "master" && loginPass === "master123") {
      localStorage.setItem("master_logged_in", "true");
      setShopId("master_shop");
      setShopName("SWIFT POS");
      setUser({ uid: "master_user", email: "master@pos.local" });
      setLoginLoading(false);
      return;
    }

    try {
      const email = loginUser.trim().includes("@") 
        ? loginUser.trim() 
        : `${loginUser.trim()}@pos.local`;
      await signInWithEmailAndPassword(auth, email, loginPass);
    } catch (err: any) {
      console.error("Login failed:", err);
      setLoginErr(t.loginErr || "လော့ဂ်အင် အဆင်မပြေပါ။ အကောင့်အချက်အလက်များကို ပြန်စစ်ပါ။");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr("");
    setLoginLoading(true);

    const usernameTrimmed = loginUser.trim();
    if (!usernameTrimmed) {
      setLoginErr(lang === "my" ? "အသုံးပြုသူအမည် ဖြည့်စွက်ပေးပါ။" : "Username is required.");
      setLoginLoading(false);
      return;
    }
    if (loginPass.length < 6) {
      setLoginErr(lang === "my" ? "လျှို့ဝှက်နံပါတ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။" : "Password must be at least 6 characters.");
      setLoginLoading(false);
      return;
    }

    try {
      const email = usernameTrimmed.includes("@") 
        ? usernameTrimmed 
        : `${usernameTrimmed}@pos.local`;

      const userCredential = await createUserWithEmailAndPassword(auth, email, loginPass);
      const u = userCredential.user;
      
      const newShopId = "shop_" + u.uid.substring(0, 8);
      const chosenShopName = registerShopName.trim() || `${usernameTrimmed} Store`;

      const userData = {
        shopId: newShopId,
        shopName: chosenShopName,
        username: usernameTrimmed,
        role: "user",
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", u.uid), userData);
      await setDoc(doc(db, "shops", newShopId), {
        shopName: chosenShopName,
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, "shops", newShopId, "settings", "general"), {
        shopName: chosenShopName,
        phone: "",
        address: "",
        footer: "Thank you!",
        theme: "immersive-glass"
      });

      alert(t.registerSuccess || "Account registered successfully!");
      setIsRegisterMode(false);
    } catch (err: any) {
      console.error("Registration failed:", err);
      let errMsg = err.message;
      if (err.code === "auth/email-already-in-use") {
        errMsg = lang === "my" ? "ဤအသုံးပြုသူအမည်မှာ သုံးပြီးသားဖြစ်နေပါသည်။" : "This username is already taken.";
      } else if (err.code === "auth/weak-password") {
        errMsg = lang === "my" ? "လျှို့ဝှက်နံပါတ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။" : "Password must be at least 6 characters.";
      }
      setLoginErr(errMsg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("master_logged_in");
    signOut(auth);
    setUser(null);
    setShopId(null);
    setCurrentView("dashboard");
  };

  // --- Dashboard Real-time Stats Computations ---
  const dashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySales = salesHistory.filter((s) => {
      const date = s.createdAt?.toDate();
      return date && date >= today;
    });

    const revenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const count = todaySales.length;

    // COD Pending amount
    const codPendingAmount = salesHistory
      .filter((s) => s.paymentMethod === "COD" && s.codStatus === "Pending")
      .reduce((sum, s) => sum + (s.total || 0), 0);

    return {
      revenue,
      salesCount: count,
      codPendingAmount,
      customersCount: customers.length,
    };
  }, [salesHistory, customers]);

  // --- Reports Tab Computations ---
  const reportTotals = useMemo(() => {
    const totalRev = salesHistory.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalCost = salesHistory.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPayroll = payroll.reduce((sum, p) => sum + (p.amount || 0), 0);

    const netProfit = totalRev - totalCost - totalExpenses - totalPayroll;

    return {
      totalRev,
      totalCost,
      totalExpenses,
      totalPurchases,
      totalPayroll,
      netProfit,
    };
  }, [salesHistory, expenses, purchases, payroll]);

  const filteredInventoryProducts = useMemo(() => {
    if (!invSearch) return allProducts;
    const term = invSearch.toLowerCase();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    );
  }, [allProducts, invSearch]);

  const lowStockCount = useMemo(() => {
    return allProducts.filter((p) => p.quantity <= (p.lowStockThreshold || 5)).length;
  }, [allProducts]);

  // --- Auth Render fallback ---
  if (!user) {
    return (
      <div className="flex items-center justify-center h-[100vh] bg-[#050505] text-slate-200 relative overflow-hidden font-sans">
        {/* Background Glow Effect */}
        <div className="absolute top-0 right-0 -mr-40 -mt-40 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>

        {/* Floating Language Selector at Top Right */}
        <div className="absolute top-4 right-4 z-20 flex gap-1 bg-[#0a0a0a]/80 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => {
              setLang("en");
              localStorage.setItem("lang", "en");
            }}
            className={`px-3 py-1 text-xs font-black rounded-lg cursor-pointer transition ${
              lang === "en" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => {
              setLang("my");
              localStorage.setItem("lang", "my");
            }}
            className={`px-3 py-1 text-xs font-black rounded-lg cursor-pointer transition ${
              lang === "my" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            မြန်မာ
          </button>
        </div>

        <div className="w-full max-w-sm text-center bg-[#0a0a0a]/90 border border-white/5 p-8 rounded-[2rem] shadow-2xl relative z-10 backdrop-blur-md">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
            <Store className="text-white" size={40} />
          </div>
          <h2 className="text-3xl font-black mb-1 text-white tracking-tight font-display">
            {isRegisterMode ? (t.registerTitle || "Create Account") : t.loginTitle}
          </h2>
          <p className="text-slate-500 mb-8 text-[10px] font-black uppercase tracking-wider">
            {t.loginSubtitle}
          </p>
          <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.username}</label>
              <input
                type="text"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder={t.loginPlaceholder}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition text-sm font-semibold text-white placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.password}</label>
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition text-sm font-semibold text-white placeholder:text-slate-600"
              />
            </div>
            {isRegisterMode && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">{t.storeName} (Optional)</label>
                <input
                  type="text"
                  value={registerShopName}
                  onChange={(e) => setRegisterShopName(e.target.value)}
                  placeholder={lang === "my" ? "ဆိုင်အမည် (ဥပမာ- Kyaw Store)..." : "Store Name (e.g. Kyaw Store)..."}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition text-sm font-semibold text-white placeholder:text-slate-600"
                />
              </div>
            )}
            {loginErr && <p className="text-rose-500 text-xs font-bold mt-2">{loginErr}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 active:scale-95 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all text-sm mt-6 disabled:opacity-50 cursor-pointer"
            >
              {loginLoading ? (isRegisterMode ? t.signingUp : t.loggingIn) : (isRegisterMode ? t.signUp : t.login)}
            </button>
          </form>

          {/* Toggle Mode Button */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <button
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLoginErr("");
              }}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
            >
              {isRegisterMode ? t.haveAccount : t.noAccount}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme.bgOuter} h-[100vh] flex flex-col ${theme.isLight ? "text-slate-800" : "text-slate-200"} w-full relative overflow-hidden font-sans`}>
      {/* Background Glow Effect */}
      <div className={`absolute top-0 right-0 -mr-40 -mt-40 w-96 h-96 ${theme.glow1} blur-[120px] rounded-full pointer-events-none`}></div>
      <div className={`absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 ${theme.glow2} blur-[100px] rounded-full pointer-events-none`}></div>

      {/* Header bar */}
      {currentView !== "pos" && (
        <header className={`${theme.isLight ? "bg-slate-100/50" : "bg-black/20"} backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0 border-b ${theme.border} z-10 pt-safe`}>
          <div className="flex items-center gap-3">
            {currentView !== "dashboard" && (
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`w-10 h-10 ${theme.isLight ? "bg-slate-200/50 border-slate-300 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"} border rounded-full flex items-center justify-center shadow-sm hover:opacity-85 transition cursor-pointer`}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className={`${theme.textAccent} ${theme.bgAccent} border ${theme.borderAccent} p-2 rounded-xl`}>
              <Store size={22} />
            </div>
            <div>
              <h1 className={`font-black ${theme.isLight ? "text-slate-900" : "text-white"} text-base leading-tight tracking-tight font-display`}>
                {currentView === "dashboard" 
                  ? t.workspace 
                  : currentView === "products" 
                  ? t.products 
                  : currentView === "reports" 
                  ? t.salesSummary 
                  : currentView === "ai-analyst" 
                  ? t.aiAnalyst 
                  : currentView}
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">
                {shopName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Premium Language Pill Toggle */}
            <div className={`flex ${theme.isLight ? "bg-slate-200/50" : "bg-white/5"} p-1 rounded-full border ${theme.border} text-[10px] mr-1`}>
              <button
                onClick={() => {
                  setLang("en");
                  localStorage.setItem("lang", "en");
                }}
                className={`px-2.5 py-1 font-black rounded-full cursor-pointer transition-all ${
                  lang === "en" ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-400"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => {
                  setLang("my");
                  localStorage.setItem("lang", "my");
                }}
                className={`px-2.5 py-1 font-black rounded-full cursor-pointer transition-all ${
                  lang === "my" ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-400"
                }`}
              >
                MY
              </button>
            </div>

            <button
              onClick={() => setActiveModal("settings")}
              className={`w-10 h-10 ${theme.isLight ? "bg-slate-200/50 border-slate-300 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"} border rounded-full flex items-center justify-center shadow-sm hover:opacity-85 transition cursor-pointer`}
              title={t.systemSettings}
            >
              <Settings size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-400 shadow-sm hover:bg-rose-500/20 transition cursor-pointer"
              title={t.logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
      )}

      {/* Main View Router Content */}
      <main className="flex-1 overflow-hidden relative z-10">
        {/* VIEW 1: DASHBOARD */}
        {currentView === "dashboard" && (
          <div className="w-full h-full overflow-y-auto px-4 sm:px-6 pb-24 no-scrollbar space-y-6 pt-2">
            {/* Call to action POS banner */}
            <div className={`bg-gradient-to-br ${theme.gradient} rounded-[2rem] p-6 shadow-xl relative overflow-hidden text-white shrink-0`}>
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                <Store size={150} />
              </div>
              <div className="relative z-10">
                <h2 className="font-black text-2xl mb-1 font-display">{t.posBannerTitle}</h2>
                <p className="text-indigo-100 text-xs mb-5 font-semibold">{t.posBannerSub}</p>
                <button
                  onClick={() => setCurrentView("pos")}
                  className="bg-white text-black px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-white/10 hover:bg-indigo-50 transition active:scale-95 cursor-pointer"
                >
                  <ShoppingCart size={16} /> {t.posBannerBtn}
                </button>
              </div>
            </div>

            {/* Quick calculations panels */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`${theme.bgInner} p-4 rounded-[1.5rem] border ${theme.border} shadow-sm`}>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  {lang === "my" ? "ယနေ့အရောင်းအရေအတွက်" : "Today's Sales (Count)"}
                </p>
                <div className="flex items-end gap-1">
                  <h3 className={`text-2xl font-black ${theme.textAccent} font-display`}>{dashboardStats.salesCount}</h3>
                  <span className="text-[9px] font-bold text-slate-500 mb-1">{lang === "my" ? "ကြိမ်" : "times"}</span>
                </div>
              </div>
              <div className={`${theme.bgInner} p-4 rounded-[1.5rem] border ${theme.border} shadow-sm`}>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">{t.todaySales}</p>
                <div className="flex items-end gap-1 overflow-hidden">
                  <h3 className={`text-xl font-black ${theme.isLight ? "text-slate-800" : "text-white"} font-display truncate`}>
                    {dashboardStats.revenue.toLocaleString()}
                  </h3>
                  <span className="text-[9px] font-bold text-slate-500 mb-1">Ks</span>
                </div>
              </div>
              <div className={`${theme.bgInner} p-4 rounded-[1.5rem] border ${theme.border} shadow-sm`}>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">{t.codPending}</p>
                <div className="flex items-end gap-1">
                  <h3 className="text-xl font-black text-amber-500 font-display truncate">
                    {dashboardStats.codPendingAmount.toLocaleString()}
                  </h3>
                  <span className="text-[9px] font-bold text-slate-500 mb-1">Ks</span>
                </div>
              </div>
              <div className={`${theme.bgInner} p-4 rounded-[1.5rem] border ${theme.border} shadow-sm`}>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">{t.totalCustomers}</p>
                <h3 className={`text-2xl font-black ${theme.isLight ? "text-slate-800" : "text-white"} font-display`}>{dashboardStats.customersCount}</h3>
              </div>
            </div>

            {/* Quick operations panel */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{t.quickOps}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setCurrentView("pos")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm border ${theme.border} ${theme.borderHover} active:scale-95 transition cursor-pointer`}
                >
                  <div className={`${theme.textAccent} ${theme.bgAccent} w-12 h-12 rounded-xl flex items-center justify-center border ${theme.borderAccent}`}>
                    <ShoppingCart size={22} />
                  </div>
                  <span className={`text-[10px] font-black ${theme.isLight ? "text-slate-700" : "text-slate-300"} text-center`}>{t.newSale}</span>
                </button>

                <button
                  onClick={() => setActiveModal("sales-list")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm border ${theme.border} ${theme.borderHover} active:scale-95 transition cursor-pointer`}
                >
                  <div className={`${theme.isLight ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"} w-12 h-12 rounded-xl flex items-center justify-center border`}>
                    <ListChecks size={22} />
                  </div>
                  <span className={`text-[10px] font-black ${theme.isLight ? "text-slate-700" : "text-slate-300"} text-center`}>{t.salesRecords}</span>
                </button>

                <button
                  onClick={() => setActiveModal("purchase-list")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm border ${theme.border} ${theme.borderHover} active:scale-95 transition cursor-pointer`}
                >
                  <div className="bg-purple-500/10 text-purple-400 w-12 h-12 rounded-xl flex items-center justify-center border border-purple-500/20">
                    <Package size={22} />
                  </div>
                  <span className={`text-[10px] font-black ${theme.isLight ? "text-slate-700" : "text-slate-300"} text-center`}>{t.purchasedItems}</span>
                </button>

                <button
                  onClick={() => setActiveModal("cod")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm border ${theme.border} ${theme.borderHover} active:scale-95 transition cursor-pointer`}
                >
                  <div className="bg-amber-500/10 text-amber-400 w-12 h-12 rounded-xl flex items-center justify-center border border-amber-500/20">
                    <Truck size={22} />
                  </div>
                  <span className={`text-[10px] font-black ${theme.isLight ? "text-slate-700" : "text-slate-300"} text-center`}>{t.codTracking}</span>
                </button>
              </div>
            </div>

            {/* Other services buttons list */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{t.otherSecs}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setCurrentView("products")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex items-center gap-3 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/10">
                    <Package size={18} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? "text-slate-700" : "text-slate-300"}`}>{t.products}</span>
                </button>

                <button
                  onClick={() => setCurrentView("reports")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex items-center gap-3 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className={`${theme.textAccent} ${theme.bgAccent} p-2 rounded-xl border ${theme.borderAccent}`}>
                    <BarChart3 size={18} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? "text-slate-700" : "text-slate-300"}`}>{t.salesSummary}</span>
                </button>

                <button
                  onClick={() => setActiveModal("expenses")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex items-center gap-3 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className="bg-rose-500/10 text-rose-400 p-2 rounded-xl border border-rose-500/10">
                    <DollarSign size={18} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? "text-slate-700" : "text-slate-300"}`}>{t.generalExpenses}</span>
                </button>

                <button
                  onClick={() => setActiveModal("payroll")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex items-center gap-3 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className="bg-pink-500/10 text-pink-400 p-2 rounded-xl border border-pink-500/10">
                    <Users size={18} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? "text-slate-700" : "text-slate-300"}`}>{t.staffPayroll}</span>
                </button>

                <button
                  onClick={() => setActiveModal("customers")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex items-center gap-3 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className="bg-sky-500/10 text-sky-400 p-2 rounded-xl border border-sky-500/10">
                    <Users size={18} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? "text-slate-700" : "text-slate-300"}`}>{t.customersList}</span>
                </button>

                <button
                  onClick={() => setActiveModal("suppliers")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex items-center gap-3 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className="bg-amber-500/10 text-amber-400 p-2 rounded-xl border border-amber-500/10">
                    <Landmark size={18} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? "text-slate-700" : "text-slate-300"}`}>{t.suppliers}</span>
                </button>

                <button
                  onClick={() => setActiveModal("stock-adjust")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex items-center gap-3 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className={`${theme.textAccent} ${theme.bgAccent} p-2 rounded-xl border ${theme.borderAccent}`}>
                    <Package size={18} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? "text-slate-700" : "text-slate-300"}`}>{t.stockAdjust}</span>
                </button>

                <button
                  onClick={() => setActiveModal("shifts")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex items-center gap-3 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className="bg-teal-500/10 text-teal-400 p-2 rounded-xl border border-teal-500/10">
                    <Clock size={18} />
                  </div>
                  <span className={`text-xs font-bold ${theme.isLight ? "text-slate-700" : "text-slate-300"}`}>{t.staffAttendance}</span>
                </button>

                <button
                  onClick={() => setCurrentView("ai-analyst")}
                  className={`col-span-2 bg-gradient-to-r ${theme.gradientBtn} hover:brightness-110 rounded-2xl p-4 flex items-center gap-3 shadow-md text-white transition active:scale-98 cursor-pointer`}
                >
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Brain size={18} />
                  </div>
                  <span className="text-xs font-bold">{t.aiAnalyst}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: POS */}
        {currentView === "pos" && (
          <PosView
            allProducts={allProducts}
            shopId={shopId || ""}
            shopName={shopName}
            shopSettings={shopSettings}
            customers={customers}
            heldOrdersCount={heldOrders.length}
            lang={lang}
            onCheckoutSuccess={() => {}}
            onHoldOrder={(cart) => setHeldOrders((prev) => [...prev, cart])}
            onViewHeld={() => {
              if (heldOrders.length === 0) {
                alert(lang === "my" ? "ခေတ္တရပ်ဆိုင်းထားသည့် ဘောက်ချာ မရှိသေးပါ။" : "No held vouchers found.");
                return;
              }
              setActiveModal("sales-list");
            }}
            onClose={() => setCurrentView("dashboard")}
          />
        )}

        {/* VIEW 3: INVENTORY PRODUCTS LIST */}
        {currentView === "products" && (
          <div className="w-full h-full flex flex-col overflow-hidden relative z-10">
            {/* Filter toolbar */}
            <div className={`p-4 ${theme.isLight ? "bg-slate-100/50" : "bg-black/20"} backdrop-blur-md border-b ${theme.border} space-y-3 shadow-sm`}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className={`w-full pl-9 pr-4 py-3 bg-white/5 border ${theme.border} ${theme.isLight ? "text-slate-800" : "text-white"} rounded-xl text-xs font-semibold outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveModal("add-product")}
                  className={`flex-1 bg-gradient-to-r ${theme.gradientBtn} text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:brightness-110 transition cursor-pointer`}
                >
                  <Plus size={16} /> {t.addProduct}
                </button>
                {lowStockCount > 0 && (
                  <button
                    onClick={() => setActiveModal("low-stock")}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    {lang === "my" ? `လက်ကျန်နည်းပစ္စည်းများ (${lowStockCount})` : `Low Stock Items (${lowStockCount})`}
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-7xl mx-auto w-full">
                {filteredInventoryProducts.map((p) => {
                  const isLow = p.quantity <= (p.lowStockThreshold || 5);
                  return (
                    <div
                      key={p.id}
                      className={`${theme.bgInner} p-4 rounded-2xl border ${theme.border} shadow-sm flex items-center gap-4 ${theme.borderHover} transition-all`}
                    >
                      <div className="w-16 h-16 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center shrink-0">
                        <Layers size={24} className="text-slate-600" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-bold text-sm ${theme.isLight ? "text-slate-900" : "text-white"} truncate font-display`}>{p.name}</h4>
                          <span className={`${theme.textAccent} ${theme.bgAccent} border ${theme.borderAccent} px-2 py-0.5 rounded text-[8px] font-black uppercase`}>
                            {p.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold mb-1">SKU: {p.sku}</p>
                        <div className={`flex gap-4 text-xs font-semibold ${theme.isLight ? "text-slate-600" : "text-slate-400"}`}>
                          <span>{lang === "my" ? "လက်လီ: " : "Retail: "}<b className={`${theme.isLight ? "text-slate-800" : "text-slate-200"}`}>{p.retailPrice.toLocaleString()} Ks</b></span>
                          <span>{lang === "my" ? "လက်ကျန်: " : "Stock: "}<b className={isLow ? "text-rose-400 font-black" : `${theme.isLight ? "text-slate-800" : "text-slate-200"}`}>{p.quantity}{lang === "my" ? "ခု" : " pcs"}</b></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: REPORTS VIEW */}
        {currentView === "reports" && (
          <div className="w-full h-full flex flex-col overflow-hidden relative z-10">
            <div className="p-4 shrink-0 space-y-4 max-w-7xl mx-auto w-full">
              {/* Profit banner */}
              <div className={`${theme.bgInner} border ${theme.border} rounded-[1.5rem] p-5 shadow-sm`}>
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{t.netProfit}</p>
                <h2 className={`text-3xl font-black ${theme.textAccent} flex items-baseline gap-1 font-display`}>
                  {reportTotals.netProfit.toLocaleString()}{" "}
                  <span className="text-xs font-bold text-slate-500">Ks</span>
                </h2>
                <div className={`grid grid-cols-2 gap-4 border-t ${theme.border} mt-4 pt-4`}>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{t.totalRevenue}</p>
                    <p className={`text-sm font-black ${theme.isLight ? "text-slate-800" : "text-slate-200"} mt-0.5`}>
                      {reportTotals.totalRev.toLocaleString()} Ks
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{t.totalCost}</p>
                    <p className="text-sm font-black text-rose-400 mt-0.5">
                      {(reportTotals.totalCost + reportTotals.totalExpenses + reportTotals.totalPayroll).toLocaleString()} Ks
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Historic List */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 max-w-7xl mx-auto w-full no-scrollbar">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                {lang === "my" ? "မကြာမီက အရောင်းဘောက်ချာများ" : "Recent Sales Vouchers"}
              </h3>
              <div className="space-y-3">
                {salesHistory.slice(0, 30).map((s) => {
                  const itemsStr = (s.items || []).map((i: any) => i.name).join(", ");
                  return (
                    <div
                      key={s.id}
                      className={`${theme.bgInner} border ${theme.border} p-4 rounded-xl shadow-sm flex items-center justify-between ${theme.borderHover} transition-colors`}
                    >
                      <div className="overflow-hidden mr-2">
                        <b className={`text-xs font-bold ${theme.isLight ? "text-slate-800" : "text-slate-200"} block truncate`}>{itemsStr}</b>
                        <span className="text-[9px] text-slate-500 font-semibold">
                          {s.createdAt?.toDate().toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-black text-sm ${theme.textAccent} font-display`}>{(s.total || 0).toLocaleString()} Ks</p>
                        <span className={`text-[9px] font-semibold ${theme.isLight ? "text-slate-600 bg-slate-100 border-slate-200" : "text-slate-400 bg-white/5 border-white/5"} px-2 py-0.5 rounded-md uppercase tracking-wider block mt-0.5`}>
                          {s.paymentMethod}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: AI ANALYST VIEW */}
        {currentView === "ai-analyst" && (
          <AiAnalyst allProducts={allProducts} shopId={shopId || ""} />
        )}
      </main>

      {/* Persistent Bottom navigation for mobile screen layout */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/5 flex justify-around items-center px-2 py-2 pb-safe shadow-lg lg:hidden z-40">
        <button
          onClick={() => setCurrentView("dashboard")}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all cursor-pointer ${
            currentView === "dashboard" ? "text-indigo-400 bg-white/5" : "text-slate-500"
          }`}
        >
          <LayoutDashboard size={20} className="mb-0.5" />
          <span className="text-[9px] font-black">Home</span>
        </button>

        <button
          onClick={() => setCurrentView("pos")}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all cursor-pointer ${
            currentView === "pos" ? "text-indigo-400 bg-white/5" : "text-slate-500"
          }`}
        >
          <ShoppingCart size={20} className="mb-0.5" />
          <span className="text-[9px] font-black">POS</span>
        </button>

        <button
          onClick={() => setCurrentView("products")}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all cursor-pointer ${
            currentView === "products" ? "text-indigo-400 bg-white/5" : "text-slate-500"
          }`}
        >
          <Package size={20} className="mb-0.5" />
          <span className="text-[9px] font-black">Items</span>
        </button>

        <button
          onClick={() => setCurrentView("reports")}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all cursor-pointer ${
            currentView === "reports" ? "text-indigo-400 bg-white/5" : "text-slate-500"
          }`}
        >
          <BarChart3 size={20} className="mb-0.5" />
          <span className="text-[9px] font-black">Reports</span>
        </button>

        <button
          onClick={() => setCurrentView("ai-analyst")}
          className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all cursor-pointer ${
            currentView === "ai-analyst" ? "text-violet-400 bg-violet-500/10" : "text-slate-500"
          }`}
        >
          <Brain size={20} className="mb-0.5" />
          <span className="text-[9px] font-black">AI Analyst</span>
        </button>
      </nav>

      {/* Modal Controller Coordinator */}
      {activeModal && (
        <Modals
          modalType={activeModal}
          shopId={shopId || ""}
          shopName={shopName}
          shopSettings={shopSettings}
          allProducts={allProducts}
          customers={customers}
          suppliers={suppliers}
          lang={lang}
          onClose={() => setActiveModal(null)}
          onSettingsSaved={(newSettings) => setShopSettings(newSettings)}
        />
      )}
    </div>
  );
}
