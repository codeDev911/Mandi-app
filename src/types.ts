export type UnitType = 'bori' | 'tora' | 'kainchi' | 'shopper' | 'crates' | 'peti' | 'theli' | 'kg' | 'nag';

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
  defaultMarketFeePerUnit: number;
  defaultMunshiana: number;
  shopNameUrdu: string;
  shopNameEn: string;
  shopAddressUrdu: string;
  shopAddressEn: string;
  shopPhone: string;
  arhtiNameUrdu: string;
  arhtiNameEn: string;
  soundEnabled: boolean;
  viewMode: 'mobile' | 'desktop';
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

export type ActiveTab = 'bolli' | 'expenses' | 'receipt' | 'khata' | 'reports' | 'history' | 'settings';
