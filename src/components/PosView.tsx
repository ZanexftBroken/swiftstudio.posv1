import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, Search, Plus, Trash2, User, ChevronDown, 
  ShoppingCart, Landmark, Wallet, CreditCard, Truck, RefreshCw, Layers
} from "lucide-react";
import { db } from "../firebase";
import { collection, doc, writeBatch, serverTimestamp, increment } from "firebase/firestore";
import { Product, CartItem, Customer, ShopSettings } from "../types";
import { getTheme } from "../lib/theme";
import { translations, Language } from "../lib/translations";

interface PosViewProps {
  allProducts: Product[];
  shopId: string;
  shopName: string;
  shopSettings: ShopSettings;
  customers: Customer[];
  heldOrdersCount: number;
  lang?: Language;
  onCheckoutSuccess: () => void;
  onHoldOrder: (cart: CartItem[]) => void;
  onViewHeld: () => void;
  onClose: () => void;
}

export default function PosView({
  allProducts,
  shopId,
  shopName,
  shopSettings,
  customers,
  heldOrdersCount,
  lang = "en",
  onCheckoutSuccess,
  onHoldOrder,
  onViewHeld,
  onClose,
}: PosViewProps) {
  const t = translations[lang];
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const theme = useMemo(() => getTheme(shopSettings.theme), [shopSettings.theme]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("Walk-in");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [globalTax, setGlobalTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [priceTypeGlobal, setPriceTypeGlobal] = useState<"retail" | "wholesale">("retail");
  
  // UI Tabs / Filters
  const [posTab, setPosTab] = useState<"grid" | "thrift">("grid");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Manual/Thrift entry state
  const [manualSku, setManualSku] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState(0);
  const [manualQty, setManualQty] = useState(1);
  const [manualDisc, setManualDisc] = useState(0);
  const [manualPriceType, setManualPriceType] = useState<"retail" | "wholesale">("retail");
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);

  // Derive categories from products
  const categories = useMemo(() => {
    const list = new Set(allProducts.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(list)];
  }, [allProducts]);

  // Filter products for grid
  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (selectedCategory !== "All") {
      result = result.filter((p) => p.category === selectedCategory);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.sku.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [allProducts, selectedCategory, searchTerm]);

  // Listen to manual sku input to autofill name & price
  useEffect(() => {
    const term = manualSku.toLowerCase().trim();
    if (!term) return;
    const matched = allProducts.find(
      (p) => p.sku.toLowerCase() === term || p.id.toLowerCase() === term
    );
    if (matched) {
      setManualName(matched.name);
      setManualPrice(
        manualPriceType === "wholesale"
          ? matched.wholesalePrice || matched.retailPrice
          : matched.retailPrice
      );
    }
  }, [manualSku, manualPriceType, allProducts]);

  // Calculate cart subtotal (using price type and item values)
  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let totalCost = 0;
    cart.forEach((item) => {
      // If priceTypeGlobal is wholesale, verify item price is set to wholesale if original exists
      const originalProduct = allProducts.find((p) => p.id === item.id);
      let activePrice = item.price;
      if (originalProduct) {
        activePrice =
          priceTypeGlobal === "wholesale"
            ? originalProduct.wholesalePrice || originalProduct.retailPrice
            : originalProduct.retailPrice;
      }
      const itemSub = activePrice * item.qty - (activePrice * item.qty * item.disc) / 100;
      subtotal += itemSub;
      totalCost += (item.costPrice || 0) * item.qty;
    });

    const discountAmount = (subtotal * globalDiscount) / 100;
    const subAfterDiscount = subtotal - discountAmount;
    const taxAmount = (subAfterDiscount * globalTax) / 100;
    const finalTotal = subAfterDiscount + taxAmount;

    return {
      subtotal,
      totalCost,
      discountAmount,
      taxAmount,
      finalTotal,
    };
  }, [cart, globalDiscount, globalTax, priceTypeGlobal, allProducts]);

  // Add standard product to cart
  const addToCart = (prod: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.id === prod.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      const price =
        priceTypeGlobal === "wholesale"
          ? prod.wholesalePrice || prod.retailPrice
          : prod.retailPrice;
      return [
        ...prev,
        {
          id: prod.id,
          sku: prod.sku || "-",
          name: prod.name,
          qty: 1,
          price,
          costPrice: prod.costPrice || 0,
          disc: 0,
        },
      ];
    });
  };

  // Add custom manual entry item
  const handleAddManualItem = () => {
    if (!manualName || manualPrice <= 0) {
      alert(lang === "my" ? "ကုန်ပစ္စည်းအမည်နှင့် စျေးနှုန်း ထည့်သွင်းပေးရန် လိုအပ်ပါသည်!" : "Product name and price are required!");
      return;
    }

    const matchedProduct = allProducts.find(
      (p) => p.sku === manualSku || p.name === manualName
    );

    const newItem: CartItem = {
      id: matchedProduct ? matchedProduct.id : "custom-" + Date.now(),
      sku: manualSku || "-",
      name: manualName,
      qty: manualQty,
      price: manualPrice,
      costPrice: matchedProduct ? matchedProduct.costPrice : 0,
      disc: manualDisc,
    };

    setCart((prev) => [...prev, newItem]);

    // Reset manual form
    setManualSku("");
    setManualName("");
    setManualPrice(0);
    setManualQty(1);
    setManualDisc(0);
    setSkuDropdownOpen(false);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHold = () => {
    if (cart.length === 0) return;
    onHoldOrder(cart);
    setCart([]);
  };

  // Checkout core operation
  const handleCheckout = async (printType: "A5" | "Slip") => {
    if (cart.length === 0) {
      alert(lang === "my" ? "စျေးဝယ်လှည်းထဲတွင် ကုန်ပစ္စည်း မရှိသေးပါ။" : "No items in cart.");
      return;
    }

    const customerObj = customers.find((c) => c.id === selectedCustomerId);
    const customerName = customerObj ? customerObj.name : "Walk-in Customer";

    try {
      const batch = writeBatch(db);

      // Create Sale Record
      const salesRef = doc(collection(db, "shops", shopId, "sales"));
      const saleData = {
        items: cart,
        subTotal: cartTotals.subtotal,
        totalCost: cartTotals.totalCost,
        discount: globalDiscount,
        tax: globalTax,
        total: cartTotals.finalTotal,
        profit: cartTotals.finalTotal - cartTotals.totalCost,
        paymentMethod,
        codStatus: paymentMethod === "COD" ? "Pending" : null,
        customerId: selectedCustomerId === "Walk-in" ? null : selectedCustomerId,
        customerName,
        createdAt: serverTimestamp(),
      };
      batch.set(salesRef, saleData);

      // Decrement Inventory
      cart.forEach((item) => {
        if (!item.id.startsWith("custom-")) {
          const productRef = doc(db, "shops", shopId, "products", item.id);
          batch.update(productRef, {
            quantity: increment(-item.qty),
          });
        }
      });

      // Update Customer accounts (Debt points)
      if (selectedCustomerId !== "Walk-in") {
        const customerRef = doc(db, "shops", shopId, "customers", selectedCustomerId);
        if (paymentMethod === "Credit") {
          batch.update(customerRef, {
            debt: increment(cartTotals.finalTotal),
            points: increment(Math.floor(cartTotals.finalTotal / 100)),
          });
        } else {
          batch.update(customerRef, {
            points: increment(Math.floor(cartTotals.finalTotal / 100)),
          });
        }
      }

      await batch.commit();

      // Trigger standard receipt printing window
      printReceipt(cart, cartTotals.finalTotal, customerName, printType);

      // Reset cart and states
      setCart([]);
      setGlobalDiscount(0);
      setGlobalTax(0);
      setMobileCartOpen(false);
      onCheckoutSuccess();
      alert(lang === "my" ? "ငွေရှင်းပြီးပါပြီ။" : "Checkout successful!");
    } catch (e: any) {
      alert((lang === "my" ? "အမှားအယွင်းရှိပါသည်- " : "Error: ") + e.message);
    }
  };

  // Print system helper
  const printReceipt = (
    items: CartItem[],
    total: number,
    customer: string,
    type: "A5" | "Slip"
  ) => {
    const isA5 = type === "A5";
    const dateStr = new Date().toLocaleString();
    
    let html = `
      <div style="font-family: sans-serif; padding: ${isA5 ? '30px' : '10px 5px'}; max-width: ${isA5 ? '148mm' : '58mm'}; margin: 0 auto; color: black; background: white;">
        <center>
          <h2 style="margin: 0; text-transform: uppercase; font-size: ${isA5 ? '24px' : '16px'}; font-weight: 900;">${shopName}</h2>
          <p style="font-size: ${isA5 ? '12px' : '10px'}; margin: 3px 0;">
            ${shopSettings.address || ''}<br>${shopSettings.phone || ''}
          </p>
          <p style="font-size: ${isA5 ? '12px' : '10px'}; color: #666; margin: 4px 0;">${dateStr}</p>
          <p style="font-size: ${isA5 ? '14px' : '10px'}; margin: 5px 0;">ဝယ်သူ- <b>${customer}</b></p>
          <hr style="border-top: 1px dashed #000; margin: 10px 0;">
        </center>
        <table style="width: 100%; font-size: ${isA5 ? '14px' : '12px'}; border-collapse: collapse;">
    `;

    if (isA5) {
      html += `
        <tr style="border-bottom: 1px solid #000;">
          <th align="left" style="padding: 5px 0;">Item</th>
          <th align="center">Qty</th>
          <th align="right">Price</th>
          <th align="right">Total</th>
        </tr>
      `;
    }

    items.forEach((item) => {
      const originalProduct = allProducts.find((p) => p.id === item.id);
      let activePrice = item.price;
      if (originalProduct) {
        activePrice =
          priceTypeGlobal === "wholesale"
            ? originalProduct.wholesalePrice || originalProduct.retailPrice
            : originalProduct.retailPrice;
      }
      const itemSub = activePrice * item.qty - (activePrice * item.qty * item.disc) / 100;
      if (isA5) {
        html += `
          <tr>
            <td style="padding: 8px 0;">${item.name} ${item.disc > 0 ? `<br><small>(-${item.disc}%)</small>` : ""}</td>
            <td align="center">${item.qty}</td>
            <td align="right">${activePrice.toLocaleString()}</td>
            <td align="right"><b>${itemSub.toLocaleString()}</b></td>
          </tr>
        `;
      } else {
        html += `
          <tr>
            <td style="padding: 4px 0; max-width: 120px;">${item.name} x${item.qty} ${item.disc > 0 ? `<small>(-${item.disc}%)</small>` : ""}</td>
            <td align="right">${itemSub.toLocaleString()}</td>
          </tr>
        `;
      }
    });

    html += `
        </table>
        <hr style="border-top: 1px dashed #000; margin: 10px 0;">
        <h3 align="right" style="margin: 0; font-size: ${isA5 ? '20px' : '16px'}; font-weight: 900;">စုစုပေါင်း: ${total.toLocaleString()} Ks</h3>
        <p align="right" style="font-size: ${isA5 ? '14px' : '10px'}; margin: 4px 0;">(${paymentMethod})</p>
        <center>
          <p style="font-size: ${isA5 ? '14px' : '10px'}; margin-top: 30px;">${shopSettings.footer || 'ကျေးဇူးတင်ပါသည်ခင်ဗျာ။'}</p>
        </center>
      </div>
    `;

    // Open printing window or hidden iframe fallback
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);
    
    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.write(`
        <html>
          <head>
            <title>Print Receipt</title>
            <style>
              @media print {
                body { margin: 0; background: white; }
              }
            </style>
          </head>
          <body onload="window.print();">
            ${html}
          </body>
        </html>
      `);
      frameDoc.close();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col lg:flex-row overflow-hidden relative ${theme.bgOuter} ${theme.isLight ? "text-slate-800" : "text-slate-200"} font-sans`}>
      {/* Background Glow Effect */}
      <div className={`absolute top-0 right-0 -mr-40 -mt-40 w-96 h-96 ${theme.glow1} blur-[120px] rounded-full pointer-events-none`}></div>
      <div className={`absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 ${theme.glow2} blur-[100px] rounded-full pointer-events-none`}></div>

      {/* Product/Search Section */}
      <div className={`flex-1 flex flex-col h-full relative overflow-hidden border-r ${theme.border} z-10`}>
        {/* Top bar */}
        <div className={`${theme.isLight ? "bg-slate-100/50" : "bg-black/20"} backdrop-blur-md border-b ${theme.border} p-4 flex items-center gap-4 shrink-0 justify-between`}>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={`w-10 h-10 ${theme.isLight ? "bg-slate-200/50 border-slate-300 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"} border rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer`}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="bg-white/5 border border-white/10 p-1 rounded-xl flex gap-1">
              <button
                onClick={() => setPosTab("grid")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  posTab === "grid"
                    ? `bg-gradient-to-r ${theme.gradientBtn} text-white shadow-md`
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {lang === "my" ? "ကုန်ပစ္စည်းများ" : "Products"}
              </button>
              <button
                onClick={() => setPosTab("thrift")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  posTab === "thrift"
                    ? `bg-gradient-to-r ${theme.gradientBtn} text-white shadow-md`
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {lang === "my" ? "ကိုယ်တိုင်ထည့်သွင်းမှု" : "Manual Entry"}
              </button>
            </div>
          </div>
          {posTab === "grid" && (
            <div className="flex-1 max-w-xs relative hidden sm:block">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                className={`w-full pl-9 pr-4 py-2 bg-white/5 border ${theme.border} ${theme.isLight ? "text-slate-800" : "text-white"} rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600`}
              />
            </div>
          )}
        </div>

        {/* Tab - Product Grid */}
        {posTab === "grid" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category selection */}
            <div className={`bg-black/10 border-b ${theme.border} shrink-0 py-3 px-4 overflow-x-auto no-scrollbar flex gap-2`}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? `bg-gradient-to-r ${theme.gradient} text-white shadow-md`
                      : `${theme.isLight ? "bg-slate-200/50 border-slate-300 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"} border hover:opacity-85`
                  }`}
                >
                  {cat === "All" ? (lang === "my" ? "အားလုံး" : "All") : cat}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 lg:p-4 no-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((p) => {
                  const isLow = p.quantity <= (p.lowStockThreshold || 5);
                  return (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="bg-[#0a0a0a]/80 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden cursor-pointer active:scale-95 flex flex-col relative group shadow-sm hover:shadow-lg hover:border-indigo-500/30 transition-all p-3 pb-4"
                    >
                      <div className="h-24 bg-white/5 rounded-2xl flex items-center justify-center mb-3 relative overflow-hidden group-hover:bg-white/10 transition">
                        <Layers size={36} className="text-slate-600 group-hover:text-indigo-400 transition" />
                        {p.category && (
                          <span className="absolute top-2 left-2 bg-black/80 text-[9px] font-black px-2 py-0.5 rounded-lg text-slate-400 border border-white/5">
                            {p.category}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Plus size={24} className="text-indigo-400" />
                        </div>
                      </div>
                      <div className="text-xs font-bold leading-tight mb-2 text-white line-clamp-2 h-8 font-display">
                        {p.name}
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <div className="text-indigo-400 font-black text-sm font-display">
                          {(p.retailPrice || 0).toLocaleString()}{" "}
                          <span className="text-[9px] font-bold text-slate-500 font-display">Ks</span>
                        </div>
                        <div
                          className={`text-[9px] px-2 py-0.5 rounded-lg border font-bold ${
                            isLow
                              ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                              : "text-slate-400 bg-white/5 border-white/10"
                          }`}
                        >
                          {p.quantity}{lang === "my" ? "ခုကျန်" : " left"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab - Manual entry */}
        {posTab === "thrift" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 bg-[#0a0a0a]/90 backdrop-blur-md m-4 rounded-3xl border border-white/5 shadow-2xl max-w-xl mx-auto w-[92%] relative z-10">
            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 font-display">
              <ShoppingCart size={22} className="text-indigo-400" /> {lang === "my" ? "ကုန်ပစ္စည်း ကိုယ်တိုင်ထည့်သွင်းခြင်း" : "Manual Item Entry"}
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">{t.barcodeSku}</label>
                <input
                  type="text"
                  value={manualSku}
                  onChange={(e) => setManualSku(e.target.value)}
                  placeholder={lang === "my" ? "Barcode သို့မဟုတ် ကုဒ်ရိုက်ပါ..." : "Enter barcode or SKU..."}
                  className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">{lang === "my" ? "ကုန်ပစ္စည်းအမည်" : "Product Name"}</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder={lang === "my" ? "ပစ္စည်းအမည်..." : "Item name..."}
                  className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">{lang === "my" ? "စျေးနှုန်းအမျိုးအစား" : "Price Type"}</label>
                  <select
                    value={manualPriceType}
                    onChange={(e) => setManualPriceType(e.target.value as any)}
                    className="w-full p-3.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500/50 cursor-pointer transition"
                  >
                    <option value="retail" className="bg-[#0a0a0a]">{lang === "my" ? "လက်လီ (Retail)" : "Retail"}</option>
                    <option value="wholesale" className="bg-[#0a0a0a]">{lang === "my" ? "လက်ကား (Wholesale)" : "Wholesale"}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">{lang === "my" ? "စျေးနှုန်း (Ks)" : "Price (Ks)"}</label>
                  <input
                    type="number"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-3.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">{lang === "my" ? "အရေအတွက်" : "Quantity"}</label>
                  <input
                    type="number"
                    value={manualQty}
                    onChange={(e) => setManualQty(parseInt(e.target.value) || 1)}
                    className="w-full p-3.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">{lang === "my" ? "လျှော့စျေး (%)" : "Discount (%)"}</label>
                  <input
                    type="number"
                    value={manualDisc}
                    onChange={(e) => setManualDisc(parseFloat(e.target.value) || 0)}
                    className="w-full p-3.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleAddManualItem}
                  className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 active:scale-95 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all text-sm cursor-pointer"
                >
                  {lang === "my" ? "စျေးဝယ်လှည်းထဲသို့ ထည့်မည်" : "Add to Cart"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile floating Cart Bar */}
        <div className="lg:hidden fixed bottom-20 left-4 right-4 z-30">
          <button
            onClick={() => setMobileCartOpen(true)}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-xl shadow-indigo-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center relative border border-white/10">
                <ShoppingCart size={18} />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-indigo-600">
                    {cart.length}
                  </span>
                )}
              </div>
              <div className="text-left">
                <p className="text-[9px] font-semibold text-indigo-100 uppercase">{lang === "my" ? "စုစုပေါင်းပမာဏ" : "Total Amount"}</p>
                <p className="font-black text-base font-display">{cartTotals.finalTotal.toLocaleString()} Ks</p>
              </div>
            </div>
            <div className="flex items-center gap-1 font-bold text-xs bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
              {lang === "my" ? "လှည်းကြည့်မည်" : "View Cart"} <ChevronDown size={14} className="rotate-270" />
            </div>
          </button>
        </div>
      </div>

      {/* Cart Sidebar (Desktop/Mobile overlay) */}
      <div
        className={`fixed lg:static inset-y-0 right-0 z-40 w-[90%] sm:w-[400px] lg:w-[380px] xl:w-[420px] bg-[#0a0a0a] border-l border-white/5 shadow-2xl lg:shadow-none transform ${
          mobileCartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        } transition-transform duration-300 flex flex-col h-full`}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a] shrink-0">
          <h2 className="text-base font-black text-white flex items-center gap-2 font-display">
            <ShoppingCart size={18} className="text-indigo-400" /> {lang === "my" ? "လတ်တလော အော်ဒါ" : "Current Order"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleHold}
              title={lang === "my" ? "ခေတ္တရပ်ဆိုင်းထားမည်" : "Hold voucher"}
              className="px-2.5 py-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition cursor-pointer"
            >
              {lang === "my" ? "ခဏရပ်" : "Hold"}
            </button>
            <button
              onClick={onViewHeld}
              className="px-2.5 py-1.5 text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-xl hover:bg-indigo-500/20 transition relative cursor-pointer"
            >
              {lang === "my" ? "မှတ်တမ်း" : "Vouchers"}
              {heldOrdersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {heldOrdersCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setCart([])}
              className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/20 transition cursor-pointer"
            >
              {lang === "my" ? "ဖျက်မည်" : "Clear"}
            </button>
            <button
              onClick={() => setMobileCartOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:bg-white/5 border border-white/10 rounded-xl cursor-pointer"
            >
              {lang === "my" ? "ပိတ်" : "Close"}
            </button>
          </div>
        </div>

        {/* Customer & global wholesale toggle */}
        <div className="p-4 border-b border-white/5 bg-black/10 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-2.5 rounded-xl border border-white/10 shadow-sm">
            <User className="text-slate-400" size={16} />
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-slate-200 cursor-pointer"
            >
              <option value="Walk-in" className="bg-[#0a0a0a] text-slate-200">{lang === "my" ? "ဆိုင်လာဝယ်သူ" : "Walk-in Customer"}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0a0a0a] text-slate-200">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] font-black text-slate-400">
            <span>{lang === "my" ? "စျေးနှုန်းအမျိုးအစား-" : "Price Tier-"}</span>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="price_type_global"
                  value="retail"
                  checked={priceTypeGlobal === "retail"}
                  onChange={() => setPriceTypeGlobal("retail")}
                  className="accent-indigo-500"
                />{" "}
                {lang === "my" ? "လက်လီ" : "Retail"}
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="price_type_global"
                  value="wholesale"
                  checked={priceTypeGlobal === "wholesale"}
                  onChange={() => setPriceTypeGlobal("wholesale")}
                  className="accent-indigo-500"
                />{" "}
                {lang === "my" ? "လက်ကား" : "Wholesale"}
              </label>
            </div>
          </div>
        </div>

        {/* Cart Item list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/5 no-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
              <ShoppingCart size={40} className="mb-2" />
              <p className="text-xs font-bold">{lang === "my" ? "စျေးဝယ်လှည်း အလွတ်ဖြစ်နေပါသည်" : "Cart is empty"}</p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const originalProduct = allProducts.find((p) => p.id === item.id);
              let activePrice = item.price;
              if (originalProduct) {
                activePrice =
                  priceTypeGlobal === "wholesale"
                    ? originalProduct.wholesalePrice || originalProduct.retailPrice
                    : originalProduct.retailPrice;
              }
              const sub = activePrice * item.qty - (activePrice * item.qty * item.disc) / 100;
              return (
                <div
                  key={idx}
                  className="flex justify-between items-start bg-white/5 border border-white/5 p-3 rounded-2xl shadow-sm"
                >
                  <div className="flex gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-white shrink-0">
                      x{item.qty}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-200 line-clamp-2 leading-tight mb-1 font-display">
                        {item.name}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">
                        {activePrice.toLocaleString()} Ks{" "}
                        {item.disc > 0 && (
                          <span className="text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/10">
                            -{item.disc}%
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-xs font-black text-white font-display">{sub.toLocaleString()}</p>
                    <button
                      onClick={() => removeFromCart(idx)}
                      className="text-rose-400 hover:text-rose-500 bg-rose-500/10 border border-rose-500/10 p-1.5 rounded-lg cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pricing Actions */}
        <div className="p-4 bg-[#0a0a0a] border-t border-white/5 shadow-md shrink-0">
          <div className="mb-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">{lang === "my" ? "ငွေပေးချေမှုနည်းလမ်း" : "Payment Method"}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Cash", icon: <Wallet size={12} /> },
                { label: "KPay", icon: <Landmark size={12} /> },
                { label: "WavePay", icon: <Wallet size={12} /> },
                { label: "AYA Pay", icon: <Landmark size={12} /> },
                { label: "Credit", icon: <CreditCard size={12} /> },
                { label: "COD", icon: <Truck size={12} /> },
              ].map((pm) => (
                <button
                  key={pm.label}
                  onClick={() => setPaymentMethod(pm.label)}
                  className={`py-2 px-1 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                    paymentMethod === pm.label
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-none"
                      : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {pm.icon}
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400">Discount%</span>
              <input
                type="number"
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                className="w-10 text-right bg-transparent text-xs font-black text-white outline-none"
              />
            </div>
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2 flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400">Tax%</span>
              <input
                type="number"
                value={globalTax}
                onChange={(e) => setGlobalTax(parseFloat(e.target.value) || 0)}
                className="w-10 text-right bg-transparent text-xs font-black text-white outline-none"
              />
            </div>
          </div>

          {/* Totals Summary */}
          <div className="space-y-1 text-xs font-semibold mb-4 border-t border-white/5 pt-3">
            <div className="flex justify-between text-slate-400 font-display">
              <span>{lang === "my" ? "စုစုပေါင်း" : "Subtotal"}</span>
              <span>{cartTotals.subtotal.toLocaleString()} Ks</span>
            </div>
            {cartTotals.discountAmount > 0 && (
              <div className="flex justify-between text-rose-400 font-display">
                <span>{lang === "my" ? "လျှော့စျေး" : "Discount"}</span>
                <span>-{cartTotals.discountAmount.toLocaleString()} Ks</span>
              </div>
            )}
            <div className="flex justify-between items-end border-t border-white/5 pt-2">
              <span className="text-xs font-black text-slate-300">{lang === "my" ? "ကျသင့်ငွေ" : "TOTAL"}</span>
              <span className="text-xl font-black text-indigo-400 font-display font-display">
                {cartTotals.finalTotal.toLocaleString()} Ks
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleCheckout("A5")}
              className="bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 font-bold py-3.5 rounded-xl text-xs transition cursor-pointer"
            >
              Print A5
            </button>
            <button
              onClick={() => handleCheckout("Slip")}
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 active:scale-95 text-white font-black py-3.5 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              {lang === "my" ? "ငွေရှင်းမည်" : "Checkout"}
            </button>
          </div>
        </div>
      </div>

      {/* Overlay background on mobile */}
      {mobileCartOpen && (
        <div
          onClick={() => setMobileCartOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-xs z-30"
        />
      )}
    </div>
  );
}
