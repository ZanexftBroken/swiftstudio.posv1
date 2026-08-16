import React, { useState, useEffect } from "react";
import { 
  Search, Users, Calendar, ShieldCheck, Clock, 
  UserCheck, ShieldAlert, Check, RefreshCw, Trash2
} from "lucide-react";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "motion/react";
import { Language } from "../lib/translations";

interface MasterUser {
  id: string; // auth uid
  shopId: string;
  shopName: string;
  username: string;
  role: string;
  expiryDate: string;
  createdAt: string;
}

interface MasterAdminPanelProps {
  lang: Language;
  onLogout: () => void;
}

export default function MasterAdminPanel({ lang, onLogout }: MasterAdminPanelProps) {
  const [users, setUsers] = useState<MasterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [customExpiry, setCustomExpiry] = useState("");

  // Fetch all users on mount
  const fetchAllUsers = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const list: MasterUser[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          shopId: data.shopId || "",
          shopName: data.shopName || "Unknown Store",
          username: data.username || "unknown",
          role: data.role || "user",
          expiryDate: data.expiryDate || "",
          createdAt: data.createdAt || ""
        });
      });
      setUsers(list);
    } catch (err: any) {
      console.error("Error fetching SaaS users:", err);
      setErrorMsg("Failed to load users list. Admin privilege required.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllUsers();
  }, []);

  // Update a user's expiry date
  const handleUpdateExpiry = async (userId: string, newDate: Date) => {
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const userObj = users.find((u) => u.id === userId);
      if (!userObj) return;

      const updatedExpiry = newDate.toISOString();
      const updatedData = { ...userObj, expiryDate: updatedExpiry };

      await setDoc(doc(db, "users", userId), updatedData, { merge: true });
      
      // Update local state
      setUsers((prev) => 
        prev.map((u) => u.id === userId ? { ...u, expiryDate: updatedExpiry } : u)
      );

      setSuccessMsg(`Successfully updated license expiry for @${userObj.username}`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setEditingUserId(null);
    } catch (err: any) {
      console.error("Failed to update expiry:", err);
      setErrorMsg("Failed to update license expiry date.");
    }
  };

  const extendDays = (userId: string, days: number) => {
    const userObj = users.find((u) => u.id === userId);
    if (!userObj) return;

    let baseDate = new Date();
    // If current expiry is in the future, extend from that, otherwise extend from today
    const currentExpiry = new Date(userObj.expiryDate);
    if (currentExpiry > new Date()) {
      baseDate = currentExpiry;
    }

    const newDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    handleUpdateExpiry(userId, newDate);
  };

  const suspendLicense = (userId: string) => {
    const confirmSuspend = window.confirm(
      lang === "my" 
        ? "ဤစတိုးဆိုင်၏ လိုင်စင်ကို ချက်ချင်းရပ်ဆိုင်းရန် သေချာပါသလား?" 
        : "Are you sure you want to suspend this store's license immediately?"
    );
    if (!confirmSuspend) return;
    
    // Set to 1 day ago to expire instantly
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    handleUpdateExpiry(userId, pastDate);
  };

  // Filter users based on search
  const filteredUsers = users.filter((u) => {
    const matchSearch = 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.shopId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = users.length;
    let active = 0;
    let expired = 0;
    let trial = 0;

    const now = new Date();
    users.forEach((u) => {
      if (!u.expiryDate) return;
      const exp = new Date(u.expiryDate);
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (exp > now) {
        active++;
        // If expiry is less than 4 days from registration, we count as trial
        const created = u.createdAt ? new Date(u.createdAt) : new Date();
        const totalDurationDays = Math.ceil((exp.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (totalDurationDays <= 4) {
          trial++;
        }
      } else {
        expired++;
      }
    });

    return { total, active, expired, trial };
  }, [users]);

  return (
    <div className="w-full h-full flex flex-col bg-[#060606] text-slate-200">
      {/* SaaS Admin Header */}
      <header className="bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-white/5 shrink-0 pt-safe z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-base font-black text-white font-display tracking-tight">
              {lang === "my" ? "SWIFT POS - မာစတာစနစ်စီမံခန့်ခွဲသူ" : "SWIFT POS - SaaS Master Admin"}
            </h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest leading-none mt-0.5">
              SaaS License Controller
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllUsers}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center text-slate-300 transition cursor-pointer"
            title="Reload Client Stores"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 size={14} />
            {lang === "my" ? "လော့ဂ်ထွက်ရန်" : "Logout Master"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
        {/* SaaS Metrics Dashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0b0b0b] p-4 rounded-3xl border border-white/5 relative overflow-hidden">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              {lang === "my" ? "စုစုပေါင်း စတိုးဆိုင်များ" : "Total Registered Stores"}
            </p>
            <h3 className="text-3xl font-black text-white font-display">{stats.total}</h3>
            <span className="text-[9px] font-bold text-slate-500 block mt-2">All-time SaaS client signups</span>
          </div>

          <div className="bg-[#0b0b0b] p-4 rounded-3xl border border-white/5 relative overflow-hidden">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              {lang === "my" ? "အသုံးပြုဆဲဆိုင်များ" : "Active Licenses"}
            </p>
            <h3 className="text-3xl font-black text-emerald-400 font-display">{stats.active}</h3>
            <span className="text-[9px] font-bold text-emerald-500/80 block mt-2">Stores currently active</span>
          </div>

          <div className="bg-[#0b0b0b] p-4 rounded-3xl border border-white/5 relative overflow-hidden">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              {lang === "my" ? "စမ်းသပ်သုံးစွဲသူများ" : "On Trial"}
            </p>
            <h3 className="text-3xl font-black text-amber-400 font-display">{stats.trial}</h3>
            <span className="text-[9px] font-bold text-amber-500/80 block mt-2">Active trial stores (3 days)</span>
          </div>

          <div className="bg-[#0b0b0b] p-4 rounded-3xl border border-white/5 relative overflow-hidden">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
              {lang === "my" ? "လိုင်စင်ကုန်ဆုံးသွားသောဆိုင်များ" : "Expired Licenses"}
            </p>
            <h3 className="text-3xl font-black text-rose-500 font-display">{stats.expired}</h3>
            <span className="text-[9px] font-bold text-rose-500/80 block mt-2">Suspended access</span>
          </div>
        </div>

        {/* Global Toast Alerts */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
            <ShieldCheck size={16} /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
            <ShieldAlert size={16} /> {errorMsg}
          </div>
        )}

        {/* Clients list management */}
        <div className="bg-[#0b0b0b] rounded-[2rem] border border-white/5 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white font-display">
                {lang === "my" ? "လိုင်စင်စီမံခန့်ခွဲမှု စာရင်း" : "SaaS Client Subscription Management"}
              </h3>
              <p className="text-[10px] text-slate-500">
                {lang === "my" ? "စတိုးဆိုင်များအားလုံး၏ လိုင်စင်သက်တမ်းနှင့် အချက်အလက်များကို ဤနေရာတွင် စီမံနိုင်သည်" : "Verify stores, extend licenses, or block access instantly"}
              </p>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/5 w-full sm:w-64">
              <Search className="text-slate-500 shrink-0" size={14} />
              <input
                type="text"
                placeholder={lang === "my" ? "ရှာဖွေရန်..." : "Search shop/username..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-600 flex-1"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs font-bold">
              <RefreshCw className="animate-spin text-indigo-400" size={24} />
              <span>Loading registered stores list from Firestore...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-bold border border-dashed border-white/5 rounded-2xl">
              No registered stores found matching "{searchTerm}".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="py-3 px-3">{lang === "my" ? "စတိုးဆိုင်အမည်" : "Store Name"}</th>
                    <th className="py-3 px-3">{lang === "my" ? "အကောင့်" : "Account (Owner)"}</th>
                    <th className="py-3 px-3">{lang === "my" ? "လိုင်စင်ကုန်ဆုံးရက်" : "Expiry Date"}</th>
                    <th className="py-3 px-3">{lang === "my" ? "အခြေအနေ" : "Status / Days Left"}</th>
                    <th className="py-3 px-3 text-right">{lang === "my" ? "လိုင်စင်သက်တမ်းတိုးရန် လုပ်ဆောင်ချက်များ" : "Subscription Control Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((u) => {
                    const expiry = u.expiryDate ? new Date(u.expiryDate) : null;
                    const created = u.createdAt ? new Date(u.createdAt) : null;
                    const now = new Date();
                    const isExpired = expiry ? expiry <= now : true;
                    
                    let daysLeft = 0;
                    if (expiry) {
                      const diffTime = expiry.getTime() - now.getTime();
                      daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }

                    // Check if it's on trial (expiry is within 4 days of creation)
                    let isTrial = false;
                    if (expiry && created) {
                      const totalDiff = expiry.getTime() - created.getTime();
                      const totalDays = Math.ceil(totalDiff / (1000 * 60 * 60 * 24));
                      if (totalDays <= 4 && !isExpired) {
                        isTrial = true;
                      }
                    }

                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition text-xs">
                        {/* Store name */}
                        <td className="py-4 px-3 font-semibold text-white">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200">{u.shopName}</span>
                            <span className="text-[10px] text-indigo-400 font-mono">ID: {u.shopId}</span>
                          </div>
                        </td>

                        {/* Account Owner */}
                        <td className="py-4 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-300">@{u.username}</span>
                            <span className="text-[10px] text-slate-500">
                              Joined: {created ? created.toLocaleDateString() : "Unknown"}
                            </span>
                          </div>
                        </td>

                        {/* Expiry date */}
                        <td className="py-4 px-3">
                          <div className="font-mono text-slate-300">
                            {expiry ? expiry.toLocaleDateString() : "No License"}
                            <span className="text-[10px] text-slate-500 block">
                              {expiry ? expiry.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                        </td>

                        {/* License Status */}
                        <td className="py-4 px-3">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                              <ShieldAlert size={10} /> Expired
                            </span>
                          ) : isTrial ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                              <Clock size={10} /> Free Trial ({daysLeft}d)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              <ShieldCheck size={10} /> Premium ({daysLeft}d)
                            </span>
                          )}
                        </td>

                        {/* Actions preset control */}
                        <td className="py-4 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {editingUserId === u.id ? (
                              <div className="flex items-center gap-1 bg-black/60 p-1.5 rounded-xl border border-white/10">
                                <input
                                  type="date"
                                  value={customExpiry}
                                  onChange={(e) => setCustomExpiry(e.target.value)}
                                  className="bg-[#121212] border border-white/10 text-xs text-white p-1 rounded-md outline-none"
                                />
                                <button
                                  onClick={() => {
                                    if (!customExpiry) return;
                                    const selectedDate = new Date(customExpiry);
                                    selectedDate.setHours(23, 59, 59, 999);
                                    handleUpdateExpiry(u.id, selectedDate);
                                  }}
                                  className="p-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition"
                                  title="Save custom expiry"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg transition text-[10px] font-bold px-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => extendDays(u.id, 3)}
                                  className="px-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/10 text-amber-400 font-bold text-[10px] rounded-lg transition cursor-pointer"
                                  title="Add 3 Days Free Trial"
                                >
                                  +3 Days
                                </button>
                                <button
                                  onClick={() => extendDays(u.id, 30)}
                                  className="px-2 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 text-indigo-400 font-bold text-[10px] rounded-lg transition cursor-pointer"
                                  title="Add 30 Days Premium License"
                                >
                                  +30 Days
                                </button>
                                <button
                                  onClick={() => extendDays(u.id, 365)}
                                  className="px-2 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/10 text-emerald-400 font-bold text-[10px] rounded-lg transition cursor-pointer"
                                  title="Add 1 Year License"
                                >
                                  +1 Year
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingUserId(u.id);
                                    const d = expiry ? expiry.toISOString().split("T")[0] : "";
                                    setCustomExpiry(d);
                                  }}
                                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold text-[10px] rounded-lg transition cursor-pointer"
                                >
                                  Custom
                                </button>
                                {!isExpired && (
                                  <button
                                    onClick={() => suspendLicense(u.id)}
                                    className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/10 text-rose-400 font-bold text-[10px] rounded-lg transition cursor-pointer"
                                    title="Suspend User Store Access"
                                  >
                                    Suspend
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
