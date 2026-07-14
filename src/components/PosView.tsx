import React, { useState, useEffect, useMemo } from "react";
import { 
  ArrowLeft, Search, Plus, Trash2, User, ChevronDown, 
  ShoppingCart, Landmark, Wallet, CreditCard, Truck, RefreshCw, Layers,
  Share2, Printer, CheckCircle2, Tag, X, AlertTriangle, Camera, QrCode
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
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
  
  // Advanced features state
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<{ method: string; amount: number }[]>([
    { method: "Cash", amount: 0 },
    { method: "KPay", amount: 0 },
    { method: "WavePay", amount: 0 },
    { method: "Card", amount: 0 },
  ]);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: "percent" | "fixed"; value: number } | null>(null);
  
  // Checkout Success Screen & Receipt state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<any | null>(null);

  // Scan alerts state
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanIsError, setScanIsError] = useState(false);

  // UI Tabs / Filters
  const [posTab, setPosTab] = useState<"grid" | "thrift">("grid");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

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

  // Filter products for grid (including variants)
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
          p.sku.toLowerCase().includes(lower) ||
          (p.variants && p.variants.some((v) => v.name.toLowerCase().includes(lower) || v.sku.toLowerCase().includes(lower)))
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

  // Calculate cart subtotal (using price type and item values, plus applied coupons)
  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let totalCost = 0;
    cart.forEach((item) => {
      // The item price is stored when added (supports custom variants or manual edits)
      const activePrice = item.price;
      const itemSub = activePrice * item.qty - (activePrice * item.qty * item.disc) / 100;
      subtotal += itemSub;
      totalCost += (item.costPrice || 0) * item.qty;
    });

    const discountAmount = (subtotal * globalDiscount) / 100;
    
    // Add coupon discount
    let couponDiscountAmount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.type === "percent") {
        couponDiscountAmount = (subtotal * appliedCoupon.value) / 100;
      } else {
        couponDiscountAmount = appliedCoupon.value;
      }
    }

    const totalDiscountAmount = discountAmount + couponDiscountAmount;
    const subAfterDiscount = Math.max(0, subtotal - totalDiscountAmount);
    const taxAmount = (subAfterDiscount * globalTax) / 100;
    const finalTotal = Math.max(0, subAfterDiscount + taxAmount);

    return {
      subtotal,
      totalCost,
      discountAmount: totalDiscountAmount,
      taxAmount,
      finalTotal,
    };
  }, [cart, globalDiscount, globalTax, priceTypeGlobal, allProducts, appliedCoupon]);

  // Add standard product to cart, check for variants first
  const addToCart = (prod: Product) => {
    if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
      setSelectedProductForVariant(prod);
      return;
    }
    addProductToCartDirectly(prod, null);
  };

  const addProductToCartDirectly = (prod: Product, variant: any | null) => {
    setCart((prev) => {
      const itemId = variant ? `${prod.id}_${variant.id}` : prod.id;
      const existing = prev.find((i) => i.id === itemId);
      if (existing) {
        return prev.map((i) =>
          i.id === itemId ? { ...i, qty: i.qty + 1 } : i
        );
      }
      
      let price = 0;
      if (variant) {
        price = priceTypeGlobal === "wholesale" ? variant.wholesalePrice : variant.retailPrice;
      } else {
        price = priceTypeGlobal === "wholesale"
          ? prod.wholesalePrice || prod.retailPrice
          : prod.retailPrice;
      }

      return [
        ...prev,
        {
          id: itemId,
          sku: variant ? variant.sku : (prod.sku || "-"),
          name: variant ? `${prod.name} (${variant.name})` : prod.name,
          qty: 1,
          price,
          costPrice: prod.costPrice || 0,
          disc: 0,
          variantId: variant ? variant.id : undefined,
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

  const handleApplyCoupon = () => {
    const code = couponCode.toUpperCase().trim();
    if (!code) return;
    
    let coupon: any = null;
    if (code === "WELCOME10") coupon = { code, type: "percent", value: 10 };
    else if (code === "SWIFT50") coupon = { code, type: "percent", value: 50 };
    else if (code === "VIP20") coupon = { code, type: "percent", value: 20 };
    else if (code === "PROMO1000") coupon = { code, type: "fixed", value: 1000 };
    
    if (coupon) {
      setAppliedCoupon(coupon);
      setCouponCode("");
      alert(lang === "my" ? "ပရိုမိုးရှင်းကုဒ် အောင်မြင်စွာထည့်သွင်းပြီးပါပြီ။" : "Coupon code applied successfully!");
    } else {
      alert(lang === "my" ? "မှားယွင်းနေပါသည်" : "Invalid coupon code");
    }
  };

  const handleShareReceipt = () => {
    if (!lastCompletedSale) return;
    const itemsStr = lastCompletedSale.items.map((i: any) => `- ${i.name} x${i.qty} (${i.price.toLocaleString()} Ks)`).join("\n");
    const text = `🧾 Swift POS - Shop Voucher\n` +
      `Shop: ${shopName}\n` +
      `Voucher ID: ${lastCompletedSale.id}\n` +
      `Customer: ${lastCompletedSale.customerName}\n` +
      `-------------------------\n` +
      `${itemsStr}\n` +
      `-------------------------\n` +
      `Subtotal: ${lastCompletedSale.subTotal.toLocaleString()} Ks\n` +
      `Discount: ${lastCompletedSale.discount.toLocaleString()} Ks\n` +
      `TOTAL: ${lastCompletedSale.total.toLocaleString()} Ks\n` +
      `Paid via: ${lastCompletedSale.paymentMethod}\n` +
      `Thank you for shopping with us!`;
    
    navigator.clipboard.writeText(text);
    alert(lang === "my" ? "ဘောက်ချာအချက်အလက်များကို Copy ကူးယူပြီးပါပြီ။ Viber သို့မဟုတ် Messenger တွင် Share နိုင်ပါပြီ။" : "Voucher copied to clipboard! Ready to share on Viber/Messenger.");
  };

  // Barcode Scanner helper functions and Sound synthesizers
  const playScanSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High-pitched beep
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (err) {
      // AudioContext blocked
    }
  };

  const showScanIndicator = (msg: string, isErr = false) => {
    setScanMessage(msg);
    setScanIsError(isErr);
    setTimeout(() => {
      setScanMessage(null);
    }, 2000);
  };

  const handleBarcodeScanned = (scanned: string) => {
    const lower = scanned.toLowerCase().trim();
    let foundProduct: Product | null = null;
    let foundVariant: any | null = null;

    for (const p of allProducts) {
      if (p.sku && p.sku.toLowerCase() === lower) {
        foundProduct = p;
        break;
      }
      if (p.variants) {
        const v = p.variants.find((vt) => vt.sku && vt.sku.toLowerCase() === lower);
        if (v) {
          foundProduct = p;
          foundVariant = v;
          break;
        }
      }
    }

    if (foundProduct) {
      if (foundVariant) {
        addProductToCartDirectly(foundProduct, foundVariant);
        playScanSound();
        showScanIndicator(`${foundProduct.name} (${foundVariant.name})`);
      } else {
        if (foundProduct.hasVariants && foundProduct.variants && foundProduct.variants.length > 0) {
          setSelectedProductForVariant(foundProduct);
          playScanSound();
          showScanIndicator(`${foundProduct.name} - Choose variant`);
        } else {
          addProductToCartDirectly(foundProduct, null);
          playScanSound();
          showScanIndicator(foundProduct.name);
        }
      }
    } else {
      showScanIndicator(lang === "my" ? "ပစ္စည်းရှာမတွေ့ပါ" : "Barcode not found", true);
    }
  };

  // Global Barcode Keypress Listener (Plug-and-Play)
  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Do not intercept keystrokes inside other text inputs unless it's the search input or body
      if (
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") &&
        !target.classList.contains("barcode-receiver")
      ) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = "";
      }

      if (e.key !== "Enter") {
        if (e.key.length === 1) {
          barcodeBuffer += e.key;
        }
      } else {
        if (barcodeBuffer.length >= 3) {
          const scanned = barcodeBuffer.trim();
          handleBarcodeScanned(scanned);
          barcodeBuffer = "";
          e.preventDefault();
        }
      }
      lastKeyTime = currentTime;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allProducts, priceTypeGlobal, lang]);

  const splitPaymentsSum = useMemo(() => {
    return splitPayments.reduce((sum, sp) => sum + sp.amount, 0);
  }, [splitPayments]);

  const remainingSplitBalance = useMemo(() => {
    return Math.max(0, cartTotals.finalTotal - splitPaymentsSum);
  }, [cartTotals.finalTotal, splitPaymentsSum]);

  // Checkout core operation
  const handleCheckout = async (printType: "A5" | "Slip") => {
    if (cart.length === 0) {
      alert(lang === "my" ? "စျေးဝယ်လှည်းထဲတွင် ကုန်ပစ္စည်း မရှိသေးပါ။" : "No items in cart.");
      return;
    }

    if (isSplitPayment && Math.abs(splitPaymentsSum - cartTotals.finalTotal) > 1) {
      alert(
        lang === "my"
          ? `ခွဲဝေထားသော ပမာဏစုစုပေါင်း (${splitPaymentsSum.toLocaleString()} Ks) သည် ကျသင့်ငွေ (${cartTotals.finalTotal.toLocaleString()} Ks) နှင့် တူညီရပါမည်။`
          : `Total allocated amount (${splitPaymentsSum.toLocaleString()} Ks) must match total payable (${cartTotals.finalTotal.toLocaleString()} Ks).`
      );
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
        discount: cartTotals.discountAmount,
        tax: globalTax,
        total: cartTotals.finalTotal,
        profit: cartTotals.finalTotal - cartTotals.totalCost,
        paymentMethod: isSplitPayment ? "Split" : paymentMethod,
        splitPayments: isSplitPayment ? splitPayments.filter((sp) => sp.amount > 0) : null,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        codStatus: paymentMethod === "COD" ? "Pending" : null,
        customerId: selectedCustomerId === "Walk-in" ? null : selectedCustomerId,
        customerName,
        createdAt: serverTimestamp(),
      };
      batch.set(salesRef, saleData);

      // Decrement Inventory (with Advanced Variant Support)
      cart.forEach((item) => {
        if (!item.id.startsWith("custom-")) {
          const parts = item.id.split("_");
          const prodId = parts[0];
          const varId = parts[1];
          const productRef = doc(db, "shops", shopId, "products", prodId);

          const matchedOriginal = allProducts.find((p) => p.id === prodId);
          if (matchedOriginal) {
            if (varId && matchedOriginal.variants) {
              const updatedVariants = matchedOriginal.variants.map((v) => {
                if (v.id === varId) {
                  return { ...v, quantity: Math.max(0, v.quantity - item.qty) };
                }
                return v;
              });
              const newTotalQty = updatedVariants.reduce((sum, v) => sum + v.quantity, 0);
              batch.update(productRef, {
                variants: updatedVariants,
                quantity: newTotalQty,
              });
            } else {
              batch.update(productRef, {
                quantity: increment(-item.qty),
              });
            }
          }
        }
      });

      // Update Customer accounts (Debt points)
      if (selectedCustomerId !== "Walk-in") {
        const customerRef = doc(db, "shops", shopId, "customers", selectedCustomerId);
        const debtIncrease = isSplitPayment 
          ? (splitPayments.find((sp) => sp.method === "Credit")?.amount || 0)
          : (paymentMethod === "Credit" ? cartTotals.finalTotal : 0);

        if (debtIncrease > 0) {
          batch.update(customerRef, {
            debt: increment(debtIncrease),
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

      // Set success sale for sharing and display
      const completedSale = {
        id: salesRef.id,
        items: cart,
        subTotal: cartTotals.subtotal,
        totalCost: cartTotals.totalCost,
        discount: cartTotals.discountAmount,
        tax: globalTax,
        total: cartTotals.finalTotal,
        paymentMethod: isSplitPayment ? "Split" : paymentMethod,
        splitPayments: isSplitPayment ? splitPayments.filter((sp) => sp.amount > 0) : null,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        customerName,
      };
      setLastCompletedSale(completedSale);
      setShowSuccessModal(true);
      
      // Reset cart and checkout states for next sale
      setCart([]);
      setGlobalDiscount(0);
      setGlobalTax(0);
      setAppliedCoupon(null);
      setIsSplitPayment(false);
      setSplitPayments([
        { method: "Cash", amount: 0 },
        { method: "KPay", amount: 0 },
        { method: "WavePay", amount: 0 },
        { method: "Card", amount: 0 },
      ]);
      setMobileCartOpen(false);
      onCheckoutSuccess();
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
            <div className="flex-1 max-w-[150px] sm:max-w-xs relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.searchPlaceholder}
                className={`w-full pl-9 pr-8 py-2 bg-white/5 border ${theme.border} ${theme.isLight ? "text-slate-800" : "text-white"} rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition placeholder:text-slate-600`}
              />
              <button
                onClick={() => setShowCameraScanner(true)}
                title={lang === "my" ? "ကင်မရာဖြင့် Barcode ဖတ်မည်" : "Scan Barcode via Camera"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
              >
                <Camera size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Tab - Product Grid */}
        {posTab === "grid" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category selection */}
            <div className={`bg-black/10 border-b ${theme.border} shrink-0 py-3 px-4 overflow-x-auto no-scrollbar flex items-center gap-2`}>
              <button
                onClick={() => setShowCameraScanner(true)}
                className="px-3 py-2 rounded-full text-xs font-black transition-all shrink-0 cursor-pointer bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md flex items-center gap-1.5"
              >
                <Camera size={14} />
                <span>{lang === "my" ? "Barcode ဖတ်မည်" : "Scan Barcode"}</span>
              </button>
              <div className="h-4 w-[1px] bg-white/10 shrink-0" />
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

        {/* Scrollable Container for Sidebar Contents (Fixes Mobile Checkout Overlap) */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between">
          <div className="p-4 space-y-4">
            {/* Customer & global wholesale toggle */}
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10 shadow-sm">
              <div className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded-xl border border-white/5 shadow-inner">
                <User className="text-slate-400" size={14} />
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
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-600 border border-white/5 border-dashed rounded-2xl">
                  <ShoppingCart size={32} className="mb-2 opacity-55" />
                  <p className="text-[11px] font-bold">{lang === "my" ? "စျေးဝယ်လှည်း အလွတ်ဖြစ်နေပါသည်" : "Cart is empty"}</p>
                </div>
              ) : (
                cart.map((item, idx) => {
                  const originalProduct = allProducts.find((p) => p.id === item.id.split("_")[0]);
                  const activePrice = item.price;
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

            {/* Coupons Promo Code Section */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === "my" ? "ပရိုမိုးရှင်းကုဒ်" : "Promo Coupons"}</span>
                {appliedCoupon && (
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/10 flex items-center gap-1">
                    <Tag size={10} /> {appliedCoupon.code} (-{appliedCoupon.value}{appliedCoupon.type === "percent" ? "%" : " Ks"})
                    <button onClick={() => setAppliedCoupon(null)} className="text-rose-400 hover:text-rose-500 font-bold ml-1">×</button>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={lang === "my" ? "WELCOME10, VIP20, PROMO1000..." : "Code e.g. WELCOME10..."}
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1 bg-[#0a0a0a] border border-white/10 text-white p-2 px-3 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500/50 uppercase"
                />
                <button
                  onClick={handleApplyCoupon}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-black px-4 rounded-xl text-xs transition cursor-pointer"
                >
                  {lang === "my" ? "ထည့်မည်" : "Apply"}
                </button>
              </div>
            </div>

            {/* Split Payment Section */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === "my" ? "စုပေါင်းငွေပေးချေမှု" : "Split Payment"}</span>
                  <p className="text-[9px] text-slate-500">{lang === "my" ? "နည်းလမ်းမျိုးစုံဖြင့် ပေါင်းပေးမည်" : "Pay with multiple methods"}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSplitPayment}
                    onChange={(e) => setIsSplitPayment(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>

              {isSplitPayment && (
                <div className="space-y-2 border-t border-white/5 pt-3">
                  {splitPayments.map((sp, idx) => (
                    <div key={sp.method} className="flex items-center justify-between gap-3 bg-black/10 p-2 rounded-xl border border-white/5">
                      <span className="text-xs font-bold text-slate-300">{sp.method}</span>
                      <div className="relative max-w-[140px]">
                        <input
                          type="number"
                          placeholder="0"
                          value={sp.amount || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setSplitPayments(prev => prev.map((item, i) => i === idx ? { ...item, amount: val } : item));
                          }}
                          className="w-full bg-white/5 border border-white/10 text-right text-xs font-black text-white p-1.5 px-2.5 rounded-lg outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    </div>
                  ))}
                  
                  {/* Split Validation Feedback */}
                  <div className="flex justify-between items-center text-[10px] font-black pt-2 border-t border-white/5">
                    <span className="text-slate-400">Allocated: {splitPaymentsSum.toLocaleString()} / {cartTotals.finalTotal.toLocaleString()} Ks</span>
                    {remainingSplitBalance > 0 ? (
                      <span className="text-rose-400">Remaining: {remainingSplitBalance.toLocaleString()} Ks</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">Balanced! ✓</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pricing Actions */}
          <div className="p-4 bg-[#0a0a0a] border-t border-white/5 shadow-md shrink-0">
            {!isSplitPayment && (
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
                          ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-none shadow-md"
                          : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {pm.icon}
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
      </div>

      {/* Overlay background on mobile */}
      {mobileCartOpen && (
        <div
          onClick={() => setMobileCartOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-xs z-30"
        />
      )}

      {/* ========================================================================= */}
      {/* ADVANCED MODALS & NOTIFICATIONS OVERLAYS */}
      {/* ========================================================================= */}

      {/* Barcode Scanner Indicator Alert Toast */}
      {scanMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border transition-all duration-300 ${
          scanIsError 
            ? "bg-rose-500 border-rose-500 text-white" 
            : "bg-emerald-500 border-emerald-500 text-white"
        }`}>
          <Tag size={16} />
          <span className="text-xs font-black">{scanMessage}</span>
        </div>
      )}

      {/* Product Variant Selection Modal */}
      {selectedProductForVariant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-black text-white mb-1 font-display">{selectedProductForVariant.name}</h3>
            <p className="text-xs text-slate-400 mb-4">{lang === "my" ? "အမျိုးအစား ရွေးချယ်ပါ" : "Choose a variant to add to cart"}</p>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar mb-6">
              {selectedProductForVariant.variants?.map((v) => {
                const isLow = v.quantity <= 3;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      addProductToCartDirectly(selectedProductForVariant, v);
                      setSelectedProductForVariant(null);
                      playScanSound();
                    }}
                    disabled={v.quantity <= 0}
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 p-3 rounded-2xl flex items-center justify-between transition group disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-white text-xs group-hover:text-indigo-400 transition">{v.name}</span>
                      <span className="text-[10px] text-slate-500 block">SKU: {v.sku}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-indigo-400 font-black text-xs block">
                          {(priceTypeGlobal === "wholesale" ? v.wholesalePrice : v.retailPrice).toLocaleString()} Ks
                        </span>
                        <span className={`text-[9px] font-bold ${isLow ? "text-rose-400" : "text-slate-400"}`}>
                          {v.quantity} {lang === "my" ? "ခုကျန်" : "left"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setSelectedProductForVariant(null)}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3.5 rounded-2xl text-xs font-black transition cursor-pointer"
            >
              {lang === "my" ? "မလုပ်တော့ပါ" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Checkout Success Screen & Receipt Sharing Modal */}
      {showSuccessModal && lastCompletedSale && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d0d0d] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            
            <h3 className="text-xl font-black text-white mb-1 font-display">
              {lang === "my" ? "ငွေရှင်းပြီးပါပြီ။" : "Checkout Successful!"}
            </h3>
            <p className="text-xs text-slate-400 mb-6">Voucher: #{lastCompletedSale.id.substring(0, 8)}</p>

            {/* Receipt Summary Box */}
            <div className="bg-white/5 rounded-2xl border border-white/5 p-4 text-left space-y-3 mb-6">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Customer:</span>
                <span className="text-white font-bold">{lastCompletedSale.customerName}</span>
              </div>
              <div className="border-t border-white/5 pt-2 max-h-[120px] overflow-y-auto no-scrollbar space-y-1">
                {lastCompletedSale.items.map((i: any, index: number) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-slate-300 truncate max-w-[200px]">{i.name} x{i.qty}</span>
                    <span className="text-white font-mono">{(i.price * i.qty).toLocaleString()} Ks</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/5 pt-2 flex justify-between items-end text-sm">
                <span className="text-indigo-400 font-bold">TOTAL:</span>
                <span className="text-indigo-400 font-black text-base font-display">{lastCompletedSale.total.toLocaleString()} Ks</span>
              </div>
            </div>

            {/* Print and Share buttons */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  printReceipt(lastCompletedSale.items, lastCompletedSale.total, lastCompletedSale.customerName, "Slip");
                }}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:brightness-110 text-white font-black py-3.5 rounded-2xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20"
              >
                <Printer size={16} />
                {lang === "my" ? "ဘောက်ချာ ထပ်မံထုတ်ယူမည်" : "Print Receipt"}
              </button>

              <button
                onClick={handleShareReceipt}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-black py-3.5 rounded-2xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 size={16} />
                {lang === "my" ? "ဘောက်ချာ Share မည်" : "Share Receipt Details"}
              </button>

              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-slate-400 py-3 rounded-2xl text-xs font-semibold transition cursor-pointer"
              >
                {lang === "my" ? "ပိတ်မည်" : "Done / Next Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal overlay */}
      <CameraScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleBarcodeScanned}
        lang={lang}
        allProducts={allProducts}
      />
    </div>
  );
}

// =========================================================================
// CAMERA BARCODE / QR SCANNER MODAL WITH DEVELOPER SIMULATOR
// =========================================================================
function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  lang,
  allProducts,
}: {
  isOpen: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
  lang: Language;
  allProducts: Product[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");

  // Get list of existing SKUs to let user select / click for simulation
  const availableSkus = useMemo(() => {
    const skus: { sku: string; name: string }[] = [];
    allProducts.forEach((p) => {
      if (p.sku) skus.push({ sku: p.sku, name: p.name });
      if (p.variants) {
        p.variants.forEach((v) => {
          if (v.sku) skus.push({ sku: v.sku, name: `${p.name} (${v.name})` });
        });
      }
    });
    return skus;
  }, [allProducts]);

  useEffect(() => {
    if (!isOpen) return;

    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;
    setError(null);

    // Give DOM a split-second to mount the container element
    const timer = setTimeout(() => {
      if (!isMounted) return;
      try {
        html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              // Rectangle box styled specifically for scan line targeting
              return {
                width: Math.min(width * 0.85, 280),
                height: Math.min(height * 0.35, 120),
              };
            },
          },
          (decodedText) => {
            onScan(decodedText);
            onClose();
          },
          () => {
            // Quiet mode during frame analysis failures
          }
        ).catch((err) => {
          console.warn("Scanner initiation error:", err);
          setError(err?.message || String(err));
        });
      } catch (e: any) {
        console.error("Scanner exception:", e);
        setError(e?.message || String(e));
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch((e) => console.warn("Failed to stop scanner on clean-up:", e));
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0c0c0c] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full cursor-pointer transition"
        >
          <X size={16} />
        </button>

        <h3 className="text-base font-black text-white mb-1 font-display flex items-center gap-2">
          <Camera className="text-indigo-400" size={18} />
          {lang === "my" ? "Barcode / QR ကင်မရာဖြင့်ဖတ်ရန်" : "Camera Barcode Scanner"}
        </h3>
        <p className="text-[11px] text-slate-400 mb-4">
          {lang === "my" ? "ကုန်ပစ္စည်း Barcode ကို ကင်မရာရှေ့တွင်ပြပါ" : "Align barcode or QR code inside the guide box"}
        </p>

        {/* Camera Viewport */}
        <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden border border-white/5 mb-4 flex flex-col items-center justify-center">
          <div id="reader" className="w-full h-full" />
          
          {error && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 text-center z-10">
              <AlertTriangle className="text-amber-500 mb-2" size={24} />
              <p className="text-[11px] font-bold text-slate-300">
                {lang === "my" ? "ကင်မရာဖွင့်၍မရပါ သို့မဟုတ် Permissions လိုအပ်ပါသည်" : "Camera unavailable or needs permission"}
              </p>
              <p className="text-[9px] text-slate-500 mt-1 max-w-[280px] break-words">{error}</p>
            </div>
          )}
        </div>

        {/* Barcode Simulator / Manual Typing Option */}
        <div className="border-t border-white/5 pt-4 space-y-3 flex-1 overflow-y-auto no-scrollbar">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
              {lang === "my" ? "စမ်းသပ်ရန် / Barcode ကိုယ်တိုင်ရိုက်ထည့်ရန်" : "Simulate / Manual Barcode Input"}
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={lang === "my" ? "Barcode နံပါတ်ရိုက်ပါ... (ဥပမာ- 101010)" : "Barcode e.g. 101010..."}
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 text-white p-2.5 px-3 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={() => {
                  if (manualBarcode.trim()) {
                    onScan(manualBarcode.trim());
                    onClose();
                  }
                }}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-black px-4 rounded-xl text-xs transition cursor-pointer"
              >
                {lang === "my" ? "ဖတ်မည်" : "Scan"}
              </button>
            </div>
          </div>

          {availableSkus.length > 0 && (
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                {lang === "my" ? "ကုန်ပစ္စည်း SKU ကုဒ်များနှင့် စမ်းသပ်ရန်" : "Quick Click Simulation Buttons"}
              </span>
              <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1 no-scrollbar">
                {availableSkus.map((item) => (
                  <button
                    key={item.sku}
                    onClick={() => {
                      onScan(item.sku);
                      onClose();
                    }}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left text-[10px] truncate cursor-pointer transition text-slate-300"
                  >
                    <span className="font-bold text-white block truncate">{item.name}</span>
                    <span className="text-[8px] font-mono text-slate-500 block truncate">SKU: {item.sku}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-2xl text-xs font-black transition cursor-pointer"
        >
          {lang === "my" ? "ပိတ်မည်" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
