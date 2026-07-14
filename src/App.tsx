import React, { useState, useEffect, useMemo } from "react";
import { 
  Store, Settings, LogOut, ArrowLeft, Plus, Search, 
  Trash2, Layers, Landmark, BarChart3, Brain, LayoutDashboard, 
  ShoppingCart, Package, ListChecks, Users, HelpCircle, Truck, 
  Clock, DollarSign, ArrowUpRight, TrendingUp, Award, Percent, Calendar
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
import MasterAdminPanel from "./components/MasterAdminPanel";
import { translations, Language } from "./lib/translations";
import { motion } from "motion/react";

export default function App() {
  // Authentication & session state
  const [user, setUser] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
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

  // Report active date filter
  const [reportPeriod, setReportPeriod] = useState<"today" | "yesterday" | "week" | "month" | "all">("all");

  // Track held carts globally
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // --- Auth State Listener ---
  useEffect(() => {
    // Check local storage master login override first
    const isMaster = localStorage.getItem("master_logged_in") === "true";
    if (isMaster) {
      setShopId("master_shop");
      setShopName("SWIFT POS");
      setUser({ uid: "master_user", email: "master@pos.local" });
      setCurrentUserData({
        shopId: "master_shop",
        shopName: "SWIFT POS",
        username: "master",
        role: "admin",
        expiryDate: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      });
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
              expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days trial default
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
            setCurrentUserData(null);
            return;
          }

          setShopId(userData.shopId);
          setShopName(userData.shopName || "My Store");
          setCurrentUserData(userData);
        } catch (error: any) {
          console.error("Auth bootstrap error:", error);
        }
      } else {
        setUser(null);
        setShopId(null);
        setCurrentUserData(null);
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
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days free trial default
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
    setCurrentUserData(null);
    setCurrentView("dashboard");
  };

  const licenseDaysLeft = useMemo(() => {
    if (!currentUserData || !currentUserData.expiryDate) return null;
    const diff = new Date(currentUserData.expiryDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [currentUserData]);

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
  const filteredSalesForReport = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return salesHistory.filter((s) => {
      if (!s.createdAt) return false;
      const sDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      
      if (reportPeriod === "today") {
        return sDate >= startOfToday;
      } else if (reportPeriod === "yesterday") {
        return sDate >= startOfYesterday && sDate < startOfToday;
      } else if (reportPeriod === "week") {
        return sDate >= startOfWeek;
      } else if (reportPeriod === "month") {
        return sDate >= startOfMonth;
      }
      return true; // "all"
    });
  }, [salesHistory, reportPeriod]);

  const filteredExpensesForReport = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return expenses.filter((e) => {
      if (!e.createdAt) return true;
      const eDate = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
      if (reportPeriod === "today") return eDate >= startOfToday;
      if (reportPeriod === "yesterday") return eDate >= startOfYesterday && eDate < startOfToday;
      if (reportPeriod === "week") return eDate >= startOfWeek;
      if (reportPeriod === "month") return eDate >= startOfMonth;
      return true;
    });
  }, [expenses, reportPeriod]);

  const filteredPurchasesForReport = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return purchases.filter((p) => {
      if (!p.createdAt) return true;
      const pDate = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      if (reportPeriod === "today") return pDate >= startOfToday;
      if (reportPeriod === "yesterday") return pDate >= startOfYesterday && pDate < startOfToday;
      if (reportPeriod === "week") return pDate >= startOfWeek;
      if (reportPeriod === "month") return pDate >= startOfMonth;
      return true;
    });
  }, [purchases, reportPeriod]);

  const filteredPayrollForReport = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return payroll.filter((p) => {
      if (!p.createdAt) return true;
      const pDate = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      if (reportPeriod === "today") return pDate >= startOfToday;
      if (reportPeriod === "yesterday") return pDate >= startOfYesterday && pDate < startOfToday;
      if (reportPeriod === "week") return pDate >= startOfWeek;
      if (reportPeriod === "month") return pDate >= startOfMonth;
      return true;
    });
  }, [payroll, reportPeriod]);

  const reportTotals = useMemo(() => {
    const totalRev = filteredSalesForReport.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalCost = filteredSalesForReport.reduce((sum, s) => sum + (s.totalCost || 0), 0);
    const totalExpenses = filteredExpensesForReport.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPurchases = filteredPurchasesForReport.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPayroll = filteredPayrollForReport.reduce((sum, p) => sum + (p.amount || 0), 0);

    const netProfit = totalRev - totalCost - totalExpenses - totalPayroll;
    const grossMargin = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;
    const salesCount = filteredSalesForReport.length;
    const avgVoucher = salesCount > 0 ? totalRev / salesCount : 0;

    return {
      totalRev,
      totalCost,
      totalExpenses,
      totalPurchases,
      totalPayroll,
      netProfit,
      grossMargin,
      salesCount,
      avgVoucher,
    };
  }, [filteredSalesForReport, filteredExpensesForReport, filteredPurchasesForReport, filteredPayrollForReport]);

  const topSellingProducts = useMemo(() => {
    const productsMap: { [name: string]: { qty: number; revenue: number } } = {};
    
    filteredSalesForReport.forEach((sale) => {
      const items = sale.items || [];
      items.forEach((item: any) => {
        const name = item.name || "Unknown Item";
        const qty = item.qty || 0;
        const price = item.price || 0;
        const totalItemRev = qty * price;

        if (!productsMap[name]) {
          productsMap[name] = { qty: 0, revenue: 0 };
        }
        productsMap[name].qty += qty;
        productsMap[name].revenue += totalItemRev;
      });
    });

    return Object.keys(productsMap)
      .map((name) => ({
        name,
        qty: productsMap[name].qty,
        revenue: productsMap[name].revenue,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredSalesForReport]);

  const paymentMethodsBreakdown = useMemo(() => {
    const methods = ["Cash", "KPay", "WavePay", "AYA Pay", "Credit", "COD"];
    const counts: { [method: string]: number } = {};
    methods.forEach((m) => (counts[m] = 0));

    filteredSalesForReport.forEach((s) => {
      const pm = s.paymentMethod || "Cash";
      const total = s.total || 0;
      if (counts[pm] !== undefined) {
        counts[pm] += total;
      } else {
        counts[pm] = total;
      }
    });

    const totalSales = Object.values(counts).reduce((sum, v) => sum + v, 0);

    return Object.keys(counts).map((method) => {
      const amount = counts[method];
      const percentage = totalSales > 0 ? (amount / totalSales) * 100 : 0;
      return {
        method,
        amount,
        percentage,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [filteredSalesForReport]);

  const last7DaysSales = useMemo(() => {
    const result = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const startOfD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const endOfD = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

      const totalForD = salesHistory
        .filter((s) => {
          if (!s.createdAt) return false;
          const sDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
          return sDate >= startOfD && sDate < endOfD;
        })
        .reduce((sum, s) => sum + (s.total || 0), 0);

      result.push({
        dateLabel: dateStr,
        amount: totalForD,
      });
    }
    return result;
  }, [salesHistory]);

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
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setLang("en");
              localStorage.setItem("lang", "en");
            }}
            className={`px-3 py-1 text-xs font-black rounded-lg cursor-pointer transition ${
              lang === "en" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            EN
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setLang("my");
              localStorage.setItem("lang", "my");
            }}
            className={`px-3 py-1 text-xs font-black rounded-lg cursor-pointer transition ${
              lang === "my" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            မြန်မာ
          </motion.button>
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
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all text-sm mt-6 disabled:opacity-50 cursor-pointer"
            >
              {loginLoading ? (isRegisterMode ? t.signingUp : t.loggingIn) : (isRegisterMode ? t.signUp : t.login)}
            </motion.button>
          </form>

          {/* Toggle Mode Button */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLoginErr("");
              }}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
            >
              {isRegisterMode ? t.haveAccount : t.noAccount}
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  if (shopId === "master_shop") {
    return (
      <div className="h-[100vh] flex flex-col w-full bg-[#060606] relative overflow-hidden font-sans">
        <MasterAdminPanel lang={lang} onLogout={handleLogout} />
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setLang("en");
                  localStorage.setItem("lang", "en");
                }}
                className={`px-2.5 py-1 font-black rounded-full cursor-pointer transition-all ${
                  lang === "en" ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-400"
                }`}
              >
                EN
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setLang("my");
                  localStorage.setItem("lang", "my");
                }}
                className={`px-2.5 py-1 font-black rounded-full cursor-pointer transition-all ${
                  lang === "my" ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-400"
                }`}
              >
                MY
              </motion.button>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveModal("settings")}
              className={`w-10 h-10 ${theme.isLight ? "bg-slate-200/50 border-slate-300 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"} border rounded-full flex items-center justify-center shadow-sm hover:opacity-85 transition cursor-pointer`}
              title={t.systemSettings}
            >
              <Settings size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-400 shadow-sm hover:bg-rose-500/20 transition cursor-pointer"
              title={t.logout}
            >
              <LogOut size={18} />
            </motion.button>
          </div>
        </header>
      )}

      {/* Main View Router Content */}
      <main className="flex-1 overflow-hidden relative z-10">
        {/* VIEW 1: DASHBOARD */}
        {currentView === "dashboard" && (
          <div className="w-full h-full overflow-y-auto px-4 sm:px-6 pb-24 no-scrollbar space-y-6 pt-2">
            {/* SaaS Client License Status Banner */}
            {currentUserData && shopId !== "master_shop" && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    licenseDaysLeft !== null && licenseDaysLeft <= 5 
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white font-display">
                      {lang === "my" ? "စနစ်အသုံးပြုခွင့် လိုင်စင်အခြေအနေ" : "System License Status"}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 font-mono">
                      {lang === "my" 
                        ? `လိုင်စင်သက်တမ်းကုန်ဆုံးရန် ${licenseDaysLeft} ရက် ကျန်ပါသေးသည်` 
                        : `${licenseDaysLeft} days remaining on your active license`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${
                    licenseDaysLeft !== null && licenseDaysLeft <= 3 
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" 
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}>
                    {licenseDaysLeft !== null && licenseDaysLeft <= 3 
                      ? (lang === "my" ? "စမ်းသပ်အသုံးပြုမှု" : "Trial Account") 
                      : (lang === "my" ? "လုပ်ငန်းသုံးလိုင်စင်" : "Premium License")}
                  </span>
                  <button 
                    onClick={() => alert(
                      lang === "my" 
                        ? "စနစ်လိုင်စင် သက်တမ်းတိုးရန် သို့မဟုတ် ဝယ်ယူရန်အတွက် ကျေးဇူးပြု၍ မာစတာစနစ်စီမံခန့်ခွဲသူ (သို့မဟုတ် ဖုန်းနံပါတ်/Viber) သို့ ဆက်သွယ်ဆောင်ရွက်ပေးပါရန်။" 
                        : "To extend or purchase a full system license, please contact your System Administrator directly."
                    )}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[10px] font-black border border-white/5 text-indigo-400 rounded-lg transition"
                  >
                    {lang === "my" ? "သက်တမ်းတိုးရန် ဆက်သွယ်ရန်" : "Renew License"}
                  </button>
                </div>
              </div>
            )}

            {/* Call to action POS banner */}
            <div className={`bg-gradient-to-br ${theme.gradient} rounded-[2rem] p-6 shadow-xl relative overflow-hidden text-white shrink-0`}>
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                <Store size={150} />
              </div>
              <div className="relative z-10">
                <h2 className="font-black text-2xl mb-1 font-display">{t.posBannerTitle}</h2>
                <p className="text-indigo-100 text-xs mb-5 font-semibold">{t.posBannerSub}</p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentView("pos")}
                  className="bg-white text-black px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-white/10 hover:bg-indigo-50 transition cursor-pointer"
                >
                  <ShoppingCart size={16} /> {t.posBannerBtn}
                </motion.button>
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
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentView("pos")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className={`${theme.textAccent} ${theme.bgAccent} w-12 h-12 rounded-xl flex items-center justify-center border ${theme.borderAccent}`}>
                    <ShoppingCart size={22} />
                  </div>
                  <span className={`text-[10px] font-black ${theme.isLight ? "text-slate-700" : "text-slate-300"} text-center`}>{t.newSale}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal("sales-list")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className={`${theme.isLight ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"} w-12 h-12 rounded-xl flex items-center justify-center border`}>
                    <ListChecks size={22} />
                  </div>
                  <span className={`text-[10px] font-black ${theme.isLight ? "text-slate-700" : "text-slate-300"} text-center`}>{t.salesRecords}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal("purchase-list")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className="bg-purple-500/10 text-purple-400 w-12 h-12 rounded-xl flex items-center justify-center border border-purple-500/20">
                    <Package size={22} />
                  </div>
                  <span className={`text-[10px] font-black ${theme.isLight ? "text-slate-700" : "text-slate-300"} text-center`}>{t.purchasedItems}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveModal("cod")}
                  className={`${theme.bgInner} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-sm border ${theme.border} ${theme.borderHover} transition cursor-pointer`}
                >
                  <div className="bg-amber-500/10 text-amber-400 w-12 h-12 rounded-xl flex items-center justify-center border border-amber-500/20">
                    <Truck size={22} />
                  </div>
                  <span className={`text-[10px] font-black ${theme.isLight ? "text-slate-700" : "text-slate-300"} text-center`}>{t.codTracking}</span>
                </motion.button>
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
            onMobileCartToggle={(isOpen) => setIsMobileCartOpen(isOpen)}
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
            {/* Report toolbar */}
            <div className={`p-4 shrink-0 ${theme.isLight ? "bg-slate-100/50" : "bg-black/20"} backdrop-blur-md border-b ${theme.border} max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm`}>
              <div>
                <h2 className={`text-xl font-black ${theme.isLight ? "text-slate-800" : "text-white"} font-display flex items-center gap-2`}>
                  <BarChart3 size={20} className="text-indigo-400" />
                  {lang === "my" ? "အရောင်းအစီရင်ခံစာများ" : "Sales Reports & Analytics"}
                </h2>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                  {lang === "my" ? "သင့်ဆိုင်၏ ရောင်းအားနှင့် ဘဏ္ဍာရေး အချက်အလက်များ" : "Analyze your business performance, products, and channels"}
                </p>
              </div>

              {/* Time Period Filter Pills */}
              <div className="flex gap-1 bg-[#0a0a0a]/95 border border-white/10 p-1 rounded-2xl self-start sm:self-center shrink-0">
                {[
                  { value: "all", labelEn: "All", labelMy: "အားလုံး" },
                  { value: "today", labelEn: "Today", labelMy: "ယနေ့" },
                  { value: "yesterday", labelEn: "Yesterday", labelMy: "မနေ့က" },
                  { value: "week", labelEn: "7 Days", labelMy: "၇ ရက်" },
                  { value: "month", labelEn: "30 Days", labelMy: "၃၀ ရက်" },
                ].map((item) => (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    key={item.value}
                    onClick={() => setReportPeriod(item.value as any)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                      reportPeriod === item.value
                        ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {lang === "my" ? item.labelMy : item.labelEn}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-24 max-w-7xl mx-auto w-full no-scrollbar space-y-4">
              {/* Analytics metrics bento grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Net Profit Card */}
                <div className={`${theme.bgInner} border ${theme.border} rounded-3xl p-4 shadow-sm relative overflow-hidden group`}>
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                    <TrendingUp size={48} className="text-indigo-400" />
                  </div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{t.netProfit}</p>
                  <h3 className={`text-xl sm:text-2xl font-black ${theme.textAccent} font-display truncate`}>
                    {reportTotals.netProfit.toLocaleString()} <span className="text-[10px] font-bold text-slate-500">Ks</span>
                  </h3>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                      Margin: {reportTotals.grossMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* 2. Total Revenue Card */}
                <div className={`${theme.bgInner} border ${theme.border} rounded-3xl p-4 shadow-sm relative overflow-hidden group`}>
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                    <DollarSign size={48} className="text-indigo-400" />
                  </div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{t.totalRevenue}</p>
                  <h3 className={`text-xl sm:text-2xl font-black ${theme.isLight ? "text-slate-800" : "text-slate-100"} font-display truncate`}>
                    {reportTotals.totalRev.toLocaleString()} <span className="text-[10px] font-bold text-slate-500">Ks</span>
                  </h3>
                  <p className="text-[9px] text-slate-500 font-semibold mt-2.5">
                    {lang === "my" ? "စုစုပေါင်း ရောင်းရငွေ" : "Gross store revenue"}
                  </p>
                </div>

                {/* 3. Total Costs Card */}
                <div className={`${theme.bgInner} border ${theme.border} rounded-3xl p-4 shadow-sm relative overflow-hidden group`}>
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                    <Package size={48} className="text-rose-400" />
                  </div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{t.totalCost}</p>
                  <h3 className="text-xl sm:text-2xl font-black text-rose-400 font-display truncate">
                    {(reportTotals.totalCost + reportTotals.totalExpenses + reportTotals.totalPayroll).toLocaleString()} <span className="text-[10px] font-bold text-slate-500">Ks</span>
                  </h3>
                  <p className="text-[9px] text-slate-500 font-semibold mt-2.5">
                    {lang === "my" ? "ရင်းနှီးငွေ + စရိတ်များ" : "COGS & operational costs"}
                  </p>
                </div>

                {/* 4. Total Sales & Ticket Card */}
                <div className={`${theme.bgInner} border ${theme.border} rounded-3xl p-4 shadow-sm relative overflow-hidden group`}>
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                    <ListChecks size={48} className="text-purple-400" />
                  </div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{lang === "my" ? "စုစုပေါင်း ဘောက်ချာ" : "Total Transactions"}</p>
                  <h3 className={`text-xl sm:text-2xl font-black ${theme.isLight ? "text-slate-800" : "text-slate-100"} font-display truncate`}>
                    {reportTotals.salesCount} <span className="text-[10px] font-bold text-slate-500">{lang === "my" ? "ကြိမ်" : "Sales"}</span>
                  </h3>
                  <p className="text-[9px] text-indigo-400 font-bold mt-2.5">
                    Avg: {Math.round(reportTotals.avgVoucher).toLocaleString()} Ks
                  </p>
                </div>
              </div>

              {/* Weekly performance visual chart */}
              <div className={`${theme.bgInner} border ${theme.border} rounded-3xl p-5 shadow-sm space-y-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className={`text-xs font-black ${theme.isLight ? "text-slate-800" : "text-white"} uppercase tracking-wider`}>
                      {lang === "my" ? "နောက်ဆုံး ၇ ရက် အရောင်းအခြေအနေ" : "Weekly Sales Trend (Last 7 Days)"}
                    </h4>
                    <p className="text-[9px] text-slate-500 font-semibold mt-0.5">
                      {lang === "my" ? "နေ့စဉ်ရောင်းအား တိုးတက်မှုဇယား" : "Daily sales volume analysis"}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-indigo-400 flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    <Clock size={10} /> Real-time
                  </span>
                </div>

                {/* SVG/CSS Custom Bar Chart */}
                <div className="h-44 flex items-end gap-3 pt-6 px-2">
                  {last7DaysSales.map((day, idx) => {
                    const maxAmount = Math.max(...last7DaysSales.map((d) => d.amount), 1);
                    const percentageHeight = (day.amount / maxAmount) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group cursor-pointer h-full justify-end">
                        <div className="w-full relative flex justify-center items-end h-full">
                          {/* Tooltip on hover */}
                          <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-[#0a0a0a]/95 text-white border border-white/10 text-[9px] px-2 py-1 rounded-md font-bold whitespace-nowrap shadow-md z-20">
                            {day.amount.toLocaleString()} Ks
                          </div>
                          {/* Bar Graphic */}
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(percentageHeight, 4)}%` }}
                            transition={{ duration: 0.5, delay: idx * 0.05 }}
                            className={`w-full rounded-t-xl transition-all duration-300 ${
                              day.amount === maxAmount
                                ? "bg-gradient-to-t from-indigo-600 via-purple-500 to-pink-500"
                                : "bg-gradient-to-t from-indigo-500/60 to-indigo-500"
                            } group-hover:brightness-110 shadow`}
                          />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 mt-2 font-mono">
                          {day.dateLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bento insights columns: Top Selling Products and Payment Methods */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Selling Products */}
                <div className={`${theme.bgInner} border ${theme.border} rounded-3xl p-5 shadow-sm space-y-4`}>
                  <div className="flex items-center gap-2">
                    <Award className="text-amber-400" size={18} />
                    <div>
                      <h4 className={`text-xs font-black ${theme.isLight ? "text-slate-800" : "text-white"} uppercase tracking-wider`}>
                        {lang === "my" ? "လူကြိုက်အများဆုံး ကုန်ပစ္စည်းများ" : "Top Selling Products"}
                      </h4>
                      <p className="text-[9px] text-slate-500 font-semibold">
                        {lang === "my" ? "အများဆုံး ရောင်းအားရသော ကုန်ပစ္စည်း ၅ ခု" : "Best sellers in selected time period"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {topSellingProducts.length === 0 ? (
                      <p className="text-[11px] text-slate-500 font-bold py-6 text-center">
                        {lang === "my" ? "အရောင်းမှတ်တမ်း မရှိသေးပါ။" : "No product sales recorded in this period."}
                      </p>
                    ) : (
                      topSellingProducts.map((p, idx) => {
                        const maxQty = Math.max(...topSellingProducts.map((p) => p.qty), 1);
                        const progressPercent = (p.qty / maxQty) * 100;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className={`font-black ${theme.isLight ? "text-slate-800" : "text-slate-200"} flex items-center gap-1.5`}>
                                <span className="text-[9px] font-black text-slate-400 bg-white/5 border border-white/10 w-4 h-4 rounded flex items-center justify-center font-mono">{idx + 1}</span>
                                {p.name}
                              </span>
                              <span className="text-indigo-400 font-bold text-[11px]">
                                {p.qty} {lang === "my" ? "ခု" : "sold"} • {p.revenue.toLocaleString()} Ks
                              </span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.1 }}
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Payment Channel Distribution */}
                <div className={`${theme.bgInner} border ${theme.border} rounded-3xl p-5 shadow-sm space-y-4`}>
                  <div className="flex items-center gap-2">
                    <Landmark className="text-indigo-400" size={18} />
                    <div>
                      <h4 className={`text-xs font-black ${theme.isLight ? "text-slate-800" : "text-white"} uppercase tracking-wider`}>
                        {lang === "my" ? "ငွေပေးချေမှုစနစ် အချိုးအစား" : "Payment Method Distribution"}
                      </h4>
                      <p className="text-[9px] text-slate-500 font-semibold">
                        {lang === "my" ? "အသုံးပြုမှုအများဆုံး ငွေပေးချေမှုလမ်းကြောင်းများ" : "Sales channels split by value"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {paymentMethodsBreakdown.every((m) => m.amount === 0) ? (
                      <p className="text-[11px] text-slate-500 font-bold py-6 text-center">
                        {lang === "my" ? "အရောင်းမှတ်တမ်း မရှိသေးပါ။" : "No payments recorded in this period."}
                      </p>
                    ) : (
                      paymentMethodsBreakdown.map((pm, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className={`font-black ${theme.isLight ? "text-slate-800" : "text-slate-200"}`}>
                              {pm.method}
                            </span>
                            <span className="text-slate-400 font-bold text-[11px]">
                              {pm.percentage.toFixed(1)}% • {pm.amount.toLocaleString()} Ks
                            </span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pm.percentage}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.1 }}
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Recent Sales history table list for filtered period */}
              <div className={`${theme.bgInner} border ${theme.border} rounded-3xl p-5 shadow-sm space-y-4`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className={`text-xs font-black ${theme.isLight ? "text-slate-800" : "text-white"} uppercase tracking-wider`}>
                      {lang === "my" ? "အသေးစိတ် အရောင်းမှတ်တမ်းများ" : "Filtered Sales Ledger"}
                    </h4>
                    <p className="text-[9px] text-slate-500 font-semibold">
                      {lang === "my" ? "ရွေးချယ်ထားသော အချိန်အပိုင်းအခြားအတွင်းမှ ဘောက်ချာများ" : `Showing ${filteredSalesForReport.length} vouchers for ${reportPeriod.toUpperCase()}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto no-scrollbar pt-1">
                  {filteredSalesForReport.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 font-bold text-xs">
                      {lang === "my" ? "ရွေးချယ်ထားသော အချိန်အပိုင်းအခြားအတွက် အရောင်းမှတ်တမ်း မရှိပါ။" : "No sales found for the selected time range."}
                    </div>
                  ) : (
                    filteredSalesForReport.map((s) => {
                      const itemsStr = (s.items || []).map((i: any) => i.name).join(", ");
                      const dateStr = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : new Date(s.createdAt).toLocaleString();
                      return (
                        <div
                          key={s.id}
                          className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-sm flex items-center justify-between hover:border-indigo-500/20 transition duration-200"
                        >
                          <div className="overflow-hidden mr-3">
                            <b className={`text-xs font-bold ${theme.isLight ? "text-slate-800" : "text-slate-200"} block truncate`}>
                              {itemsStr || (lang === "my" ? "ကိုယ်တိုင်ထည့်သွင်းမှု" : "Manual / Direct Entry")}
                            </b>
                            <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">
                              {dateStr}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-black text-sm ${theme.textAccent} font-display`}>
                              {(s.total || 0).toLocaleString()} Ks
                            </p>
                            <span className={`text-[9px] font-bold ${theme.isLight ? "text-slate-600 bg-slate-100 border-slate-200" : "text-slate-400 bg-white/5 border-white/5"} px-2 py-0.5 rounded-md uppercase tracking-wider block mt-1`}>
                              {s.paymentMethod}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
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
      <nav className={`fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/5 justify-around items-center px-2 py-2 pb-safe shadow-lg lg:hidden z-40 ${isMobileCartOpen ? "hidden" : "flex"}`}>
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
