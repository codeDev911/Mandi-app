export type UnitType = 'crates' | 'bori' | 'theli' | 'peti' | 'kg' | 'nag';

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
