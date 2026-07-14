import { Timestamp } from "firebase/firestore";

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  retailPrice: number;
  wholesalePrice: number;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sku: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  quantity: number;
  lowStockThreshold?: number;
  hasVariants?: boolean;
  variants?: ProductVariant[];
  barcode?: string;
}

export interface CartItem {
  id: string;
  sku: string;
  name: string;
  qty: number;
  price: number;
  costPrice: number;
  disc: number;
  variantId?: string;
}

export interface SplitPayment {
  method: string;
  amount: number;
}

export interface Sale {
  id: string;
  items: CartItem[];
  subTotal: number;
  totalCost: number;
  discount: number;
  tax: number;
  total: number;
  profit: number;
  paymentMethod: string;
  splitPayments?: SplitPayment[];
  couponCode?: string;
  codStatus: string | null;
  collectedAt?: Timestamp;
  customerId: string | null;
  customerName: string;
  createdAt?: Timestamp;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  points: number;
  debt: number;
}

export interface Supplier {
  id: string;
  name: string;
  debt: number;
}

export interface Expense {
  id: string;
  desc: string;
  amount: number;
  date?: Timestamp;
}

export interface Purchase {
  id: string;
  desc: string;
  amount: number;
  date?: Timestamp;
}

export interface Payroll {
  id: string;
  name: string;
  amount: number;
  date?: Timestamp;
}

export interface Shift {
  id: string;
  userId: string;
  type: "in" | "out";
  time?: Timestamp;
}

export interface ShopSettings {
  shopName: string;
  phone: string;
  address: string;
  footer: string;
  logo?: string;
  theme?: string;
}

export interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}
