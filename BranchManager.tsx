import React, { useState } from "react";
import { 
  Building2, Plus, Edit, CheckCircle, XCircle, ArrowRightLeft, 
  BarChart2, Search, MapPin, Phone, User, ShieldCheck, ArrowUpRight,
  Package, DollarSign, ListFilter, AlertCircle, RefreshCw, Layers, KeyRound
} from "lucide-react";
import { 
  collection, doc, addDoc, updateDoc, setDoc, serverTimestamp, writeBatch, increment 
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, firebaseConfig } from "../firebase";
import { Branch, StockTransfer, Product, Sale } from "../types";
import { Language, translations } from "../lib/translations";
import { motion, AnimatePresence } from "motion/react";

interface BranchManagerProps {
  shopId: string;
  branches: Branch[];
  stockTransfers: StockTransfer[];
  allProducts: Product[];
  salesHistory: Sale[];
  activeBranchId: string;
  onSelectActiveBranch: (branchId: string) => void;
  lang: Language;
  theme: any;
}

export default function BranchManager({
  shopId,
  branches,
  stockTransfers,
  allProducts,
  salesHistory,
  activeBranchId,
  onSelectActiveBranch,
  lang,
  theme
}: BranchManagerProps) {
  const t = translations[lang];

  // Active Tab: "branches" | "transfer" | "analytics"
  const [activeTab, setActiveTab] = useState<"branches" | "transfer" | "analytics">("branches");

  // Add / Edit Branch Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Form State for Branch Creation / Editing
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchManager, setBranchManager] = useState("");
  const [branchUsername, setBranchUsername] = useState("");
  const [branchPassword, setBranchPassword] = useState("");
  const [isMainBranch, setIsMainBranch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");

  // Stock Transfer Form State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [transferQty, setTransferQty] = useState<number | "">(1);
  const [transferNotes, setTransferNotes] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferMsg, setTransferMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search filter for transfer history
  const [transferSearch, setTransferSearch] = useState("");

  // Populate edit branch
  const openEditBranchModal = (b: Branch) => {
    setEditingBranch(b);
    setBranchName(b.name || "");
    setBranchCode(b.code || "");
    setBranchPhone(b.phone || "");
    setBranchAddress(b.address || "");
    setBranchManager(b.managerName || "");
    setBranchUsername(b.username || "");
    setBranchPassword(b.password || "123456");
    setIsMainBranch(!!b.isMain);
    setFormErr("");
    setIsAddModalOpen(true);
  };

  const openAddBranchModal = () => {
    setEditingBranch(null);
    setBranchName("");
    setBranchCode(`BR-0${branches.length + 1}`);
    setBranchPhone("");
    setBranchAddress("");
    setBranchManager("");
    setBranchUsername(`${shopId.replace("shop_", "")}_b${branches.length + 1}`);
    setBranchPassword("123456");
    setIsMainBranch(branches.length === 0);
    setFormErr("");
    setIsAddModalOpen(true);
  };

  // Submit Branch Add / Edit
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      setFormErr(lang === "my" ? "ဆိုင်ခွဲအမည် ထည့်သွင်းပေးပါ။" : "Branch name is required.");
      return;
    }

    const cleanUsername = branchUsername.toLowerCase().trim();
    const cleanPassword = branchPassword.trim() || "123456";

    if (cleanPassword.length < 6) {
      setFormErr(lang === "my" ? "လျှို့ဝှက်နံပါတ်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။" : "Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    setFormErr("");

    try {
      let targetBranchId = editingBranch ? editingBranch.id : doc(collection(db, "shops", shopId, "branches")).id;

      // 1. Provision / Register Firebase Auth sub-account for branch staff
      let staffUid = "";
      if (cleanUsername) {
        try {
          const secondaryApp = getApps().find(a => a.name === "SecondaryAuth") || initializeApp(firebaseConfig, "SecondaryAuth");
          const secondaryAuth = getAuth(secondaryApp);
          const email = `${cleanUsername}@pos.local`;
          try {
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, cleanPassword);
            staffUid = userCred.user.uid;
          } catch (err: any) {
            // Account might already exist
          }
        } catch (authErr) {
          console.warn("Branch auth creation warning:", authErr);
        }

        // Write Firestore User Document for Branch Staff
        const staffUserData = {
          username: cleanUsername,
          role: "staff",
          shopId: shopId,
          shopName: shopId,
          assignedBranchId: targetBranchId,
          assignedBranchName: branchName.trim(),
          expiryDate: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, "users", cleanUsername), staffUserData, { merge: true });
        if (staffUid) {
          await setDoc(doc(db, "users", staffUid), staffUserData, { merge: true });
        }
      }

      const payload: Partial<Branch> = {
        name: branchName.trim(),
        code: branchCode.trim() || `BR-${Date.now().toString().slice(-3)}`,
        phone: branchPhone.trim(),
        address: branchAddress.trim(),
        managerName: branchManager.trim(),
        username: cleanUsername,
        password: cleanPassword,
        isMain: isMainBranch,
        status: editingBranch ? editingBranch.status : "active",
      };

      const batch = writeBatch(db);

      // If set as main branch, un-main all other branches
      if (isMainBranch) {
        branches.forEach((b) => {
          if (b.id !== targetBranchId) {
            const bRef = doc(db, "shops", shopId, "branches", b.id);
            batch.update(bRef, { isMain: false });
          }
        });
      }

      const bRef = doc(db, "shops", shopId, "branches", targetBranchId);
      batch.set(bRef, {
        ...payload,
        createdAt: editingBranch?.createdAt || serverTimestamp(),
      }, { merge: true });

      await batch.commit();
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error saving branch:", err);
      setFormErr(err.message || "Failed to save branch");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Branch Active / Inactive Status
  const handleToggleBranchStatus = async (branch: Branch) => {
    try {
      const newStatus = branch.status === "active" ? "inactive" : "active";
      await updateDoc(doc(db, "shops", shopId, "branches", branch.id), {
        status: newStatus
      });
    } catch (err) {
      console.error("Error toggling branch status:", err);
    }
  };

  // Execute Stock Transfer
  const handleExecuteStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferMsg(null);

    if (!selectedProductId) {
      setTransferMsg({ type: "error", text: lang === "my" ? "ကုန်ပစ္စည်း ရွေးချယ်ပါ။" : "Please select a product." });
      return;
    }
    if (!fromBranchId || !toBranchId) {
      setTransferMsg({ type: "error", text: lang === "my" ? "ပေးပို့မည့် နှင့် လက်ခံမည့် ဆိုင်ခွဲကို ရွေးချယ်ပါ။" : "Select both source and target branches." });
      return;
    }
    if (fromBranchId === toBranchId) {
      setTransferMsg({ type: "error", text: lang === "my" ? "ပေးပို့မည့် နှင့် လက်ခံမည့် ဆိုင်ခွဲ တူညီ၍ မရပါ။" : "Source and destination branch cannot be the same." });
      return;
    }

    const qtyNum = Number(transferQty);
    if (!qtyNum || qtyNum <= 0) {
      setTransferMsg({ type: "error", text: lang === "my" ? "လွှဲပြောင်းမည့် အရေအတွက် မှန်ကန်စွာ ထည့်ပါ။" : "Please enter a valid transfer quantity." });
      return;
    }

    const targetProduct = allProducts.find((p) => p.id === selectedProductId);
    if (!targetProduct) return;

    const fromBranchObj = branches.find((b) => b.id === fromBranchId);
    const toBranchObj = branches.find((b) => b.id === toBranchId);

    // Check available quantity in source branch or total
    const currentFromQty = targetProduct.branchQuantities?.[fromBranchId] ?? targetProduct.quantity;
    if (currentFromQty < qtyNum) {
      setTransferMsg({ 
        type: "error", 
        text: lang === "my" 
          ? `ပေးပို့မည့်ဆိုင်ခွဲတွင် စတော့လက်ကျန် (${currentFromQty}) ခုသာ ရှိပါသည်။` 
          : `Source branch only has ${currentFromQty} units available.` 
      });
      return;
    }

    setIsTransferring(true);

    try {
      const batch = writeBatch(db);
      const prodRef = doc(db, "shops", shopId, "products", targetProduct.id);

      const currentToQty = targetProduct.branchQuantities?.[toBranchId] ?? 0;
      const updatedBranchQuantities = {
        ...(targetProduct.branchQuantities || {}),
        [fromBranchId]: Math.max(0, currentFromQty - qtyNum),
        [toBranchId]: currentToQty + qtyNum,
      };

      batch.update(prodRef, {
        branchQuantities: updatedBranchQuantities
      });

      // Log Stock Transfer
      const transferRef = doc(collection(db, "shops", shopId, "stock_transfers"));
      batch.set(transferRef, {
        productId: targetProduct.id,
        productName: targetProduct.name,
        fromBranchId,
        fromBranchName: fromBranchObj?.name || "Source Branch",
        toBranchId,
        toBranchName: toBranchObj?.name || "Target Branch",
        quantity: qtyNum,
        notes: transferNotes.trim() || "-",
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setTransferMsg({
        type: "success",
        text: lang === "my" 
          ? `စတော့ ${qtyNum} ခုကို ${fromBranchObj?.name} မှ ${toBranchObj?.name} သို့ အောင်မြင်စွာ လွှဲပြောင်းပြီးပါပြီ။` 
          : `Transferred ${qtyNum} units from ${fromBranchObj?.name} to ${toBranchObj?.name} successfully.`
      });

      setSelectedProductId("");
      setTransferQty(1);
      setTransferNotes("");
    } catch (err: any) {
      console.error("Stock transfer error:", err);
      setTransferMsg({ type: "error", text: err.message || "Failed to execute transfer" });
    } finally {
      setIsTransferring(false);
    }
  };

  // Calculate Branch Sales Comparison Metrics
  const branchAnalytics = branches.map((branch) => {
    const branchSales = salesHistory.filter((s) => s.branchId === branch.id);
    const totalRev = branchSales.reduce((acc, s) => acc + (s.total || 0), 0);
    const totalProfit = branchSales.reduce((acc, s) => acc + (s.profit || 0), 0);
    const salesCount = branchSales.length;
    const avgTicket = salesCount > 0 ? Math.round(totalRev / salesCount) : 0;

    return {
      branch,
      totalRev,
      totalProfit,
      salesCount,
      avgTicket,
    };
  });

  const filteredTransfers = stockTransfers.filter((t) => 
    t.productName?.toLowerCase().includes(transferSearch.toLowerCase()) ||
    t.fromBranchName?.toLowerCase().includes(transferSearch.toLowerCase()) ||
    t.toBranchName?.toLowerCase().includes(transferSearch.toLowerCase())
  );

  return (
    <div className="w-full h-full overflow-y-auto px-4 sm:px-6 pb-24 no-scrollbar space-y-6 pt-2">
      {/* Top Banner & Tab Controls */}
      <div className={`p-6 rounded-[2rem] bg-gradient-to-br ${theme.gradient} border ${theme.border} text-white shadow-xl relative overflow-hidden`}>
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <Building2 size={180} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider">
                Multi-Store POS Engine
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[10px] font-black">
                {branches.filter((b) => b.status === "active").length} Active Branches
              </span>
            </div>
            <h2 className="text-2xl font-black font-display">{t.branchManagement}</h2>
            <p className="text-xs text-indigo-100 font-medium">
              {lang === "my" 
                ? "ဆိုင်ခွဲများ စီမံခန့်ခွဲခြင်း၊ စတော့များ လွှဲပြောင်းခြင်းနှင့် ရောင်းအား နှိုင်းယှဉ်ချက် သုံးသပ်ခြင်း" 
                : "Manage multi-branch operations, transfer stock seamlessly, and compare store analytics."}
            </p>
          </div>

          <button
            onClick={openAddBranchModal}
            className="px-5 py-3 bg-white text-slate-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:bg-slate-100 transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus size={16} />
            {t.addBranch}
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("branches")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "branches" 
                ? "bg-white text-slate-900 shadow-md font-black" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Building2 size={15} />
            {lang === "my" ? "ဆိုင်ခွဲများ စာရင်း" : "Store Branches"} ({branches.length})
          </button>

          <button
            onClick={() => setActiveTab("transfer")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "transfer" 
                ? "bg-white text-slate-900 shadow-md font-black" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <ArrowRightLeft size={15} />
            {t.stockTransfer}
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === "analytics" 
                ? "bg-white text-slate-900 shadow-md font-black" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <BarChart2 size={15} />
            {t.branchComparison}
          </button>
        </div>
      </div>

      {/* TAB 1: BRANCHES LIST */}
      {activeTab === "branches" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.length === 0 ? (
              <div className={`col-span-full ${theme.bgInner} border ${theme.border} rounded-2xl p-8 text-center space-y-3`}>
                <Building2 size={40} className="mx-auto text-slate-500 opacity-50" />
                <p className="text-sm font-bold text-slate-400">
                  {lang === "my" ? "ဆိုင်ခွဲ စာရင်းမရှိသေးပါ။ ဆိုင်ခွဲအသစ် ထည့်သွင်းပါ။" : "No branches found. Add your first branch."}
                </p>
                <button
                  onClick={openAddBranchModal}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-600 transition"
                >
                  {t.addBranch}
                </button>
              </div>
            ) : (
              branches.map((b) => {
                const isActiveBranch = activeBranchId === b.id;
                const branchSales = salesHistory.filter((s) => s.branchId === b.id);
                const totalRev = branchSales.reduce((acc, s) => acc + (s.total || 0), 0);

                return (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${theme.bgInner} border ${isActiveBranch ? "border-indigo-500 ring-2 ring-indigo-500/20" : theme.border} rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden flex flex-col justify-between`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black rounded-md">
                            {b.code || "BR"}
                          </span>
                          {b.isMain && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black rounded-md flex items-center gap-1">
                              <ShieldCheck size={11} />
                              {lang === "my" ? "ပင်မဆိုင်" : "Main"}
                            </span>
                          )}
                        </div>

                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${
                          b.status === "active" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {b.status === "active" ? (lang === "my" ? "ဖွင့်ထားသည်" : "Active") : (lang === "my" ? "ပိတ်ထားသည်" : "Inactive")}
                        </span>
                      </div>

                      {/* Branch Title */}
                      <h3 className={`text-base font-black ${theme.isLight ? "text-slate-900" : "text-white"} font-display mb-2`}>
                        {b.name}
                      </h3>

                      {/* Info Details */}
                      <div className="space-y-1.5 text-xs text-slate-400">
                        {b.address && (
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="shrink-0 text-slate-500" />
                            <span className="truncate">{b.address}</span>
                          </div>
                        )}
                        {b.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="shrink-0 text-slate-500" />
                            <span>{b.phone}</span>
                          </div>
                        )}
                        {b.managerName && (
                          <div className="flex items-center gap-2">
                            <User size={13} className="shrink-0 text-slate-500" />
                            <span>{lang === "my" ? "တာဝန်ခံ:" : "Manager:"} {b.managerName}</span>
                          </div>
                        )}
                        {b.username && (
                          <div className="flex items-center justify-between text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-2 rounded-xl border border-indigo-500/20 mt-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <ShieldCheck size={13} className="shrink-0 text-indigo-400" />
                              <span className="truncate">
                                User: <strong className="text-white">{b.username}</strong> | Pass: <strong className="text-white">{b.password || "******"}</strong>
                              </span>
                            </div>
                            <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded uppercase shrink-0">
                              Staff Account
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Revenue Stat */}
                      <div className="mt-4 p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                            {lang === "my" ? "စုစုပေါင်း ရောင်းရငွေ" : "Total Revenue"}
                          </p>
                          <p className="text-sm font-black text-emerald-400 font-display">
                            {totalRev.toLocaleString()} Ks
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                            {lang === "my" ? "အရောင်းအကြိမ်" : "Sales Count"}
                          </p>
                          <p className={`text-sm font-black ${theme.isLight ? "text-slate-800" : "text-white"} font-display`}>
                            {branchSales.length}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <button
                        onClick={() => onSelectActiveBranch(b.id)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          isActiveBranch 
                            ? "bg-indigo-500 text-white shadow-md font-black" 
                            : "bg-white/5 hover:bg-white/10 text-slate-300"
                        }`}
                      >
                        {isActiveBranch 
                          ? (lang === "my" ? "✓ လက်ရှိ ရွေးချယ်ထားသည်" : "✓ Active Store") 
                          : (lang === "my" ? "ဒီဆိုင်ခွဲသို့ ပြောင်းမည်" : "Switch to Branch")}
                      </button>

                      <button
                        onClick={() => openEditBranchModal(b)}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
                        title={t.edit}
                      >
                        <Edit size={14} />
                      </button>

                      <button
                        onClick={() => handleToggleBranchStatus(b)}
                        className={`p-2 border rounded-xl transition cursor-pointer ${
                          b.status === "active" 
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20" 
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        }`}
                        title={b.status === "active" ? "Deactivate" : "Activate"}
                      >
                        {b.status === "active" ? <XCircle size={14} /> : <CheckCircle size={14} />}
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STOCK TRANSFER */}
      {activeTab === "transfer" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transfer Form */}
          <div className={`lg:col-span-1 ${theme.bgInner} border ${theme.border} rounded-2xl p-5 shadow-sm space-y-4`}>
            <div className="flex items-center gap-2 pb-3 border-b border-white/10">
              <ArrowRightLeft size={18} className="text-indigo-400" />
              <h3 className={`font-black text-sm ${theme.isLight ? "text-slate-900" : "text-white"}`}>
                {t.transferStock}
              </h3>
            </div>

            {transferMsg && (
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                transferMsg.type === "success" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                {transferMsg.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                <span>{transferMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleExecuteStockTransfer} className="space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  {t.selectProduct} *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                >
                  <option value="">{lang === "my" ? "-- ကုန်ပစ္စည်း ရွေးပါ --" : "-- Select Product --"}</option>
                  {allProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) - Total Stock: {p.quantity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Branch */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  {t.fromBranch} *
                </label>
                <select
                  value={fromBranchId}
                  onChange={(e) => setFromBranchId(e.target.value)}
                  className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                >
                  <option value="">{lang === "my" ? "-- ပေးပို့မည့် ဆိုင်ခွဲ --" : "-- Select Source Branch --"}</option>
                  {branches.filter((b) => b.status === "active").map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Branch */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  {t.toBranch} *
                </label>
                <select
                  value={toBranchId}
                  onChange={(e) => setToBranchId(e.target.value)}
                  className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                >
                  <option value="">{lang === "my" ? "-- လက်ခံမည့် ဆိုင်ခွဲ --" : "-- Select Target Branch --"}</option>
                  {branches.filter((b) => b.status === "active").map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  {t.transferQty} *
                </label>
                <input
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Quantity"
                  className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  {lang === "my" ? "မှတ်ချက် (Notes)" : "Notes"}
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder={lang === "my" ? "မှတ်ချက် ရေးရန်..." : "Transfer notes..."}
                  className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>

              <button
                type="submit"
                disabled={isTransferring}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:brightness-110 text-white font-black text-xs rounded-xl shadow-lg transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <ArrowRightLeft size={16} />
                {isTransferring ? t.saving : t.transferStock}
              </button>
            </form>
          </div>

          {/* Transfer History Logs */}
          <div className={`lg:col-span-2 ${theme.bgInner} border ${theme.border} rounded-2xl p-5 shadow-sm space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-purple-400" />
                <h3 className={`font-black text-sm ${theme.isLight ? "text-slate-900" : "text-white"}`}>
                  {t.transferHistory}
                </h3>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={transferSearch}
                  onChange={(e) => setTransferSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className={`pl-8 pr-3 py-1.5 rounded-xl text-xs ${theme.isLight ? "bg-slate-100 border-slate-300" : "bg-white/5 border-white/10"} border text-white focus:outline-none`}
                />
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                    <th className="py-2.5 px-3">{lang === "my" ? "ကုန်ပစ္စည်း" : "Product"}</th>
                    <th className="py-2.5 px-3">{t.fromBranch}</th>
                    <th className="py-2.5 px-3">{t.toBranch}</th>
                    <th className="py-2.5 px-3 text-right">{t.transferQty}</th>
                    <th className="py-2.5 px-3">{lang === "my" ? "မှတ်ချက်" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-semibold">
                        {lang === "my" ? "စတော့လွှဲပြောင်းမှု မှတ်တမ်း မရှိသေးပါ။" : "No transfer logs found."}
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map((st) => (
                      <tr key={st.id} className="hover:bg-white/5 transition">
                        <td className="py-3 px-3 font-bold text-white">
                          {st.productName}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[10px] font-bold">
                            {st.fromBranchName}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">
                            {st.toBranchName}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-black text-indigo-400">
                          +{st.quantity}
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-[150px]">
                          {st.notes}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BRANCH ANALYTICS & COMPARISON */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchAnalytics.map(({ branch, totalRev, totalProfit, salesCount, avgTicket }) => (
              <div
                key={branch.id}
                className={`${theme.bgInner} border ${theme.border} rounded-2xl p-5 shadow-sm space-y-4`}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md text-[10px] font-black">
                    {branch.code || "BR"}
                  </span>
                  {branch.isMain && (
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[10px] font-black">
                      Main Branch
                    </span>
                  )}
                </div>

                <h3 className={`text-base font-black ${theme.isLight ? "text-slate-900" : "text-white"} font-display`}>
                  {branch.name}
                </h3>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-[9px] font-black text-slate-500 uppercase">{t.totalRevenue}</p>
                    <p className="text-sm font-black text-emerald-400 font-display mt-0.5">
                      {totalRev.toLocaleString()} Ks
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-[9px] font-black text-slate-500 uppercase">{t.netProfit}</p>
                    <p className="text-sm font-black text-indigo-400 font-display mt-0.5">
                      {totalProfit.toLocaleString()} Ks
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-[9px] font-black text-slate-500 uppercase">{lang === "my" ? "အရောင်းအကြိမ်" : "Transactions"}</p>
                    <p className={`text-sm font-black ${theme.isLight ? "text-slate-800" : "text-white"} font-display mt-0.5`}>
                      {salesCount}
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-[9px] font-black text-slate-500 uppercase">{lang === "my" ? "ပျမ်းမျှ ဘောက်ချာ" : "Avg Order"}</p>
                    <p className="text-sm font-black text-purple-400 font-display mt-0.5">
                      {avgTicket.toLocaleString()} Ks
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-md ${theme.bgOuter} border ${theme.border} rounded-3xl p-6 shadow-2xl relative space-y-4`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-400" />
                  <h3 className={`font-black text-base ${theme.isLight ? "text-slate-900" : "text-white"}`}>
                    {editingBranch ? (lang === "my" ? "ဆိုင်ခွဲ ပြင်ဆင်မည်" : "Edit Branch") : t.addBranch}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-white transition"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {formErr && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold">
                  {formErr}
                </div>
              )}

              <form onSubmit={handleSaveBranch} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    {t.branchName}
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Downtown Branch"
                    className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    {t.branchCode}
                  </label>
                  <input
                    type="text"
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    placeholder="BR-01"
                    className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    {t.branchPhone}
                  </label>
                  <input
                    type="text"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    placeholder="09..."
                    className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    {t.branchAddress}
                  </label>
                  <input
                    type="text"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    placeholder="Street, City..."
                    className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    {t.branchManager}
                  </label>
                  <input
                    type="text"
                    value={branchManager}
                    onChange={(e) => setBranchManager(e.target.value)}
                    placeholder="Manager Name"
                    className={`w-full p-2.5 rounded-xl ${theme.isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-white/5 border-white/10 text-white"} border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                  <div>
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-1">
                      {lang === "my" ? "အလုပ်သမား Username" : "Staff Username"}
                    </label>
                    <input
                      type="text"
                      value={branchUsername}
                      onChange={(e) => setBranchUsername(e.target.value)}
                      placeholder="e.g. kyaw_b1"
                      className={`w-full p-2 rounded-xl ${theme.isLight ? "bg-white border-slate-300 text-slate-800" : "bg-white/10 border-white/10 text-white"} border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-1">
                      {lang === "my" ? "အလုပ်သမား Password" : "Staff Password"}
                    </label>
                    <input
                      type="text"
                      value={branchPassword}
                      onChange={(e) => setBranchPassword(e.target.value)}
                      placeholder="e.g. 123456"
                      className={`w-full p-2 rounded-xl ${theme.isLight ? "bg-white border-slate-300 text-slate-800" : "bg-white/10 border-white/10 text-white"} border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isMain"
                    checked={isMainBranch}
                    onChange={(e) => setIsMainBranch(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-white/10 bg-white/5"
                  />
                  <label htmlFor="isMain" className="text-xs font-bold text-slate-300 cursor-pointer">
                    {t.isMainBranch}
                  </label>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-bold text-xs transition"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg transition disabled:opacity-50"
                  >
                    {isSubmitting ? t.saving : t.save}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
