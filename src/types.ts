export type UnitType = 'bori' | 'tora' | 'kainchi' | 'shopper' | 'crates' | 'peti' | 'theli' | 'kg' | 'nag' | (string & {});

export interface ProductPreset {
  id?: string;
  nameEn?: string;
  nameUrdu: string;
  emoji: string;
  defaultUnit?: UnitType;
  defaultAvgRate?: number;
  isCustom?: boolean;
}

export interface MazdooriRateItem {
  id: string;
  title: string;       // e.g. "بوری (Bori)" or "ٹرالی اترائی"
  titleEn?: string;
  rate: number;        // e.g. 30
  unitType?: UnitType; // optional link to standard unit
}

export interface UnitMazdooriRates {
  bori: number;      // بوری (e.g. Rs 30/bori)
  tora: number;      // توڑہ / تورڑہ (e.g. Rs 25/tora)
  kainchi: number;   // کینچی (e.g. Rs 20/kainchi)
  shopper: number;   // شاپر (e.g. Rs 15/shopper)
  crates?: number;   // کریٹ
  peti?: number;     // پیٹی
  theli?: number;    // تھیلی
  kg?: number;       // کلوگرام
  nag?: number;      // نگ / عدد
}

export type PaymentStatus = 'cash' | 'credit' | 'partial';

export interface BolliSale {
  id: string;
  buyerName: string;
  buyerPhone?: string;
  quantity: number; // crates/bori count
  ratePerUnit: number; // e.g. Rs. 3000 per crate
  totalAmount: number; // quantity * ratePerUnit
  paymentStatus: PaymentStatus;
  paidAmount?: number;
  notes?: string;
  timestamp: string;
}

export interface CustomExpense {
  id: string;
  nameUrdu: string;
  nameEn: string;
  amount: number;
  notes?: string;
}

export interface LotExpenses {
  commission: {
    type: 'percentage' | 'fixed';
    rate: number; // e.g. 6% or 8%
    amount: number; // e.g. Rs. 2270
    enabled: boolean;
  };
  kiraya: {
    amount: number;
    enabled: boolean;
    note?: string;
  };
  mazdoori: {
    ratePerUnit: number; // e.g. Rs. 20 per crate
    amount: number; // e.g. Rs. 290
    enabled: boolean;
    title?: string; // e.g. "بوری (Bori)" or "ٹرالی اترائی"
  };
  munshiana: {
    amount: number; // e.g. Rs. 30
    enabled: boolean;
  };
  naqdAdvance: {
    amount: number;
    enabled: boolean;
    note?: string;
  };
  marketFee: {
    ratePerUnit?: number;
    amount: number;
    enabled: boolean;
  };
  customExpenses: CustomExpense[];
}

export interface LotSummary {
  totalSoldQuantity: number;
  remainingQuantity: number;
  grossSales: number;
  totalExpenses: number;
  netPayableToVendor: number; // میزان
  arhtiProfitCommission: number; // آڑھتی کا خالص منافع
  percentSold: number;
}

export type VendorPaymentStatus = 'pending' | 'paid' | 'partial';

export interface VendorPaymentRecord {
  id: string;
  vendorName?: string;
  vendorPhone?: string;
  lotId?: string;
  lotNumber?: string;
  amount: number;
  paymentDate?: string;
  date?: string;
  paymentMethod?: 'cash' | 'online' | 'cheque';
  notes?: string;
  timestamp?: string;
}

export interface VendorLot {
  id: string;
  lotNumber: string;
  vendorName: string;
  vendorPhone?: string;
  vendorCity?: string;
  productName: string;
  productUrdu: string;
  productEmoji: string;
  unitType: UnitType;
  totalQuantity: number;
  vehicleNumber?: string;
  arrivalDate: string;
  status: 'active' | 'completed';
  vendorPaymentStatus?: VendorPaymentStatus; // 'pending' | 'paid' | 'partial'
  vendorPaymentAmount?: number;
  vendorPaymentDate?: string;
  vendorPaymentNotes?: string;
  vendorPaymentMethod?: 'cash' | 'online' | 'cheque';
  sales: BolliSale[];
  expenses: LotExpenses;
  summary: LotSummary;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  language: 'ur' | 'en';
  currencySymbol: 'Rs.' | '₨' | 'روپے';
  defaultCommissionPercent: number;
  defaultMazdooriPerUnit: number;
  unitMazdooriRates?: UnitMazdooriRates;
  mazdooriItems?: MazdooriRateItem[];
  defaultMarketFeePerUnit: number;
  defaultMunshiana: number;
  shopNameUrdu: string;
  shopNameEn: string;
  shopAddressUrdu: string;
  shopAddressEn: string;
  shopPhone: string;
  shopPhone2?: string;
  arhtiNameUrdu: string;
  arhtiNameEn: string;
  tarKaPataUrdu?: string;
  soundEnabled: boolean;
  viewMode: 'mobile' | 'desktop';
  securityPin?: string;
  products?: ProductPreset[];
}

export interface SavedVendor {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  notes?: string;
  openingBalance?: number;
  payments?: VendorPaymentRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BuyerCreditRecord {
  id: string;
  buyerName?: string;
  buyerPhone?: string;
  amount: number;
  date?: string;
  notes?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface CustomerBuyer {
  id: string;
  name: string;
  phone?: string;
  shopName?: string;
  city?: string;
  address?: string;
  openingBalance?: number;
  balance?: number;
  notes?: string;
  payments?: BuyerPaymentRecord[];
  manualCredits?: BuyerCreditRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BuyerPaymentRecord {
  id: string;
  buyerName?: string;
  buyerPhone?: string;
  amount: number;
  paymentDate?: string;
  date?: string;
  paymentMethod?: 'cash' | 'online' | 'cheque';
  notes?: string;
}

export type ExpenseCategory =
  | 'tea_food'     // چائے / لنگر / کھانا
  | 'tea'          // alias for tea_food
  | 'electricity'  // بجلی / جنریٹر فیول
  | 'rent'         // دکان / گودام کرایہ
  | 'salary'       // ملازمین تنخواہ / روزانہ دیہاڑی
  | 'labor'        // اضافی حمالی / پلیداری
  | 'stationery'   // کاپیاں / پرنٹنگ / رجسٹر
  | 'transport'    // گاڑی کرایہ / پیٹرول
  | 'maintenance'  // مرمت / صفائی
  | 'other';       // دیگر متفرق اخراجات

export interface ShopExpense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod: 'cash' | 'online' | 'cheque';
  paidTo?: string;
  notes?: string;
  receiptNumber?: string;
  createdAt: string;
  updatedAt?: string;
}

export const expenseCategoryLabels: Record<
  ExpenseCategory,
  { ur: string; en: string; icon: string; color: string }
> = {
  tea_food: { ur: 'چائے و کھانا', en: 'Tea & Food', icon: '☕', color: 'amber' },
  tea: { ur: 'چائے و کھانا', en: 'Tea & Food', icon: '☕', color: 'amber' },
  electricity: { ur: 'بجلی و جنریٹر فیول', en: 'Electricity & Fuel', icon: '⚡', color: 'yellow' },
  rent: { ur: 'دکان و گودام کرایہ', en: 'Shop Rent', icon: '🏪', color: 'purple' },
  salary: { ur: 'ملازمین تنخواہ', en: 'Staff Salary', icon: '👤', color: 'blue' },
  labor: { ur: 'اضافی مزدوری و حمالی', en: 'Labor & Handling', icon: '📦', color: 'indigo' },
  stationery: { ur: 'اسٹیشنری و پرنٹنگ', en: 'Stationery & Printing', icon: '📝', color: 'emerald' },
  transport: { ur: 'گاڑی کرایہ و پیٹرول', en: 'Transport & Fuel', icon: '🚚', color: 'cyan' },
  maintenance: { ur: 'مرمت و صفائی', en: 'Maintenance & Cleaning', icon: '🧹', color: 'orange' },
  other: { ur: 'دیگر متفرق اخراجات', en: 'Other Miscellaneous', icon: '💼', color: 'slate' },
};

export type ActiveTab = 'bolli' | 'expenses' | 'receipt' | 'khata' | 'reports' | 'history' | 'settings' | 'slip_expenses';

export interface DrawerAdjustment {
  id: string;
  type: 'in' | 'out'; // 'in' = add cash to drawer, 'out' = deduct/withdraw cash from drawer
  amount: number;
  reason: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  notes?: string;
  recordedBy?: string;
}

export interface CashDrawerSummary {
  salesCashCollected: number;
  buyerKhataCashCollected: number;
  manualCashIn: number;
  totalCashIn: number;
  shopCashExpenses: number;
  vendorCashPaid: number;
  manualCashOut: number;
  totalCashOut: number;
  netCashInDrawer: number;
}

export type LogActionStatus = 'created' | 'updated' | 'deleted';

export type LogCategory = 'LT' | 'BL' | 'EX' | 'LX' | 'CD' | 'BK' | 'VP' | 'ST';

export interface SystemLog {
  id: string;
  timestamp: string; // ISO 8601 string with date and time
  title: LogCategory; // short title like LT, BL, EX, CD, BK, VP, ST
  status: LogActionStatus; // 'created' | 'updated' | 'deleted'
  description: string; // Detailed description in Urdu
  descriptionEn?: string; // English translation
  entityId?: string; // ID of the lot, sale, expense, etc.
  meta?: {
    lotNumber?: string;
    vendorName?: string;
    buyerName?: string;
    amount?: number;
    quantity?: number;
    unit?: string;
    rate?: number;
    category?: string;
    [key: string]: any;
  };
}

export const logCategoryMeta: Record<
  LogCategory,
  { short: LogCategory; labelUrdu: string; labelEn: string; icon: string; color: string }
> = {
  LT: { short: 'LT', labelUrdu: 'لاٹ مال اندراج', labelEn: 'Lot Entry', icon: '📦', color: 'indigo' },
  BL: { short: 'BL', labelUrdu: 'بولی و فروخت', labelEn: 'Boli / Sale', icon: '🔨', color: 'emerald' },
  EX: { short: 'EX', labelUrdu: 'دکان خرچہ', labelEn: 'Shop Expense', icon: '💸', color: 'rose' },
  LX: { short: 'LX', labelUrdu: 'لاٹ کٹوتیاں', labelEn: 'Lot Expenses', icon: '✂️', color: 'amber' },
  CD: { short: 'CD', labelUrdu: 'گلہ کیش دراز', labelEn: 'Cash Drawer', icon: '💼', color: 'cyan' },
  BK: { short: 'BK', labelUrdu: 'خریدار کھاتہ', labelEn: 'Buyer Khata', icon: '👥', color: 'purple' },
  VP: { short: 'VP', labelUrdu: 'زمیندار ادائیگی', labelEn: 'Vendor Payment', icon: '🤝', color: 'teal' },
  ST: { short: 'ST', labelUrdu: 'سسٹم ترتیبات', labelEn: 'Settings Update', icon: '⚙️', color: 'slate' },
};
