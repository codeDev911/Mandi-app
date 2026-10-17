import React, { useState, useMemo } from 'react';
import {
  VendorLot,
  AppSettings,
  CustomerBuyer,
  VendorPaymentStatus,
  ShopExpense,
  ExpenseCategory,
  expenseCategoryLabels,
  DrawerAdjustment,
  CashDrawerSummary,
  SavedVendor,
  BolliSale,
} from '../types';
import { translations, unitLabels, commonMandiProducts, getUnitDisplayLabel } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import {
  calculateCashDrawerSummary,
  calculateLotSummary,
  distributeMunshianaToLots,
  getLotReceiptNumber,
  getAllReconciledVendorPayments,
  getReconciledVendorPaymentsForVendor,
} from '../utils/calculations';
import { sound } from '../utils/sound';
import { VendorConsolidatedBillModal } from './VendorConsolidatedBillModal';
import { AllVendorBillsModal } from './AllVendorBillsModal';
import { CashDrawerModal } from './CashDrawerModal';
import { ReportPDFPreviewModal } from './ReportPDFPreviewModal';
import { PaginationControls } from './PaginationControls';
import {
  PDFPreviewData,
  buildReportPDF,
  buildEntireRecordReportPDF,
  buildSingleLotReportPDF,
  buildSingleCustomerReportPDF,
  buildSingleProductReportPDF,
  buildSingleVendorReportPDF,
  buildExpenseReportPDF,
} from '../utils/pdfReportGenerator';
import {
  BarChart3,
  Users,
  Calendar,
  Package,
  User,
  Download,
  Printer,
  Share2,
  Filter,
  CheckCircle,
  Clock,
  TrendingUp,
  CreditCard,
  Banknote,
  FileSpreadsheet,
  FileText,
  Search,
  Layers,
  Receipt,
  FileDown,
  Eye,
  FileCheck,
  CheckCircle2,
  Check,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Trash2,
  Coins,
  Plus,
  Minus,
} from 'lucide-react';

interface ReportsViewProps {
  lots: VendorLot[];
  customers: CustomerBuyer[];
  expenses?: ShopExpense[];
  drawerAdjustments?: DrawerAdjustment[];
  vendors?: SavedVendor[];
  onAddDrawerAdjustment?: (adj: Omit<DrawerAdjustment, 'id' | 'timestamp'>) => void;
  onDeleteDrawerAdjustment?: (id: string) => void;
  onBatchUpdateLots?: (updatedLots: VendorLot[]) => void;
  onSaveExpense?: (expense: ShopExpense) => void;
  onDeleteExpense?: (expenseId: string) => void;
  settings: AppSettings;
  onOpenReceipt?: (lotId: string) => void;
  onOpenExpenseSlip?: (lotId: string) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onRecordVendorPayment?: (
    vendorName: string,
    payment: {
      lotId?: string;
      lotIds?: string[];
      amount: number;
      notes?: string;
      paymentDate?: string;
      paymentMethod?: 'cash' | 'online' | 'cheque';
      status?: VendorPaymentStatus;
    }
  ) => void;
}

type ReportType = 'date' | 'vendor' | 'customer' | 'product' | 'expenses';
type DateFilter = 'all' | 'today' | 'yesterday' | 'last7days' | 'thismonth' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({
  lots,
  customers,
  expenses = [],
  drawerAdjustments = [],
  vendors = [],
  onAddDrawerAdjustment,
  onDeleteDrawerAdjustment,
  onBatchUpdateLots,
  onSaveExpense,
  onDeleteExpense,
  settings,
  onOpenReceipt,
  onOpenExpenseSlip,
  onToggleVendorPaymentStatus,
  onRecordVendorPayment,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [activeReport, setActiveReport] = useState<ReportType>('date');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customFromDate, setCustomFromDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customToDate, setCustomToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [selectedExpenseCategoryFilter, setSelectedExpenseCategoryFilter] = useState<string>('all');
  const [selectedExpensePaymentMethodFilter, setSelectedExpensePaymentMethodFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');


  // State for PDF preview modal
  const [pdfPreview, setPdfPreview] = useState<PDFPreviewData | null>(null);

  // State for Cash in Drawer modal
  const [isCashDrawerModalOpen, setIsCashDrawerModalOpen] = useState(false);

  // State for In-place Distribute Munshiana (سادہ ان پلیس فارم برائے منشیانہ تقسیم)
  const [inlineMunshianaVendor, setInlineMunshianaVendor] = useState<string | null>(null);
  const [inlineMunshianaAmount, setInlineMunshianaAmount] = useState<string>('150');
  const [inlineMunshianaSuccess, setInlineMunshianaSuccess] = useState<string | null>(null);

  const handleApplyInlineMunshiana = (vName: string, vendorLots: VendorLot[]) => {
    const total = Math.max(0, Math.round(parseNumber(inlineMunshianaAmount) || 0));
    if (vendorLots.length === 0) return;
    sound.playCashChime();

    const distributedAmounts = distributeMunshianaToLots(total, vendorLots.length);

    const updatedLots: VendorLot[] = vendorLots.map((lot, idx) => {
      const lotMunshiana = distributedAmounts[idx] ?? 0;
      const updatedExpenses = {
        ...lot.expenses,
        munshiana: {
          amount: lotMunshiana,
          enabled: lotMunshiana > 0,
        },
      };

      const summary = calculateLotSummary(lot.totalQuantity, lot.sales, updatedExpenses);

      return {
        ...lot,
        expenses: updatedExpenses,
        summary,
        updatedAt: new Date().toISOString(),
      };
    });

    if (onBatchUpdateLots) {
      onBatchUpdateLots(updatedLots);
    }

    setInlineMunshianaSuccess(vName);
    setTimeout(() => {
      setInlineMunshianaSuccess(null);
    }, 2500);

    setInlineMunshianaVendor(null);
  };

  // State for Consolidated Vendor Bill (مجموعی بل - تمام اجناس ایک ساتھ)
  const [consolidatedBillVendor, setConsolidatedBillVendor] = useState<{
    vendorName: string;
    vendorPhone?: string;
    vendorCity?: string;
    lots: VendorLot[];
    dateLabel: string;
  } | null>(null);

  // State for All Vendors Batch Bills Modal (تمام زمینداروں کے بل بک)
  const [isAllVendorBillsOpen, setIsAllVendorBillsOpen] = useState(false);

  // Sub-pagination states for individual vendor lots and customer transactions inside report cards
  const [vendorLotsSubPages, setVendorLotsSubPages] = useState<Record<string, number>>({});
  const [customerTransactionsSubPages, setCustomerTransactionsSubPages] = useState<Record<string, number>>({});

  // Helper to extract the real date (YYYY-MM-DD) for a sale/bid record
  const getSaleDate = (sale: BolliSale, lot?: VendorLot): string => {
    if (sale.date && typeof sale.date === 'string') {
      return sale.date.slice(0, 10);
    }
    if (sale.timestamp && typeof sale.timestamp === 'string') {
      return sale.timestamp.slice(0, 10);
    }
    if (lot?.arrivalDate) {
      return lot.arrivalDate.slice(0, 10);
    }
    if (lot?.createdAt) {
      return lot.createdAt.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  };

  // Date filtering helper for any ISO or YYYY-MM-DD date string
  const isDateInRange = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const cleanDate = dateStr.slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return cleanDate === todayStr;
    if (dateFilter === 'yesterday') return cleanDate === yesterdayStr;
    if (dateFilter === 'last7days') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return cleanDate >= sevenDaysAgo && cleanDate <= todayStr;
    }
    if (dateFilter === 'thismonth') {
      const thisMonthPrefix = new Date().toISOString().slice(0, 7);
      return cleanDate.startsWith(thisMonthPrefix);
    }
    if (dateFilter === 'custom') {
      return (!customFromDate || cleanDate >= customFromDate) && (!customToDate || cleanDate <= customToDate);
    }
    return true;
  };

  // Backward-compatible alias
  const isLotInDateRange = isDateInRange;

  // Date helper to check if a date string is strictly BEFORE the selected date range
  const isDateBeforeRange = (dateStr?: string): boolean => {
    if (!dateStr || dateFilter === 'all') return false;
    const cleanDate = dateStr.slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dateFilter === 'today') return cleanDate < todayStr;
    if (dateFilter === 'yesterday') return cleanDate < yesterdayStr;
    if (dateFilter === 'last7days') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return cleanDate < sevenDaysAgo;
    }
    if (dateFilter === 'thismonth') {
      const thisMonthStart = new Date().toISOString().slice(0, 7) + '-01';
      return cleanDate < thisMonthStart;
    }
    if (dateFilter === 'custom') {
      return Boolean(customFromDate && cleanDate < customFromDate);
    }
    return false;
  };

  // Helper to check if a lot has activity (arrival or auction sales) in the selected date range
  const isLotActiveInDateRange = (lot: VendorLot): boolean => {
    if (dateFilter === 'all') return true;
    // 1. Lot arrived or was created on this date
    const createdDate = (lot.arrivalDate || lot.createdAt || '').slice(0, 10);
    if (createdDate && isDateInRange(createdDate)) {
      return true;
    }
    // 2. Any auction sale / bid was recorded on this date
    if (lot.sales.some((s) => isDateInRange(getSaleDate(s, lot)))) {
      return true;
    }
    return false;
  };

  // Filtered lots based on date range - includes lots that arrived OR have sales/payments in this date range
  const filteredLotsByDate = useMemo(() => {
    return lots.filter(isLotActiveInDateRange);
  }, [lots, dateFilter, customFromDate, customToDate]);

  // List of unique vendors
  const allVendors = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string; city?: string }>();
    lots.forEach((l) => {
      if (!map.has(l.vendorName)) {
        map.set(l.vendorName, { name: l.vendorName, phone: l.vendorPhone, city: l.vendorCity });
      }
    });
    return Array.from(map.values());
  }, [lots]);

  // List of unique customers
  const allCustomerNames = useMemo(() => {
    const set = new Set<string>();
    lots.forEach((l) => {
      l.sales.forEach((s) => set.add(s.buyerName));
    });
    customers.forEach((c) => set.add(c.name));
    return Array.from(set);
  }, [lots, customers]);

  // List of unique products
  const allProducts = useMemo(() => {
    const map = new Map<string, { urdu: string; en: string; emoji: string }>();
    lots.forEach((l) => {
      if (!map.has(l.productName)) {
        map.set(l.productName, { urdu: l.productUrdu, en: l.productName, emoji: l.productEmoji });
      }
    });
    return Array.from(map.values());
  }, [lots]);

  // 1. CUSTOMER REPORT DATA
  const customerReports = useMemo(() => {
    const custMap = new Map<
      string,
      {
        customerName: string;
        phone?: string;
        shopName?: string;
        city?: string;
        address?: string;
        totalPurchases: number;
        totalUnitsBought: number;
        totalAmount: number;
        directCashPaid: number;
        khataPaid: number;
        cashPaid: number;
        creditPending: number;
        oldUdhaar: number;
        allTimeCredit: number;
        transactions: Array<{
          lotId: string;
          lotNumber: string;
          productUrdu: string;
          date: string;
          quantity: number;
          ratePerUnit: number;
          totalAmount: number;
          paymentStatus: 'cash' | 'credit' | 'partial';
          isPaymentRecord?: boolean;
        }>;
        payments: any[];
      }
    >();

    // 1. Gather all customer names that have ANY activity in the selected date range
    const activeCustomerNames = new Set<string>();

    customers.forEach((c) => {
      if (selectedCustomerFilter !== 'all' && c.name.toLowerCase() !== selectedCustomerFilter.toLowerCase()) {
        return;
      }
      if (dateFilter === 'all' || selectedCustomerFilter !== 'all') {
        activeCustomerNames.add(c.name);
        return;
      }
      // Check if customer had any manual credits in date range
      const hasCredits = (c.manualCredits || []).some((cr) => {
        const d = (cr.date || cr.createdAt || '').slice(0, 10);
        return d ? isDateInRange(d) : false;
      });
      if (hasCredits) {
        activeCustomerNames.add(c.name);
        return;
      }
      // Check if customer had any payments in date range
      const hasPayments = (c.payments || []).some((p) => {
        const d = (p.paymentDate || p.date || p.timestamp || '').slice(0, 10);
        return d ? isDateInRange(d) : false;
      });
      if (hasPayments) {
        activeCustomerNames.add(c.name);
        return;
      }
    });

    // Also check if any lot sales in date range belong to customers
    lots.forEach((lot) => {
      lot.sales.forEach((sale) => {
        if (selectedCustomerFilter !== 'all' && sale.buyerName.toLowerCase() !== selectedCustomerFilter.toLowerCase()) {
          return;
        }
        const saleDate = getSaleDate(sale, lot);
        if (dateFilter === 'all' || isDateInRange(saleDate)) {
          activeCustomerNames.add(sale.buyerName);
        }
      });
    });

    // 2. Build detailed records for each active customer
    activeCustomerNames.forEach((custName) => {
      const savedCust = customers.find((c) => c.name.toLowerCase() === custName.toLowerCase());

      // Collect sales in date range
      const salesInDate: Array<{ sale: BolliSale; lot: VendorLot; saleDate: string }> = [];
      lots.forEach((lot) => {
        lot.sales.forEach((sale) => {
          if (sale.buyerName.toLowerCase() !== custName.toLowerCase()) return;
          const saleDate = getSaleDate(sale, lot);
          if (dateFilter === 'all' || isDateInRange(saleDate)) {
            salesInDate.push({ sale, lot, saleDate });
          }
        });
      });

      // Collect manual credits in date range
      const creditsInDate = (savedCust?.manualCredits || []).filter((cr) => {
        if (dateFilter === 'all') return true;
        const d = (cr.date || cr.createdAt || '').slice(0, 10);
        return d ? isDateInRange(d) : false;
      });

      // Collect payments in date range
      const paymentsInDate = (savedCust?.payments || []).filter((p) => {
        if (dateFilter === 'all') return true;
        const d = (p.paymentDate || p.date || p.timestamp || '').slice(0, 10);
        return d ? isDateInRange(d) : false;
      });

      const totalPurchases = salesInDate.length;
      const totalUnitsBought = salesInDate.reduce((sum, item) => sum + (Number(item.sale.quantity) || 0), 0);
      const salesTotalAmount = salesInDate.reduce((sum, item) => sum + (Number(item.sale.totalAmount) || 0), 0);
      const manualCreditsAmount = creditsInDate.reduce((sum, cr) => sum + (Number(cr.amount) || 0), 0);
      const openingBalance = dateFilter === 'all' ? (Number(savedCust?.openingBalance) || 0) : 0;
      const totalAmount = salesTotalAmount + manualCreditsAmount + openingBalance;

      let directCashPaid = 0;
      salesInDate.forEach(({ sale }) => {
        if (sale.paymentStatus === 'cash') {
          directCashPaid += Number(sale.totalAmount) || 0;
        } else if (sale.paidAmount && Number(sale.paidAmount) > 0) {
          directCashPaid += Number(sale.paidAmount) || 0;
        }
      });

      const khataPaid = paymentsInDate.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const cashPaid = directCashPaid + khataPaid;
      const creditPending = Math.max(0, totalAmount - cashPaid);

      // Compute all-time master outstanding credit (Kul Udhar)
      let allTimeCreditBids = 0;
      lots.forEach((l) => {
        l.sales.forEach((s) => {
          if (s.buyerName.toLowerCase() === custName.toLowerCase() && s.paymentStatus !== 'cash') {
            allTimeCreditBids += (Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0);
          }
        });
      });
      const allTimeOpening = Number(savedCust?.openingBalance) || 0;
      const allTimeManualCredits = (savedCust?.manualCredits || []).reduce((sum, cr) => sum + (Number(cr.amount) || 0), 0);
      const allTimePaymentsReceived = (savedCust?.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const allTimeCredit = Math.max(0, (allTimeOpening + allTimeManualCredits + allTimeCreditBids) - allTimePaymentsReceived);

      // Compute oldUdhaar (سابقہ ادھار) strictly BEFORE the selected date range
      let creditBidsBefore = 0;
      lots.forEach((l) => {
        l.sales.forEach((s) => {
          if (s.buyerName.toLowerCase() === custName.toLowerCase() && s.paymentStatus !== 'cash') {
            const sDate = getSaleDate(s, l);
            if (dateFilter !== 'all' && isDateBeforeRange(sDate)) {
              creditBidsBefore += (Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0);
            }
          }
        });
      });

      let manualCreditsBefore = 0;
      (savedCust?.manualCredits || []).forEach((cr) => {
        const d = (cr.date || cr.createdAt || '').slice(0, 10);
        if (dateFilter !== 'all' && isDateBeforeRange(d)) {
          manualCreditsBefore += Number(cr.amount) || 0;
        }
      });

      const openingBalanceBefore = dateFilter !== 'all' ? (Number(savedCust?.openingBalance) || 0) : 0;

      let paymentsBefore = 0;
      (savedCust?.payments || []).forEach((p) => {
        const d = (p.paymentDate || p.date || p.timestamp || '').slice(0, 10);
        if (dateFilter !== 'all' && isDateBeforeRange(d)) {
          paymentsBefore += Number(p.amount) || 0;
        }
      });

      const oldUdhaar = dateFilter === 'all'
        ? (Number(savedCust?.openingBalance) || 0)
        : Math.max(0, (openingBalanceBefore + manualCreditsBefore + creditBidsBefore) - paymentsBefore);

      // Build transactions statement
      const transactions: Array<{
        lotId: string;
        lotNumber: string;
        productUrdu: string;
        date: string;
        quantity: number;
        ratePerUnit: number;
        totalAmount: number;
        paymentStatus: 'cash' | 'credit' | 'partial';
        isPaymentRecord?: boolean;
      }> = [];

      // 1. Sales
      salesInDate.forEach(({ sale, lot, saleDate }) => {
        transactions.push({
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          productUrdu: lot.productUrdu,
          date: saleDate,
          quantity: sale.quantity,
          ratePerUnit: sale.ratePerUnit,
          totalAmount: sale.totalAmount,
          paymentStatus: sale.paymentStatus,
        });
      });

      // 2. Manual Credits
      creditsInDate.forEach((cr) => {
        transactions.push({
          lotId: `mc-${cr.id}`,
          lotNumber: isUrdu ? 'دستی ادھار' : 'Manual Credit',
          productUrdu: cr.notes || (isUrdu ? 'دستی کھاتہ ادھار' : 'Manual Credit'),
          date: (cr.date || cr.createdAt || '').slice(0, 10) || '-',
          quantity: 1,
          ratePerUnit: cr.amount,
          totalAmount: cr.amount,
          paymentStatus: 'credit',
        });
      });

      // 3. Payments Received
      paymentsInDate.forEach((p) => {
        transactions.push({
          lotId: `pay-${p.id}`,
          lotNumber: isUrdu ? 'ادائیگی رسید' : 'Payment Receipt',
          productUrdu: p.notes
            ? `${isUrdu ? 'وصولی کیش' : 'Cash Received'}: ${p.notes}`
            : (isUrdu ? 'وصولی کیش کھاتہ' : 'Khata Cash Payment'),
          date: (p.paymentDate || p.date || p.timestamp || '').slice(0, 10) || '-',
          quantity: 1,
          ratePerUnit: p.amount,
          totalAmount: p.amount,
          paymentStatus: 'cash',
          isPaymentRecord: true,
        });
      });

      transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      const phone = savedCust?.phone || salesInDate[0]?.sale.buyerPhone;
      const shopName = savedCust?.shopName;
      const city = savedCust?.city;
      const address = savedCust?.address;

      custMap.set(custName, {
        customerName: custName,
        phone,
        shopName,
        city,
        address,
        totalPurchases,
        totalUnitsBought,
        totalAmount,
        directCashPaid,
        khataPaid,
        cashPaid,
        creditPending,
        oldUdhaar,
        allTimeCredit,
        transactions,
        payments: paymentsInDate,
      });
    });

    const list = Array.from(custMap.values());

    return list.filter((c) =>
      c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.shopName && c.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [lots, selectedCustomerFilter, customers, searchTerm, dateFilter, customFromDate, customToDate, isUrdu]);

  // 2. DATE REPORT STATS
  // Production-grade accurate stats calculated directly from each record by its actual creation / event date
  const dateReportStats = useMemo(() => {
    let grossSales = 0;
    let unitsSold = 0;
    let directCashReceived = 0;
    let commission = 0;
    let totalExpenses = 0;
    let totalMazdoori = 0;
    let totalMunshiana = 0;
    let vendorPayable = 0;
    let vendorPaid = 0;
    let newCreditGenerated = 0;

    // 1. Sales & Bids on this date range across ALL lots
    lots.forEach((lot) => {
      const salesInDate = dateFilter === 'all'
        ? lot.sales
        : lot.sales.filter((s) => isDateInRange(getSaleDate(s, lot)));

      const lotGrossSales = salesInDate.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const lotUnitsSold = salesInDate.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

      grossSales += lotGrossSales;
      unitsSold += lotUnitsSold;

      salesInDate.forEach((s) => {
        if (s.paymentStatus === 'cash') {
          directCashReceived += Number(s.totalAmount) || 0;
        } else if (s.paidAmount && Number(s.paidAmount) > 0) {
          directCashReceived += Number(s.paidAmount) || 0;
          newCreditGenerated += Math.max(0, (Number(s.totalAmount) || 0) - Number(s.paidAmount));
        } else {
          newCreditGenerated += Number(s.totalAmount) || 0;
        }
      });

      // Commission from sales in this date range
      let lotCommission = 0;
      if (lot.expenses?.commission?.enabled) {
        if (dateFilter === 'all') {
          lotCommission = Number(lot.expenses.commission.amount) || 0;
        } else if (lot.expenses.commission.type === 'percentage') {
          const rate = Number(lot.expenses.commission.rate) || 0;
          lotCommission = Math.round((lotGrossSales * rate) / 100);
        } else if (lot.totalQuantity > 0 && lotUnitsSold > 0) {
          lotCommission = Math.round(((Number(lot.expenses.commission.amount) || 0) * lotUnitsSold) / lot.totalQuantity);
        } else if (isDateInRange(lot.arrivalDate)) {
          lotCommission = Number(lot.expenses.commission.amount) || 0;
        }
      }
      commission += lotCommission;

      // Mazdoori from sales in this date range
      let lotMazdoori = 0;
      if (lot.expenses?.mazdoori?.enabled) {
        if (dateFilter === 'all') {
          lotMazdoori = Number(lot.expenses.mazdoori.amount) || 0;
        } else if (lot.expenses.mazdoori.ratePerUnit && lotUnitsSold > 0) {
          lotMazdoori = lot.expenses.mazdoori.ratePerUnit * lotUnitsSold;
        } else if (lot.totalQuantity > 0 && lotUnitsSold > 0) {
          lotMazdoori = Math.round(((Number(lot.expenses.mazdoori.amount) || 0) * lotUnitsSold) / lot.totalQuantity);
        } else if (isDateInRange(lot.arrivalDate)) {
          lotMazdoori = Number(lot.expenses.mazdoori.amount) || 0;
        }
      }
      totalMazdoori += lotMazdoori;

      // Munshiana
      let lotMunshiana = 0;
      if (lot.expenses?.munshiana?.enabled) {
        if (dateFilter === 'all' || isDateInRange(lot.arrivalDate)) {
          lotMunshiana = Number(lot.expenses.munshiana.amount) || 0;
        } else if (lot.totalQuantity > 0 && lotUnitsSold > 0) {
          lotMunshiana = Math.round(((Number(lot.expenses.munshiana.amount) || 0) * lotUnitsSold) / lot.totalQuantity);
        }
      }
      totalMunshiana += lotMunshiana;

      // Deductions and Net payable to vendor for this date
      let lotExpensesInDate = lotCommission + lotMazdoori + lotMunshiana;
      if (dateFilter === 'all') {
        lotExpensesInDate = lot.summary.totalExpenses;
      } else if (isDateInRange(lot.arrivalDate)) {
        if (lot.expenses?.kiraya?.enabled) lotExpensesInDate += Number(lot.expenses.kiraya.amount) || 0;
        if (lot.expenses?.marketFee?.enabled) lotExpensesInDate += Number(lot.expenses.marketFee.amount) || 0;
        if (lot.expenses?.naqdAdvance?.enabled) lotExpensesInDate += Number(lot.expenses.naqdAdvance.amount) || 0;
        (lot.expenses?.customExpenses || []).forEach((ce) => {
          lotExpensesInDate += Number(ce.amount) || 0;
        });
      }
      totalExpenses += lotExpensesInDate;

      const lotNetPayable = Math.max(0, lotGrossSales - lotExpensesInDate);
      vendorPayable += lotNetPayable;

    });

    // 2. Vendor payments recorded on this date (reconciled to prevent double counting between vendor payments and lots)
    const allReconciledVendorPayments = getAllReconciledVendorPayments(filteredLotsByDate, vendors);
    allReconciledVendorPayments.forEach((p) => {
      if (dateFilter === 'all' || isDateInRange(p.date)) {
        vendorPaid += Number(p.amount) || 0;
      }
    });

    // 3. Customer Khata Payments received: from EACH payment record directly
    // This guarantees that any payment recorded today (even for 4-day-old sales) shows up in today's collected cash
    let totalKhataPaid = 0;
    customers.forEach((c) => {
      (c.payments || []).forEach((pay) => {
        const payDate = (pay.paymentDate || pay.date || pay.timestamp || '').slice(0, 10);
        if (dateFilter === 'all' || isDateInRange(payDate)) {
          totalKhataPaid += Number(pay.amount) || 0;
        }
      });
      // Also add manual credits created on this date
      (c.manualCredits || []).forEach((cr) => {
        const crDate = (cr.date || cr.createdAt || '').slice(0, 10);
        if (dateFilter === 'all' || isDateInRange(crDate)) {
          newCreditGenerated += Number(cr.amount) || 0;
        }
      });
    });

    // 4. Total Cash Collected = Direct Cash from Sales on this date + Khata Cash received on this date
    const cashReceived = directCashReceived + totalKhataPaid;

    // 5. Vendor Pending
    const vendorPending = Math.max(0, vendorPayable - vendorPaid);

    // 6. Master All-Time Customer Outstanding Credit (Total Udhaar across whole ledger)
    let allTimeCustomerCredit = 0;
    customers.forEach((c) => {
      let custBidsCredit = 0;
      lots.forEach((l) => {
        l.sales.forEach((s) => {
          if (s.buyerName.toLowerCase() === c.name.toLowerCase() && s.paymentStatus !== 'cash') {
            custBidsCredit += (Number(s.totalAmount) || 0) - (Number(s.paidAmount) || 0);
          }
        });
      });
      const cOpening = Number(c.openingBalance) || 0;
      const cManualCredits = (c.manualCredits || []).reduce((sum, cr) => sum + (Number(cr.amount) || 0), 0);
      const cPayments = (c.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const cOutstanding = Math.max(0, (cOpening + cManualCredits + custBidsCredit) - cPayments);
      allTimeCustomerCredit += cOutstanding;
    });

    const creditPending = dateFilter === 'all'
      ? allTimeCustomerCredit
      : Math.max(0, newCreditGenerated - totalKhataPaid);

    return {
      lotsCount: filteredLotsByDate.length,
      grossSales,
      commission,
      totalExpenses,
      vendorPayable,
      vendorPaid,
      vendorPending,
      unitsSold,
      directCashReceived,
      totalKhataPaid,
      cashReceived,
      creditPending,
      allTimeCustomerCredit,
      newCreditGenerated,
      totalMazdoori,
      totalMunshiana,
    };
  }, [lots, filteredLotsByDate, dateFilter, customFromDate, customToDate, vendors, customers]);

  // Overall Cash in Drawer Summary
  const cashDrawerSummary = useMemo(() => {
    return calculateCashDrawerSummary(lots, customers, expenses, drawerAdjustments, vendors);
  }, [lots, customers, expenses, drawerAdjustments, vendors]);

  // 2. VENDOR REPORT DATA
  const vendorReports = useMemo(() => {
    const vendorMap = new Map<
      string,
      {
        vendorName: string;
        vendorPhone?: string;
        vendorCity?: string;
        lotsCount: number;
        totalUnits: number;
        unitsSold: number;
        grossSales: number;
        totalExpenses: number;
        commission: number;
        netPayable: number;
        totalPaid: number;
        pendingBalance: number;
        lots: VendorLot[];
      }
    >();

    lots.forEach((lot) => {
      if (selectedVendorFilter !== 'all' && lot.vendorName !== selectedVendorFilter) {
        return;
      }

      // Filter strictly by the lot's created / arrival date (NOT payment date, NOT updated date)
      const lotCreatedDate = (lot.arrivalDate || lot.createdAt || '').slice(0, 10);
      if (dateFilter !== 'all' && !isDateInRange(lotCreatedDate)) {
        return;
      }

      const existing = vendorMap.get(lot.vendorName) || {
        vendorName: lot.vendorName,
        vendorPhone: lot.vendorPhone,
        vendorCity: lot.vendorCity,
        lotsCount: 0,
        totalUnits: 0,
        unitsSold: 0,
        grossSales: 0,
        totalExpenses: 0,
        commission: 0,
        netPayable: 0,
        totalPaid: 0,
        pendingBalance: 0,
        lots: [],
      };

      const lotGross = lot.summary.grossSales;
      const lotSold = lot.summary.totalSoldQuantity;
      const lotComm = lot.summary.arhtiProfitCommission;
      const lotExp = lot.summary.totalExpenses;
      const lotNet = lot.summary.netPayableToVendor;

      existing.lotsCount += 1;
      existing.totalUnits += lot.totalQuantity;
      existing.unitsSold += lotSold;
      existing.grossSales += lotGross;
      existing.commission += lotComm;
      existing.totalExpenses += lotExp;
      existing.netPayable += lotNet;

      existing.lots.push(lot);
      vendorMap.set(lot.vendorName, existing);
    });

    // Also include any saved vendors who have payments or exist in vendors list
    if (vendors && Array.isArray(vendors)) {
      vendors.forEach((v) => {
        if (selectedVendorFilter !== 'all' && v.name !== selectedVendorFilter) {
          return;
        }
        if (!vendorMap.has(v.name)) {
          vendorMap.set(v.name, {
            vendorName: v.name,
            vendorPhone: v.phone,
            vendorCity: v.city,
            lotsCount: 0,
            totalUnits: 0,
            unitsSold: 0,
            grossSales: 0,
            totalExpenses: 0,
            commission: 0,
            netPayable: 0,
            totalPaid: 0,
            pendingBalance: 0,
            lots: [],
          });
        }
      });
    }

    // Accurately reconcile totalPaid and pendingBalance for each vendor without double counting
    vendorMap.forEach((existing, vName) => {
      const vPayments = getReconciledVendorPaymentsForVendor(vName, existing.lots, vendors);
      let vPaid = 0;
      vPayments.forEach((p) => {
        if (dateFilter === 'all' || isDateInRange(p.date)) {
          vPaid += Number(p.amount) || 0;
        }
      });
      existing.totalPaid = vPaid;
      existing.pendingBalance = Math.max(0, existing.netPayable - existing.totalPaid);
    });

    return Array.from(vendorMap.values()).filter((v) =>
      v.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.vendorCity && v.vendorCity.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [lots, selectedVendorFilter, searchTerm, dateFilter, customFromDate, customToDate, vendors]);

  // 3. PRODUCT REPORT DATA
  const productReports = useMemo(() => {
    const prodMap = new Map<
      string,
      {
        productName: string;
        productUrdu: string;
        emoji: string;
        totalLots: number;
        totalUnits: number;
        totalSold: number;
        grossTurnover: number;
        commissionEarned: number;
        minRate: number;
        maxRate: number;
        rates: number[];
      }
    >();

    filteredLotsByDate.forEach((lot) => {
      if (selectedProductFilter !== 'all' && lot.productName !== selectedProductFilter) {
        return;
      }

      const salesInDate = lot.sales.filter((s) => {
        if (dateFilter === 'all') return true;
        return isDateInRange(getSaleDate(s, lot));
      });

      const isArrival = isDateInRange(lot.arrivalDate);
      if (dateFilter !== 'all' && salesInDate.length === 0 && !isArrival) {
        return;
      }

      const existing = prodMap.get(lot.productName) || {
        productName: lot.productName,
        productUrdu: lot.productUrdu,
        emoji: lot.productEmoji,
        totalLots: 0,
        totalUnits: 0,
        totalSold: 0,
        grossTurnover: 0,
        commissionEarned: 0,
        minRate: Infinity,
        maxRate: 0,
        rates: [],
      };

      const lotGross = dateFilter === 'all'
        ? lot.summary.grossSales
        : salesInDate.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
      const lotSold = dateFilter === 'all'
        ? lot.summary.totalSoldQuantity
        : salesInDate.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
      const lotUnits = (dateFilter === 'all' || isArrival) ? lot.totalQuantity : lotSold;

      existing.totalLots += 1;
      existing.totalUnits += lotUnits;
      existing.totalSold += lotSold;
      existing.grossTurnover += lotGross;

      let comm = 0;
      if (lot.expenses?.commission?.enabled) {
        if (dateFilter === 'all') {
          comm = Number(lot.expenses.commission.amount) || 0;
        } else if (lot.expenses.commission.type === 'percentage') {
          comm = Math.round((lotGross * (Number(lot.expenses.commission.rate) || 0)) / 100);
        } else if (isArrival) {
          comm = Number(lot.expenses.commission.amount) || 0;
        } else if (lot.totalQuantity > 0 && lotSold > 0) {
          comm = Math.round(((Number(lot.expenses.commission.amount) || 0) * lotSold) / lot.totalQuantity);
        }
      }
      existing.commissionEarned += comm;

      const salesForRates = dateFilter === 'all' ? lot.sales : salesInDate;
      salesForRates.forEach((s) => {
        if (s.ratePerUnit > 0) {
          existing.rates.push(s.ratePerUnit);
          if (s.ratePerUnit < existing.minRate) existing.minRate = s.ratePerUnit;
          if (s.ratePerUnit > existing.maxRate) existing.maxRate = s.ratePerUnit;
        }
      });

      prodMap.set(lot.productName, existing);
    });

    return Array.from(prodMap.values()).map((p) => {
      const avgRate = p.rates.length > 0 ? Math.round(p.rates.reduce((a, b) => a + b, 0) / p.rates.length) : 0;
      return {
        ...p,
        minRate: p.minRate === Infinity ? 0 : p.minRate,
        avgRate,
      };
    }).filter((p) =>
      p.productUrdu.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredLotsByDate, selectedProductFilter, searchTerm, dateFilter, customFromDate, customToDate]);

  // 4. EXPENSES REPORT DATA (دکان کے روزنامچہ و عمومی اخراجات)
  const filteredExpensesByDate = useMemo(() => {
    return (expenses || []).filter((exp) => isLotInDateRange(exp.date));
  }, [expenses, dateFilter, customFromDate, customToDate]);

  const searchedExpenses = useMemo(() => {
    return filteredExpensesByDate.filter((e) => {
      if (selectedExpenseCategoryFilter !== 'all') {
        const matchesCat =
          e.category === selectedExpenseCategoryFilter ||
          (selectedExpenseCategoryFilter === 'tea_food' && (e.category as string) === 'tea');
        if (!matchesCat) return false;
      }
      if (selectedExpensePaymentMethodFilter !== 'all' && e.paymentMethod !== selectedExpensePaymentMethodFilter) {
        return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const catUrdu = expenseCategoryLabels[e.category]?.ur || '';
      const catEn = expenseCategoryLabels[e.category]?.en || '';
      return (
        e.title.toLowerCase().includes(term) ||
        (e.paidTo && e.paidTo.toLowerCase().includes(term)) ||
        (e.notes && e.notes.toLowerCase().includes(term)) ||
        catUrdu.toLowerCase().includes(term) ||
        catEn.toLowerCase().includes(term)
      );
    });
  }, [filteredExpensesByDate, selectedExpenseCategoryFilter, selectedExpensePaymentMethodFilter, searchTerm]);

  const expenseReportStats = useMemo(() => {
    const total = filteredExpensesByDate.reduce((sum, e) => sum + (e.amount || 0), 0);
    const cash = filteredExpensesByDate
      .filter((e) => e.paymentMethod === 'cash')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const online = filteredExpensesByDate
      .filter((e) => e.paymentMethod === 'online')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const cheque = filteredExpensesByDate
      .filter((e) => e.paymentMethod === 'cheque')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    return {
      total,
      cash,
      online,
      cheque,
      count: filteredExpensesByDate.length,
    };
  }, [filteredExpensesByDate]);

  // Get current date range string representation
  const getDateRangeDetails = () => {
    const dateFilterLabels: Record<DateFilter, string> = {
      all: isUrdu ? 'تمام تاریخیں' : 'All Time',
      today: isUrdu ? 'آج کی تاریخ' : "Today's Date",
      yesterday: isUrdu ? 'گزشتہ کل' : 'Yesterday',
      last7days: isUrdu ? 'گزشتہ 7 دن' : 'Last 7 Days',
      thismonth: isUrdu ? 'موجودہ مہینہ' : 'This Month',
      custom: `${customFromDate || 'From'} تا ${customToDate || 'To'}`,
    };

    let dateRangeStr = '';
    const now = new Date();
    if (dateFilter === 'custom') {
      dateRangeStr = `${customFromDate || 'Start'} to ${customToDate || 'End'}`;
    } else if (dateFilter === 'today') {
      dateRangeStr = now.toISOString().slice(0, 10);
    } else if (dateFilter === 'yesterday') {
      dateRangeStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    } else if (dateFilter === 'last7days') {
      const past7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      dateRangeStr = `${past7} to ${now.toISOString().slice(0, 10)}`;
    } else if (dateFilter === 'thismonth') {
      dateRangeStr = `${now.toISOString().slice(0, 7)} (Monthly)`;
    } else {
      dateRangeStr = isUrdu ? 'تمام دستیاب تاریخیں' : 'All Available Dates';
    }

    return {
      label: dateFilterLabels[dateFilter],
      rangeStr: dateRangeStr,
    };
  };

  // Pagination for Date (Lots) Report
  const [dateReportPage, setDateReportPage] = useState(1);
  const [dateReportPageSize, setDateReportPageSize] = useState(25);
  const dateReportTotalPages = Math.ceil(filteredLotsByDate.length / dateReportPageSize) || 1;
  const paginatedLotsByDate = useMemo(() => {
    const start = (dateReportPage - 1) * dateReportPageSize;
    return filteredLotsByDate.slice(start, start + dateReportPageSize);
  }, [filteredLotsByDate, dateReportPage, dateReportPageSize]);

  // Pagination for Vendor Report
  const [vendorReportPage, setVendorReportPage] = useState(1);
  const [vendorReportPageSize, setVendorReportPageSize] = useState(25);
  const vendorReportTotalPages = Math.ceil(vendorReports.length / vendorReportPageSize) || 1;
  const paginatedVendorReports = useMemo(() => {
    const start = (vendorReportPage - 1) * vendorReportPageSize;
    return vendorReports.slice(start, start + vendorReportPageSize);
  }, [vendorReports, vendorReportPage, vendorReportPageSize]);

  // Pagination for Customer Report
  const [custReportPage, setCustReportPage] = useState(1);
  const [custReportPageSize, setCustReportPageSize] = useState(25);
  const custReportTotalPages = Math.ceil(customerReports.length / custReportPageSize) || 1;
  const paginatedCustomerReports = useMemo(() => {
    const start = (custReportPage - 1) * custReportPageSize;
    return customerReports.slice(start, start + custReportPageSize);
  }, [customerReports, custReportPage, custReportPageSize]);

  // Pagination for Product Report
  const [prodReportPage, setProdReportPage] = useState(1);
  const [prodReportPageSize, setProdReportPageSize] = useState(25);
  const prodReportTotalPages = Math.ceil(productReports.length / prodReportPageSize) || 1;
  const paginatedProductReports = useMemo(() => {
    const start = (prodReportPage - 1) * prodReportPageSize;
    return productReports.slice(start, start + prodReportPageSize);
  }, [productReports, prodReportPage, prodReportPageSize]);

  // Pagination for Expense Report
  const [expenseReportPage, setExpenseReportPage] = useState(1);
  const [expenseReportPageSize, setExpenseReportPageSize] = useState(25);
  const expenseReportTotalPages = Math.ceil(searchedExpenses.length / expenseReportPageSize) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (expenseReportPage - 1) * expenseReportPageSize;
    return searchedExpenses.slice(start, start + expenseReportPageSize);
  }, [searchedExpenses, expenseReportPage, expenseReportPageSize]);

  // Preview PDF for Current Tab Report (Filtered by Selected Date Range)
  const handlePreviewPDF = () => {
    sound.playTick();

    const { label: dateFilterLabel, rangeStr: dateRangeStr } = getDateRangeDetails();

    let previewData: PDFPreviewData;

    if (activeReport === 'customer') {
      const customerRows = customerReports.map((c) => ({
        customerName: c.customerName,
        phone: c.phone || '',
        purchasesCount: c.totalPurchases,
        unitsBought: c.totalUnitsBought,
        totalAmount: c.totalAmount,
        cashPaid: c.cashPaid,
        creditPending: c.creditPending,
      }));

      previewData = buildReportPDF({
        reportType: 'customer',
        settings,
        dateFilterLabel,
        dateRangeStr,
        summary: {
          grossSales: customerReports.reduce((a, b) => a + b.totalAmount, 0),
          commission: dateReportStats.commission,
          cashReceived: customerReports.reduce((a, b) => a + b.cashPaid, 0),
          creditPending: customerReports.reduce((a, b) => a + b.creditPending, 0),
          unitsSold: customerReports.reduce((a, b) => a + b.totalUnitsBought, 0),
          vendorPayable: dateReportStats.vendorPending,
        },
        customerRows,
      });
    } else if (activeReport === 'product') {
      const productRows = productReports.map((p) => ({
        productName: p.productUrdu || p.productName,
        totalLots: p.totalLots,
        totalUnits: p.totalUnits,
        soldUnits: p.totalSold,
        grossTurnover: p.grossTurnover,
        avgRate: p.avgRate,
        minRate: p.minRate,
        maxRate: p.maxRate,
        commission: p.commissionEarned,
      }));

      previewData = buildReportPDF({
        reportType: 'product',
        settings,
        dateFilterLabel,
        dateRangeStr,
        summary: {
          grossSales: productReports.reduce((a, b) => a + b.grossTurnover, 0),
          commission: productReports.reduce((a, b) => a + b.commissionEarned, 0),
          cashReceived: dateReportStats.cashReceived,
          creditPending: dateReportStats.creditPending,
          unitsSold: productReports.reduce((a, b) => a + b.totalSold, 0),
          vendorPayable: dateReportStats.vendorPending,
        },
        productRows,
      });
    } else if (activeReport === 'vendor') {
      const vendorRows = vendorReports.map((v) => {
        const isPaid = v.pendingBalance <= 0 && v.netPayable > 0;
        const isPartial = v.totalPaid > 0 && v.pendingBalance > 0;
        const status: 'paid' | 'partial' | 'pending' | 'cash' | 'credit' = isPaid ? 'paid' : isPartial ? 'partial' : 'pending';

        return {
          vendorName: v.vendorName,
          city: v.vendorCity || '',
          phone: v.vendorPhone || '',
          lotsCount: v.lotsCount,
          totalUnits: v.totalUnits,
          unitsSold: v.unitsSold,
          grossSales: v.grossSales,
          commission: v.commission,
          netPayable: v.netPayable,
          totalPaid: v.totalPaid,
          pendingBalance: v.pendingBalance,
          paymentStatus: status,
        };
      });

      const totalVendorGross = vendorReports.reduce((a, b) => a + b.grossSales, 0);
      const totalVendorCommission = vendorReports.reduce((a, b) => a + b.commission, 0);
      const totalVendorExpenses = vendorReports.reduce((a, b) => a + b.totalExpenses, 0);
      const totalVendorPayable = vendorReports.reduce((a, b) => a + b.netPayable, 0);
      const totalVendorPaid = vendorReports.reduce((a, b) => a + b.totalPaid, 0);
      const totalVendorPending = vendorReports.reduce((a, b) => a + b.pendingBalance, 0);
      const totalUnitsSold = vendorReports.reduce((a, b) => a + b.unitsSold, 0);
      const totalLotsCount = vendorReports.reduce((a, b) => a + b.lotsCount, 0);

      previewData = buildReportPDF({
        reportType: 'vendor',
        settings,
        dateFilterLabel,
        dateRangeStr,
        summary: {
          grossSales: totalVendorGross,
          commission: totalVendorCommission,
          totalExpenses: totalVendorExpenses,
          vendorPayable: totalVendorPayable,
          vendorPaid: totalVendorPaid,
          vendorPending: totalVendorPending,
          cashReceived: totalVendorPaid, // Cash paid to vendors
          creditPending: totalVendorPending, // Credit pending to vendors
          unitsSold: totalUnitsSold,
          lotsCount: totalLotsCount,
        },
        vendorRows,
      });
    } else if (activeReport === 'expenses') {
      previewData = buildExpenseReportPDF(
        searchedExpenses,
        settings,
        dateFilterLabel,
        expenseReportStats.total,
        expenseReportStats.cash,
        expenseReportStats.online
      );
    } else {
      // Date report
      const dateRows = filteredLotsByDate.map((l) => {
        const salesInDate = l.sales.filter((s) => {
          if (dateFilter === 'all') return true;
          return isDateInRange(getSaleDate(s, l));
        });
        const isArrival = isDateInRange(l.arrivalDate);
        const lotGross = dateFilter === 'all'
          ? l.summary.grossSales
          : salesInDate.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
        const lotSold = dateFilter === 'all'
          ? l.summary.totalSoldQuantity
          : salesInDate.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
        let comm = 0;
        if (l.expenses?.commission?.enabled) {
          if (dateFilter === 'all') {
            comm = l.summary.arhtiProfitCommission;
          } else if (l.expenses.commission.type === 'percentage') {
            comm = Math.round((lotGross * (Number(l.expenses.commission.rate) || 0)) / 100);
          } else if (isArrival) {
            comm = Number(l.expenses.commission.amount) || 0;
          } else if (l.totalQuantity > 0 && lotSold > 0) {
            comm = Math.round(((Number(l.expenses.commission.amount) || 0) * lotSold) / l.totalQuantity);
          }
        }
        const recordDate = dateFilter === 'all' ? l.arrivalDate : (salesInDate[0] ? getSaleDate(salesInDate[0], l) : l.arrivalDate);
        return {
          lotNumber: l.lotNumber,
          date: recordDate,
          vendor: l.vendorName,
          product: l.productUrdu,
          totalQty: (dateFilter === 'all' || isArrival) ? l.totalQuantity : lotSold,
          soldQty: lotSold,
          grossSales: lotGross,
          commission: comm,
          netPayable: Math.max(0, lotGross - comm),
        };
      });

      previewData = buildReportPDF({
        reportType: 'date',
        settings,
        dateFilterLabel,
        dateRangeStr,
        summary: {
          grossSales: dateReportStats.grossSales,
          commission: dateReportStats.commission,
          cashReceived: dateReportStats.cashReceived,
          creditPending: dateReportStats.creditPending,
          unitsSold: dateReportStats.unitsSold,
          lotsCount: dateReportStats.lotsCount,
          vendorPayable: dateReportStats.vendorPending,
        },
        dateRows,
      });
    }

    setPdfPreview(previewData);
  };

  // Preview Complete Entire Record Master Report (All Details in One File)
  const handlePreviewEntireRecordPDF = () => {
    sound.playCashChime();

    const { label: dateFilterLabel, rangeStr: dateRangeStr } = getDateRangeDetails();

    const previewData = buildEntireRecordReportPDF({
      lots: filteredLotsByDate,
      settings,
      dateFilterLabel: `${dateFilterLabel} (تمام تفصیلات)`,
      dateRangeStr,
      customers,
    });

    setPdfPreview(previewData);
  };

  // Export CSV function
  const handleExportCSV = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    let csvContent = '\uFEFF'; // Add UTF-8 BOM for Urdu support in Excel

    if (activeReport === 'vendor') {
      csvContent += 'Vendor Name,City,Phone,Lots,Total Qty,Sold Qty,Gross Sales,Total Expenses,Commission,Net Payable,Pending Balance\n';
      vendorReports.forEach((v) => {
        csvContent += `"${v.vendorName}","${v.vendorCity || ''}","${v.vendorPhone || ''}",${v.lotsCount},${v.totalUnits},${v.unitsSold},${v.grossSales},${v.totalExpenses},${v.commission},${v.netPayable},${v.pendingBalance}\n`;
      });
    } else if (activeReport === 'customer') {
      csvContent += 'Customer Name,Phone,Purchases Count,Units Bought,Total Amount,Cash Paid,Credit Pending\n';
      customerReports.forEach((c) => {
        csvContent += `"${c.customerName}","${c.phone || ''}",${c.totalPurchases},${c.totalUnitsBought},${c.totalAmount},${c.cashPaid},${c.creditPending}\n`;
      });
    } else if (activeReport === 'product') {
      csvContent += 'Product,Total Lots,Total Units,Sold Units,Gross Turnover,Avg Rate,Min Rate,Max Rate,Commission\n';
      productReports.forEach((p) => {
        csvContent += `"${p.productUrdu}",${p.totalLots},${p.totalUnits},${p.totalSold},${p.grossTurnover},${p.avgRate},${p.minRate},${p.maxRate},${p.commissionEarned}\n`;
      });
    } else if (activeReport === 'expenses') {
      csvContent += 'Date,Category,Title,Paid To,Payment Method,Amount,Receipt No,Notes\n';
      searchedExpenses.forEach((e) => {
        const cat = expenseCategoryLabels[e.category]?.en || e.category;
        csvContent += `"${e.date}","${cat}","${e.title}","${e.paidTo || ''}","${e.paymentMethod}",${e.amount},"${e.receiptNumber || ''}","${e.notes || ''}"\n`;
      });
    } else {
      csvContent += 'Lot #,Date,Vendor,Product,Total Qty,Sold Qty,Gross Sales,Expenses,Commission,Net Payable\n';
      filteredLotsByDate.forEach((l) => {
        const salesInDate = l.sales.filter((s) => dateFilter === 'all' || isDateInRange(getSaleDate(s, l)));
        const isArrival = isDateInRange(l.arrivalDate);
        const lotGross = dateFilter === 'all' ? l.summary.grossSales : salesInDate.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
        const lotSold = dateFilter === 'all' ? l.summary.totalSoldQuantity : salesInDate.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
        let comm = 0;
        if (l.expenses?.commission?.enabled) {
          if (dateFilter === 'all') comm = l.summary.arhtiProfitCommission;
          else if (l.expenses.commission.type === 'percentage') comm = Math.round((lotGross * (Number(l.expenses.commission.rate) || 0)) / 100);
          else if (isArrival) comm = Number(l.expenses.commission.amount) || 0;
          else if (l.totalQuantity > 0 && lotSold > 0) comm = Math.round(((Number(l.expenses.commission.amount) || 0) * lotSold) / l.totalQuantity);
        }
        const recordDate = dateFilter === 'all' ? l.arrivalDate : (salesInDate[0] ? getSaleDate(salesInDate[0], l) : l.arrivalDate);
        csvContent += `"${l.lotNumber}","${recordDate}","${l.vendorName}","${l.productUrdu}",${(dateFilter === 'all' || isArrival) ? l.totalQuantity : lotSold},${lotSold},${lotGross},${comm},${comm},${Math.max(0, lotGross - comm)}\n`;
      });
    }

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = `mandi_report_${activeReport}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.target = '_self';
      link.rel = 'noopener noreferrer';
      link.onclick = (ev) => ev.stopPropagation();
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          if (link.parentNode) link.parentNode.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }, 2000);
    } catch (err) {
      console.error('CSV export error:', err);
    }
  };

  // WhatsApp Share function
  const handleShareWhatsApp = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    let text = `*📊 ${settings.shopNameUrdu}*\n`;
    text += `*${t.reportsTitle} (${dateFilter.toUpperCase()})*\n`;
    text += `📅 تاریخ: ${new Date().toLocaleDateString('en-PK')}\n`;
    text += `--------------------------\n`;
    if (activeReport === 'expenses') {
      text += `💸 *رپورٹ:* دکان روزنامچہ و اخراجات\n`;
      text += `💰 *کل دکان اخراجات:* ${formatPKR(expenseReportStats.total, settings.currencySymbol, settings.language)}\n`;
      text += `💵 *نقد ادائیگی:* ${formatPKR(expenseReportStats.cash, settings.currencySymbol, settings.language)}\n`;
      text += `💳 *آن لائن / بینک:* ${formatPKR(expenseReportStats.online, settings.currencySymbol, settings.language)}\n`;
      text += `📝 *کل اندراجات:* ${searchedExpenses.length} ریکارڈز\n`;
    } else {
      text += `💰 *کل فروخت:* ${formatPKR(dateReportStats.grossSales, settings.currencySymbol, settings.language)}\n`;
      text += `💎 *خالص کمیشن منافع:* ${formatPKR(dateReportStats.commission, settings.currencySymbol, settings.language)}\n`;
      text += `👷 *کل مزدوری کٹوتی:* ${formatPKR(dateReportStats.totalMazdoori, settings.currencySymbol, settings.language)}\n`;
      text += `✍️ *کل منشیانہ:* ${formatPKR(dateReportStats.totalMunshiana, settings.currencySymbol, settings.language)}\n`;
      text += `📦 *کل مال فروخت:* ${dateReportStats.unitsSold} تعداد\n`;
      text += `💵 *نقد وصولی:* ${formatPKR(dateReportStats.cashReceived, settings.currencySymbol, settings.language)}\n`;
      text += `⏳ *بقایا کھاتہ ادھار:* ${formatPKR(dateReportStats.creditPending, settings.currencySymbol, settings.language)}\n`;
      text += `🤝 *زمینداروں کا واجب الادا:* ${formatPKR(dateReportStats.vendorPending, settings.currencySymbol, settings.language)}\n`;
      text += `💼 *موجودہ گلہ کیش:* ${formatPKR(cashDrawerSummary.netCashInDrawer, settings.currencySymbol, settings.language)}\n`;
    }
    text += `--------------------------\n`;
    text += `👤 *آڑھتی:* ${settings.arhtiNameUrdu}\n`;
    text += `📞 *رابطہ:* ${settings.shopPhone}`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };


  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    window.print();
  };

  return (
    <div className="space-y-4 pb-16 sm:pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-xl shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-urdu-nastaliq">
              {t.reportsTitle}
            </h2>
            <p className="text-xs text-slate-500 font-urdu-sans">
              {t.reportsSubtitle}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Entire Record Master PDF Button (All Records in One File with Details) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePreviewEntireRecordPDF();
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans shadow-md border border-emerald-600/30"
            title={isUrdu ? 'دکان کی تمام تفصیلات، مزدوری، منشیانہ، مجموعی فروخت اور منافع کی مکمل مشترکہ رپورٹ' : 'Complete Shop Report with labour, manshiyana, gross sales and profit'}
          >
            <FileCheck className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>{isUrdu ? '📑 مکمل دکان رپورٹ (تمام تفصیلات)' : '📑 Entire Shop Report (All Details)'}</span>
          </button>

          {/* Current Tab Dynamic PDF Report Preview Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePreviewPDF();
            }}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans shadow-md border border-rose-500"
            title={`منتخب تاریخ برائے ${activeReport} رپورٹ دیکھیں`}
          >
            <Eye className="w-4 h-4" />
            <span>
              {activeReport === 'customer'
                ? isUrdu ? `👥 گاہک رپورٹ (${getDateRangeDetails().label})` : `👥 Customer Report (${getDateRangeDetails().label})`
                : activeReport === 'product'
                ? isUrdu ? `📦 جنس رپورٹ (${getDateRangeDetails().label})` : `📦 Product Report (${getDateRangeDetails().label})`
                : activeReport === 'vendor'
                ? isUrdu ? `🚜 زمیندار رپورٹ (${getDateRangeDetails().label})` : `🚜 Vendor Report (${getDateRangeDetails().label})`
                : activeReport === 'expenses'
                ? isUrdu ? `💸 دکان اخراجات (${getDateRangeDetails().label})` : `💸 Shop Expenses (${getDateRangeDetails().label})`
                : isUrdu ? `📅 روزنامچہ رپورٹ (${getDateRangeDetails().label})` : `📅 Daily Report (${getDateRangeDetails().label})`}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => handleExportCSV(e)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans active:scale-95 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.exportCSV}</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleShareWhatsApp(e)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans active:scale-95 shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t.shareReportWA}</span>
          </button>
          <button
            type="button"
            onClick={(e) => handlePrint(e)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans active:scale-95 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.printReport}</span>
          </button>
        </div>
      </div>

      {/* Cash in Drawer Quick Status Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-3.5 sm:p-4 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl border border-emerald-500/30">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 font-urdu-sans">
                {isUrdu ? 'موجودہ گلہ کیش (Cash in Drawer):' : 'Current Cash in Drawer:'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-bold font-urdu-sans border border-emerald-400/30">
                {isUrdu ? 'دکان کیش دراز' : 'Live Shop Till'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
              <span className={`text-xl sm:text-2xl font-black font-numbers ${cashDrawerSummary.netCashInDrawer >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatPKR(cashDrawerSummary.netCashInDrawer, settings.currencySymbol, settings.language)}
              </span>
              <span className="text-[10px] text-slate-400 font-urdu-sans">
                ({isUrdu ? 'کل آمد:' : 'In:'} {formatPKR(cashDrawerSummary.totalCashIn, settings.currencySymbol, settings.language)} - {isUrdu ? 'کل اخراج:' : 'Out:'} {formatPKR(cashDrawerSummary.totalCashOut, settings.currencySymbol, settings.language)})
              </span>
            </div>
          </div>
        </div>

        {/* Cash in Drawer Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              sound.playTick();
              setIsCashDrawerModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 border border-white/15"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-300" />
            <span>{isUrdu ? 'مکمل گلہ کھاتہ و فارمولا' : 'Drawer Details'}</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards at the Top */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3">
        {/* 1. Gross Total */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold font-urdu-sans block">{t.grossTotal}</span>
          <span className="text-base sm:text-lg font-black text-slate-900 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.grossSales, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-slate-400 font-urdu-sans">
            {dateReportStats.lotsCount} {t.totalLotsCount} ({getDateRangeDetails().label})
          </span>
        </div>

        {/* 2. Arhti Commission */}
        <div className="bg-emerald-50 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[11px] text-emerald-800 font-bold font-urdu-sans block">{t.netArhtiCommission}</span>
          <span className="text-base sm:text-lg font-black text-emerald-950 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.commission, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-emerald-700 font-urdu-sans">
            {isUrdu ? 'آڑھت خالص منافع' : 'Arhti Net Profit'}
          </span>
        </div>

        {/* 3. Mazdoori (کل مزدوری) */}
        <div className="bg-blue-50 p-3.5 sm:p-4 rounded-2xl border border-blue-200 shadow-xs">
          <span className="text-[11px] text-blue-900 font-bold font-urdu-sans block">
            {isUrdu ? 'کل مزدوری' : 'Total Mazdoori'}
          </span>
          <span className="text-base sm:text-lg font-black text-blue-950 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.totalMazdoori, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-blue-700 font-urdu-sans">
            {isUrdu ? 'حمالی و پلیداری کٹوتی' : 'Labor deduction'}
          </span>
        </div>

        {/* 4. Munshiana (کل منشیانہ) */}
        <div className="bg-purple-50 p-3.5 sm:p-4 rounded-2xl border border-purple-200 shadow-xs">
          <span className="text-[11px] text-purple-900 font-bold font-urdu-sans block">
            {isUrdu ? 'کل منشیانہ' : 'Total Munshiana'}
          </span>
          <span className="text-base sm:text-lg font-black text-purple-950 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.totalMunshiana, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-purple-700 font-urdu-sans">
            {isUrdu ? 'دفتر و رائٹنگ فیس' : 'Office fee'}
          </span>
        </div>

        {/* 5. Payable to Vendors (زمیندار واجب الادا) */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] text-slate-300 font-bold font-urdu-sans block">
              {isUrdu ? 'زمیندار واجب الادا' : 'Payable to Vendors'}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold font-urdu-sans ${
                dateReportStats.vendorPending > 0
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {dateReportStats.vendorPending > 0 ? (isUrdu ? 'بقایا' : 'Pending') : (isUrdu ? 'مکمل ادا' : 'Paid')}
            </span>
          </div>
          <span className="text-base sm:text-lg font-black text-white font-numbers block mt-0.5">
            {formatPKR(dateReportStats.vendorPending, settings.currencySymbol, settings.language)}
          </span>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-urdu-sans mt-0.5">
            <span>{isUrdu ? 'میزان:' : 'Net:'} {formatPKR(dateReportStats.vendorPayable, settings.currencySymbol, settings.language)}</span>
            <span>{isUrdu ? 'ادا:' : 'Paid:'} {formatPKR(dateReportStats.vendorPaid, settings.currencySymbol, settings.language)}</span>
          </div>
        </div>

        {/* 6. Cash Received */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold font-urdu-sans block">{t.cashCollected} (نقد)</span>
          <span className="text-base sm:text-lg font-black text-emerald-700 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.cashReceived, settings.currencySymbol, settings.language)}
          </span>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-urdu-sans mt-0.5 flex-wrap gap-1">
            <span>{isUrdu ? 'سیل نقد:' : 'Sales:'} {formatPKR(dateReportStats.directCashReceived, settings.currencySymbol, settings.language)}</span>
            <span>{isUrdu ? 'کھاتہ وصولی:' : 'Khata:'} {formatPKR(dateReportStats.totalKhataPaid, settings.currencySymbol, settings.language)}</span>
          </div>
        </div>

        {/* 7. Customer Credit Outstanding */}
        <div className="bg-amber-50 p-3.5 sm:p-4 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[11px] text-amber-900 font-bold font-urdu-sans block">{t.creditOutstanding} (ادھار)</span>
          <span className="text-base sm:text-lg font-black text-amber-800 font-numbers block mt-0.5">
            {formatPKR(dateFilter === 'all' ? dateReportStats.allTimeCustomerCredit : dateReportStats.creditPending, settings.currencySymbol, settings.language)}
          </span>
          <div className="flex items-center justify-between text-[10px] text-amber-700 font-urdu-sans mt-0.5">
            <span>{isUrdu ? 'کل واجب الوصول:' : 'Total Due:'} {formatPKR(dateReportStats.allTimeCustomerCredit, settings.currencySymbol, settings.language)}</span>
          </div>
        </div>
      </div>

      {/* Date Filter & Report Category Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Main Category Tabs */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar border-b border-slate-100 pb-3">
          {[
            { id: 'date' as ReportType, label: t.reportByDate, icon: Calendar },
            { id: 'vendor' as ReportType, label: t.reportByVendor, icon: User },
            { id: 'customer' as ReportType, label: t.reportByCustomer, icon: Users },
            { id: 'product' as ReportType, label: t.reportByProduct, icon: Package },
            { id: 'expenses' as ReportType, label: isUrdu ? 'دکان اخراجات' : 'Shop Expenses', icon: Wallet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sound.playTick();
                  setActiveReport(tab.id);
                  setSearchTerm('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition whitespace-nowrap active:scale-95 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="font-urdu-sans">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Date Range Chips */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-bold font-urdu-sans mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.dateRange}:</span>
            </span>
            {[
              { id: 'all' as DateFilter, label: t.allTime },
              { id: 'today' as DateFilter, label: t.today },
              { id: 'yesterday' as DateFilter, label: t.yesterday },
              { id: 'last7days' as DateFilter, label: t.last7Days },
              { id: 'thismonth' as DateFilter, label: t.thisMonth },
              { id: 'custom' as DateFilter, label: t.customRange },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  sound.playTick();
                  setDateFilter(f.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex-shrink-0 ${
                  dateFilter === f.id
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isUrdu ? 'تلاش کریں (نام، شہر، جنس)...' : 'Search name, city, product...'}
              className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 rtl:right-3 rtl:left-auto top-2.5" />
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'custom' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 flex-wrap animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-urdu-sans">
              <span className="font-bold text-slate-700">{t.fromDate}:</span>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-numbers"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-urdu-sans">
              <span className="font-bold text-slate-700">{t.toDate}:</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-numbers"
              />
            </div>
          </div>
        )}
      </div>

      {/* REPORT CONTENT PER ACTIVE TAB */}

      {/* 1. DATE REPORT: LOT-BY-LOT DAILY STATEMENT */}
      {activeReport === 'date' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                <span>{t.dailySummary} ({filteredLotsByDate.length} {isUrdu ? 'لاٹس' : 'Lots'})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold font-urdu-sans">
                {getDateRangeDetails().label}
              </span>
            </div>

            <button
              onClick={handlePreviewPDF}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs active:scale-95"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isUrdu ? `روزنامچہ پی ڈی ایف (${getDateRangeDetails().label})` : `Roznamcha PDF (${getDateRangeDetails().label})`}</span>
            </button>
          </div>

          {filteredLotsByDate.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {t.noReportsFound}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paginatedLotsByDate.map((lot) => {
                const salesInDate = lot.sales.filter((s) => {
                  if (dateFilter === 'all') return true;
                  return isDateInRange(getSaleDate(s, lot));
                });
                const isArrival = isDateInRange(lot.arrivalDate);
                const lotGrossOnDate = dateFilter === 'all'
                  ? lot.summary.grossSales
                  : salesInDate.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
                const lotSoldOnDate = dateFilter === 'all'
                  ? lot.summary.totalSoldQuantity
                  : salesInDate.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

                let commOnDate = 0;
                if (lot.expenses?.commission?.enabled) {
                  if (dateFilter === 'all') {
                    commOnDate = lot.summary.arhtiProfitCommission;
                  } else if (lot.expenses.commission.type === 'percentage') {
                    commOnDate = Math.round((lotGrossOnDate * (Number(lot.expenses.commission.rate) || 0)) / 100);
                  } else if (isArrival) {
                    commOnDate = Number(lot.expenses.commission.amount) || 0;
                  } else if (lot.totalQuantity > 0 && lotSoldOnDate > 0) {
                    commOnDate = Math.round(((Number(lot.expenses.commission.amount) || 0) * lotSoldOnDate) / lot.totalQuantity);
                  }
                }

                return (
                  <div
                    key={lot.id}
                    className="p-3 sm:p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xl flex items-center justify-center flex-shrink-0">
                        {lot.productEmoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq truncate">
                            {lot.vendorName}
                          </h4>
                          <span
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-numbers"
                            title={`رسید نمبر: #${getLotReceiptNumber(lot.lotNumber, lot.billNumber)}`}
                          >
                            #{getLotReceiptNumber(lot.lotNumber, lot.billNumber)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-numbers">
                            {lot.arrivalDate}
                          </span>
                          {dateFilter !== 'all' && !isArrival && salesInDate.length > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold font-urdu-sans border border-blue-200">
                              {isUrdu ? 'اس تاریخ کی بولی' : 'Bid on selected date'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                          {lot.productUrdu} • {lot.totalQuantity} {getUnitDisplayLabel(lot.unitType, settings.language)} (
                          <strong className="text-blue-700">
                            {dateFilter === 'all'
                              ? `${lot.summary.totalSoldQuantity} فروخت`
                              : `${lotSoldOnDate} اس تاریخ پر فروخت (کل: ${lot.summary.totalSoldQuantity})`}
                          </strong>,{' '}
                          <strong className="text-amber-700">{lot.summary.remainingQuantity} باقی</strong>)
                        </p>
                      </div>
                    </div>

                    {/* Financial Figures & Direct Buttons */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-start sm:text-end">
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-numbers block">
                          {formatPKR(lotGrossOnDate, settings.currencySymbol, settings.language)}
                        </span>
                        <span className="text-[11px] text-emerald-800 font-numbers font-semibold block">
                          کمیشن: {formatPKR(commOnDate, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Preview & Download PDF button for this specific lot report by date */}
                        <button
                          onClick={() => {
                            sound.playTick();
                            const preview = buildSingleLotReportPDF(lot, settings, getDateRangeDetails().label);
                            setPdfPreview(preview);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs"
                          title="اس لاٹ کی پی ڈی ایف رپورٹ دیکھیں یا ڈاؤن لوڈ کریں"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>پی ڈی ایف</span>
                        </button>

                        {onOpenExpenseSlip && (
                          <button
                            onClick={() => onOpenExpenseSlip(lot.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold font-urdu-sans transition"
                            title="زمیندار کی اخراجات پرچی و کٹوتیاں"
                          >
                            {isUrdu ? 'اخراجات پرچی' : 'Slip Expenses'}
                          </button>
                        )}
                        {onOpenReceipt && (
                          <button
                            onClick={() => onOpenReceipt(lot.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold font-urdu-sans transition"
                          >
                            {t.tabReceipt}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredLotsByDate.length > 0 && (
            <div className="p-3 border-t border-slate-200">
              <PaginationControls
                currentPage={dateReportPage}
                totalPages={dateReportTotalPages}
                totalItems={filteredLotsByDate.length}
                pageSize={dateReportPageSize}
                onPageChange={setDateReportPage}
                onPageSizeChange={setDateReportPageSize}
                isUrdu={isUrdu}
                itemName={isUrdu ? 'لاٹس' : 'lots'}
              />
            </div>
          )}
        </div>
      )}

      {/* 2. VENDOR REPORT: SUMMARY PER VENDOR */}
      {activeReport === 'vendor' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <User className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                <span>{t.reportByVendor} ({vendorReports.length} {isUrdu ? 'زمیندار' : 'Vendors'})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold font-urdu-sans">
                {getDateRangeDetails().label}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Vendor Selector Filter */}
              <select
                value={selectedVendorFilter}
                onChange={(e) => setSelectedVendorFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">{isUrdu ? 'تمام زمیندار (All Vendors)' : 'All Vendors'}</option>
                {allVendors.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} {v.city ? `(${v.city})` : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePreviewPDF}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isUrdu ? `زمیندار رپورٹ پی ڈی ایف (${getDateRangeDetails().label})` : `Vendor PDF (${getDateRangeDetails().label})`}</span>
              </button>

              {/* All Vendor Bills Modal Trigger */}
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setIsAllVendorBillsOpen(true);
                }}
                className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
                title="تمام زمینداروں کے پکے بل دیکھیں یا ایک ساتھ پرنٹ کریں"
              >
                <Printer className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>{isUrdu ? 'سب زمینداروں کے بل (بل بک پرنٹ)' : 'All Vendor Bills (Batch Print)'}</span>
              </button>
            </div>
          </div>

          {vendorReports.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {t.noReportsFound}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paginatedVendorReports.map((v) => (
                <div key={v.vendorName} className="p-3.5 sm:p-4 hover:bg-slate-50 transition space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq">
                          {v.vendorName}
                        </h4>
                        {v.vendorCity && (
                          <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-urdu-sans">
                            {v.vendorCity}
                          </span>
                        )}
                        {v.vendorPhone && (
                          <span className="text-[11px] text-slate-500 font-numbers">
                            📞 {v.vendorPhone}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                        {v.lotsCount} {t.totalLotsCount} • {v.totalUnits} کل یونٹس ({v.unitsSold} فروخت شدہ)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      {/* Gross Sales */}
                      <div className="text-start sm:text-end">
                        <span className="text-[10px] text-slate-500 font-urdu-sans block">{t.grossTotal}:</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-numbers block">
                          {formatPKR(v.grossSales, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      {/* Net Payable */}
                      <div className="text-start sm:text-end bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-700 font-bold font-urdu-sans block">{t.netVendorPayable}:</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-950 font-numbers block">
                          {formatPKR(v.netPayable, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                        <button
                          onClick={() => {
                            sound.playTick();
                            const preview = buildSingleVendorReportPDF(v, settings, getDateRangeDetails().label);
                            setPdfPreview(preview);
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs"
                          title="اس زمیندار کی سپلائی رپورٹ پی ڈی ایف دیکھیں"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>پی ڈی ایف</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Micro lots list for this vendor with 'See All Bill' option and sub-pagination */}
                  {(() => {
                    const vendorLotsPageSize = 6;
                    const currentVendorLotsPage = vendorLotsSubPages[v.vendorName] || 1;
                    const totalVendorLotsPages = Math.ceil(v.lots.length / vendorLotsPageSize) || 1;
                    const paginatedVendorLots = v.lots.slice(
                      (currentVendorLotsPage - 1) * vendorLotsPageSize,
                      currentVendorLotsPage * vendorLotsPageSize
                    );

                    return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-700 font-urdu-sans flex items-center gap-1.5">
                            <span>اجناس و لاٹس تفصیل ({v.lots.length}):</span>
                          </span>

                          {totalVendorLotsPages > 1 && (
                            <div className="flex items-center gap-1 text-[11px] font-urdu-sans">
                              <span className="text-slate-500 font-numbers text-[10px]">
                                ({currentVendorLotsPage}/{totalVendorLotsPages})
                              </span>
                              <button
                                type="button"
                                disabled={currentVendorLotsPage <= 1}
                                onClick={() =>
                                  setVendorLotsSubPages((prev) => ({
                                    ...prev,
                                    [v.vendorName]: Math.max(1, currentVendorLotsPage - 1),
                                  }))
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 disabled:opacity-40 hover:bg-slate-200 text-slate-700 text-[10px]"
                              >
                                ‹ پچھلا
                              </button>
                              <button
                                type="button"
                                disabled={currentVendorLotsPage >= totalVendorLotsPages}
                                onClick={() =>
                                  setVendorLotsSubPages((prev) => ({
                                    ...prev,
                                    [v.vendorName]: Math.min(totalVendorLotsPages, currentVendorLotsPage + 1),
                                  }))
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 disabled:opacity-40 hover:bg-slate-200 text-slate-700 text-[10px]"
                              >
                                اگلا ›
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Distribute Munshiana Button requested by user */}
                          <button
                            type="button"
                            onClick={() => {
                              sound.playTick();
                              if (inlineMunshianaVendor === v.vendorName) {
                                setInlineMunshianaVendor(null);
                              } else {
                                const curTotal = v.lots.reduce(
                                  (sum, l) =>
                                    sum + (l.expenses?.munshiana?.enabled ? Math.round(Number(l.expenses.munshiana.amount) || 0) : 0),
                                  0
                                );
                                setInlineMunshianaAmount(curTotal > 0 ? String(curTotal) : '150');
                                setInlineMunshianaVendor(v.vendorName);
                              }
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold font-urdu-sans flex items-center gap-1.5 shadow-xs transition active:scale-95 ${
                              inlineMunshianaVendor === v.vendorName
                                ? 'bg-purple-900 text-white ring-2 ring-purple-400'
                                : 'bg-purple-700 hover:bg-purple-800 text-white'
                            }`}
                            title={isUrdu ? 'اس زمیندار کی تمام لاٹس پر منشیانہ تقسیم کریں' : 'Distribute Munshiana to all lots of this vendor'}
                          >
                            <Coins className="w-3.5 h-3.5 text-purple-200" />
                            <span>{isUrdu ? 'منشیانہ تقسیم کریں' : 'Distribute Munshiana'}</span>
                          </button>

                          {inlineMunshianaSuccess === v.vendorName && (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-lg border border-emerald-300 flex items-center gap-1 font-urdu-sans animate-in fade-in">
                              <Check className="w-3 h-3 text-emerald-700" />
                              <span>{isUrdu ? 'منشیانہ تقسیم ہو گیا!' : 'Munshiana distributed!'}</span>
                            </span>
                          )}

                          {/* "See All Products Bill" Button requested by user */}
                          <button
                            onClick={() => {
                              sound.playTick();
                              const dateLabel =
                                dateFilter === 'today'
                                  ? isUrdu ? 'آج کی تاریخ' : "Today's Date"
                                  : dateFilter === 'yesterday'
                                  ? isUrdu ? 'گزشتہ کل' : 'Yesterday'
                                  : v.lots[0]?.arrivalDate || '';

                              setConsolidatedBillVendor({
                                vendorName: v.vendorName,
                                vendorPhone: v.vendorPhone,
                                vendorCity: v.vendorCity,
                                lots: v.lots,
                                dateLabel,
                              });
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-urdu-sans flex items-center gap-1.5 shadow-xs transition active:scale-95"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>{isUrdu ? 'تمام اجناس کا بل دیکھیں (کل مشترکہ بل)' : 'See All Products Bill'}</span>
                          </button>
                        </div>
                      </div>

                      {/* In-place Simple Distribute Munshiana Form */}
                      {inlineMunshianaVendor === v.vendorName && (
                        <div className="p-3 bg-purple-50/95 border-2 border-purple-300 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-950 font-urdu-sans flex items-center gap-1.5">
                              <Coins className="w-4 h-4 text-purple-700" />
                              <span>{isUrdu ? `منشیانہ مساوی تقسیم (${v.lots.length} لاٹس)` : `Distribute Munshiana (${v.lots.length} lots)`}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setInlineMunshianaVendor(null)}
                              className="text-purple-600 hover:text-purple-900 text-xs font-bold font-urdu-sans"
                            >
                              ✕ {isUrdu ? 'بند کریں' : 'Close'}
                            </button>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex-1 min-w-[130px] relative">
                              <input
                                type="number"
                                min="0"
                                value={inlineMunshianaAmount}
                                onChange={(e) => setInlineMunshianaAmount(e.target.value)}
                                placeholder="کل منشیانہ رقم"
                                className="w-full px-3 py-1.5 bg-white border border-purple-300 focus:border-purple-600 rounded-xl text-sm font-bold font-numbers text-slate-900 focus:ring-2 focus:ring-purple-200"
                                autoFocus
                              />
                              <span className="absolute end-2.5 top-2 text-[10px] text-purple-700 font-bold font-urdu-sans pointer-events-none">
                                {settings.currencySymbol}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {[2, 50, 100, 150, 200, 300].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => {
                                    sound.playTick();
                                    setInlineMunshianaAmount(String(preset));
                                  }}
                                  className="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 text-purple-900 rounded-lg text-xs font-numbers"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleApplyInlineMunshiana(v.vendorName, v.lots)}
                              className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-xs flex-shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isUrdu ? 'لاگو کریں' : 'Apply'}</span>
                            </button>
                          </div>

                          {/* Live preview */}
                          {(() => {
                            const parsed = Math.max(0, Math.round(parseNumber(inlineMunshianaAmount) || 0));
                            const dist = distributeMunshianaToLots(parsed, v.lots.length);
                            const previewText =
                              dist.length <= 5
                                ? dist.map((d) => `₨${d}`).join(' + ')
                                : `₨${Math.floor(parsed / v.lots.length)} سے ₨${Math.ceil(parsed / v.lots.length)}`;
                            return (
                              <div className="text-[11px] text-purple-900 font-urdu-sans flex items-center justify-between bg-purple-100/70 px-2.5 py-1 rounded-xl">
                                <span>
                                  {isUrdu ? 'کل رقم:' : 'Total:'} <b>₨{parsed}</b> • {isUrdu ? 'لاٹس پر تقسیم:' : 'Per lot:'}{' '}
                                  <b>{previewText} = ₨{parsed}</b>
                                </span>
                                <span className="text-[10px] text-emerald-800 font-bold font-urdu-sans">
                                  ✓ {isUrdu ? 'کوئی اعشاریہ فرق نہیں' : 'Exact integer rupees'}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {paginatedVendorLots.map((lot) => {
                          const lotNet = lot.summary.netPayableToVendor;
                          const lotPaid = lot.vendorPaymentAmount !== undefined ? lot.vendorPaymentAmount : (lot.vendorPaymentStatus === 'paid' ? lotNet : 0);
                          const isLotPaid = lot.vendorPaymentStatus === 'paid' || lotPaid >= lotNet;
                          const isPartial = lot.vendorPaymentStatus === 'partial' || (lotPaid > 0 && lotPaid < lotNet);

                          return (
                            <div
                              key={lot.id}
                              className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="truncate">
                                  <span className="font-bold text-slate-800 font-urdu-sans">
                                    {lot.productEmoji} {lot.productUrdu}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-numbers block">
                                    رسید #{getLotReceiptNumber(lot.lotNumber, lot.billNumber)} • {isUrdu ? 'تاریخ اندراج:' : 'Created:'} {(lot.arrivalDate || lot.createdAt || '').slice(0, 10)} ({lot.totalQuantity} {getUnitDisplayLabel(lot.unitType, settings.language)})
                                  </span>
                                </div>

                                <div className="text-end flex-shrink-0">
                                  <span className="font-bold text-slate-900 font-numbers block">
                                    {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-numbers block">
                                    {isUrdu ? 'خالص:' : 'Net:'} {formatPKR(lotNet, settings.currencySymbol, settings.language)}
                                  </span>
                                </div>
                              </div>

                              {/* Lot payment status and actions */}
                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isLotPaid ? (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold font-urdu-sans flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                      <span>{isUrdu ? 'ادا شدہ' : 'Paid'}</span>
                                      {lot.vendorPaymentDate && (
                                        <span className="text-[9px] text-emerald-700 font-numbers">({lot.vendorPaymentDate})</span>
                                      )}
                                    </span>
                                  ) : isPartial ? (
                                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold font-urdu-sans flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-blue-700" />
                                      <span>{isUrdu ? 'جزوی ادا' : 'Partial'}</span>
                                      <span className="text-[9px] text-blue-700 font-numbers">({formatPKR(lotPaid, settings.currencySymbol, settings.language)})</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold font-urdu-sans flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-amber-700" />
                                      <span>{isUrdu ? 'ادائیگی بقایا' : 'Pending'}</span>
                                    </span>
                                  )}

                                  {lot.vendorPaymentNotes && (
                                    <span className="text-[10px] text-slate-500 font-urdu-sans truncate max-w-[120px]" title={lot.vendorPaymentNotes}>
                                      📝 {lot.vendorPaymentNotes}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {onOpenReceipt && (
                                    <button
                                      onClick={() => onOpenReceipt(lot.id)}
                                      className="text-[10px] text-slate-600 hover:text-slate-900 hover:underline font-bold font-urdu-sans"
                                    >
                                      {isUrdu ? 'رسید' : 'Receipt'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {vendorReports.length > 0 && (
            <div className="p-3 border-t border-slate-200">
              <PaginationControls
                currentPage={vendorReportPage}
                totalPages={vendorReportTotalPages}
                totalItems={vendorReports.length}
                pageSize={vendorReportPageSize}
                onPageChange={setVendorReportPage}
                onPageSizeChange={setVendorReportPageSize}
                isUrdu={isUrdu}
                itemName={isUrdu ? 'زمیندار' : 'vendors'}
              />
            </div>
          )}
        </div>
      )}

      {/* 3. CUSTOMER REPORT: SUMMARY & TRANSACTIONS PER BUYER */}
      {activeReport === 'customer' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                <span>{t.reportByCustomer} ({customerReports.length} {isUrdu ? 'خریدار' : 'Buyers'})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold font-urdu-sans">
                {getDateRangeDetails().label}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Customer Selector Filter */}
              <select
                value={selectedCustomerFilter}
                onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">{isUrdu ? 'تمام گاہک (All Customers)' : 'All Customers'}</option>
                {allCustomerNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePreviewPDF}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isUrdu ? `گاہک رپورٹ پی ڈی ایف (${getDateRangeDetails().label})` : `Customer PDF (${getDateRangeDetails().label})`}</span>
              </button>
            </div>
          </div>

          {customerReports.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {t.noReportsFound}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {paginatedCustomerReports.map((c) => (
                <div key={c.customerName} className="p-3.5 sm:p-4 hover:bg-slate-50 transition space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq">
                          {c.customerName}
                        </h4>
                        {c.shopName && (
                          <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-urdu-sans">
                            {c.shopName}
                          </span>
                        )}
                        {c.phone && (
                          <span className="text-[11px] text-slate-500 font-numbers">
                            📞 {c.phone}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                        {c.totalPurchases} {isUrdu ? 'بار خریداری' : 'purchases'} • {c.totalUnitsBought} کل تعداد
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="text-start sm:text-end">
                        <span className="text-xs text-slate-500 font-urdu-sans block">کل خریداری:</span>
                        <span className="text-sm font-bold text-slate-900 font-numbers block">
                          {formatPKR(c.totalAmount, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div className="text-start sm:text-end bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 font-bold font-urdu-sans block">نقد ادا:</span>
                        <span className="text-xs font-bold text-emerald-950 font-numbers block">
                          {formatPKR(c.cashPaid, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div className="text-start sm:text-end bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-amber-900 font-bold font-urdu-sans block">{isUrdu ? 'سابقہ ادھار:' : 'Old Udhaar:'}</span>
                        <span className="text-xs font-bold text-amber-900 font-numbers block">
                          {formatPKR(c.oldUdhaar, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div className="text-start sm:text-end bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                        <span className="text-[10px] text-rose-900 font-bold font-urdu-sans block">کل ادھار (تمام وقت):</span>
                        <span className="text-xs font-bold text-rose-900 font-numbers block">
                          {formatPKR(c.allTimeCredit, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      {/* Individual Customer PDF Report Preview Button */}
                      <button
                        onClick={() => {
                          sound.playTick();
                          const preview = buildSingleCustomerReportPDF(c, settings, getDateRangeDetails().label);
                          setPdfPreview(preview);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs"
                        title="اس خریدار کا کھاتہ پی ڈی ایف دیکھیں یا ڈاؤن لوڈ کریں"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>کھاتہ پی ڈی ایف</span>
                      </button>
                    </div>
                  </div>

                  {/* Transaction Mini Table with Sub-Pagination */}
                  {(() => {
                    const txPageSize = 6;
                    const currentTxPage = customerTransactionsSubPages[c.customerName] || 1;
                    const totalTxPages = Math.ceil(c.transactions.length / txPageSize) || 1;
                    const paginatedTransactions = c.transactions.slice(
                      (currentTxPage - 1) * txPageSize,
                      currentTxPage * txPageSize
                    );

                    return (
                    <div className="space-y-1.5">
                      {totalTxPages > 1 && (
                        <div className="flex items-center justify-between text-[11px] font-urdu-sans pt-1">
                          <span className="text-slate-500 font-numbers text-[10px]">
                            خریداری تفصیل ({c.transactions.length}) • صفحہ {currentTxPage} از {totalTxPages}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={currentTxPage <= 1}
                              onClick={() =>
                                setCustomerTransactionsSubPages((prev) => ({
                                  ...prev,
                                  [c.customerName]: Math.max(1, currentTxPage - 1),
                                }))
                              }
                              className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 disabled:opacity-40 hover:bg-slate-200 text-slate-700 text-[10px]"
                            >
                              ‹ پچھلا
                            </button>
                            <button
                              type="button"
                              disabled={currentTxPage >= totalTxPages}
                              onClick={() =>
                                setCustomerTransactionsSubPages((prev) => ({
                                  ...prev,
                                  [c.customerName]: Math.min(totalTxPages, currentTxPage + 1),
                                }))
                              }
                              className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 disabled:opacity-40 hover:bg-slate-200 text-slate-700 text-[10px]"
                            >
                              اگلا ›
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-start font-urdu-sans">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                              <th className="py-1 px-2 text-start font-medium">{t.date}</th>
                              <th className="py-1 px-2 text-start font-medium">{t.product}</th>
                              <th className="py-1 px-2 text-center font-medium">{t.qty}</th>
                              <th className="py-1 px-2 text-center font-medium">{t.rate}</th>
                              <th className="py-1 px-2 text-end font-medium">{t.totalAmount}</th>
                              <th className="py-1 px-2 text-center font-medium">{t.status}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedTransactions.map((tx, idx) => (
                              <tr key={idx} className={tx.isPaymentRecord ? "bg-emerald-50/70 hover:bg-emerald-100/50" : "hover:bg-white"}>
                                <td className="py-1 px-2 font-numbers text-slate-500">{tx.date}</td>
                                <td className="py-1 px-2 font-bold text-slate-800">
                                  {tx.isPaymentRecord ? (
                                    <span className="text-emerald-800 flex items-center gap-1 font-urdu-sans font-bold">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline flex-shrink-0" />
                                      {tx.productUrdu}
                                    </span>
                                  ) : (
                                    tx.productUrdu
                                  )}
                                </td>
                                <td className="py-1 px-2 text-center font-numbers">{tx.isPaymentRecord ? '-' : tx.quantity}</td>
                                <td className="py-1 px-2 text-center font-numbers">
                                  {tx.isPaymentRecord ? '-' : formatPKR(tx.ratePerUnit, settings.currencySymbol, settings.language)}
                                </td>
                                <td className={`py-1 px-2 text-end font-bold font-numbers ${tx.isPaymentRecord ? 'text-emerald-700' : 'text-slate-900'}`}>
                                  {tx.isPaymentRecord ? `+${formatPKR(tx.totalAmount, settings.currencySymbol, settings.language)}` : formatPKR(tx.totalAmount, settings.currencySymbol, settings.language)}
                                </td>
                                <td className="py-1 px-2 text-center">
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                      tx.isPaymentRecord
                                        ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                                        : tx.paymentStatus === 'cash'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    {tx.isPaymentRecord ? (isUrdu ? 'وصول شدہ نقد' : 'Cash Paid') : tx.paymentStatus === 'cash' ? t.paymentCash : t.paymentCredit}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {customerReports.length > 0 && (
            <div className="p-3 border-t border-slate-200">
              <PaginationControls
                currentPage={custReportPage}
                totalPages={custReportTotalPages}
                totalItems={customerReports.length}
                pageSize={custReportPageSize}
                onPageChange={setCustReportPage}
                onPageSizeChange={setCustReportPageSize}
                isUrdu={isUrdu}
                itemName={isUrdu ? 'خریدار' : 'customers'}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. PRODUCT REPORT: COMMODITY ANALYSIS */}
      {activeReport === 'product' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                <span>{t.reportByProduct} ({productReports.length} {isUrdu ? 'اجناس' : 'Products'})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold font-urdu-sans">
                {getDateRangeDetails().label}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Product Selector Filter */}
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">{isUrdu ? 'تمام اجناس (All Products)' : 'All Products'}</option>
                {allProducts.map((p) => (
                  <option key={p.en} value={p.en}>
                    {p.emoji} {p.urdu} ({p.en})
                  </option>
                ))}
              </select>

              <button
                onClick={handlePreviewPDF}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isUrdu ? `جنس رپورٹ پی ڈی ایف (${getDateRangeDetails().label})` : `Product PDF (${getDateRangeDetails().label})`}</span>
              </button>
            </div>
          </div>

          {productReports.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {t.noReportsFound}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 sm:p-4">
                {paginatedProductReports.map((p) => (
                  <div
                    key={p.productName}
                    className="bg-slate-50 hover:bg-slate-100/80 p-4 rounded-2xl border border-slate-200 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{p.emoji}</span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 font-urdu-sans">
                            {p.productUrdu}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-urdu-sans">
                            {p.totalLots} {t.totalLotsCount} • {p.totalSold} فروخت شدہ
                          </span>
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="text-xs text-slate-500 font-urdu-sans block">{t.grossTotal}:</span>
                        <span className="text-sm sm:text-base font-black text-slate-900 font-numbers block">
                          {formatPKR(p.grossTurnover, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                    </div>

                    {/* Rate statistics */}
                    <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-urdu-sans block">{t.avgRate}</span>
                        <span className="text-xs font-bold text-slate-800 font-numbers">
                          {formatPKR(p.avgRate, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-urdu-sans block">{t.minRate}</span>
                        <span className="text-xs font-bold text-blue-700 font-numbers">
                          {formatPKR(p.minRate, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-urdu-sans block">{t.maxRate}</span>
                        <span className="text-xs font-bold text-emerald-700 font-numbers">
                          {formatPKR(p.maxRate, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-slate-500 font-urdu-sans">کمیشن منافع: </span>
                        <span className="font-bold text-emerald-800 font-numbers">
                          {formatPKR(p.commissionEarned, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          sound.playTick();
                          const preview = buildSingleProductReportPDF(p, settings, getDateRangeDetails().label);
                          setPdfPreview(preview);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs"
                        title="اس جنس کی مکمل رپورٹ پی ڈی ایف دیکھیں یا ڈاؤن لوڈ کریں"
                      >
                        <Eye className="w-3 h-3" />
                        <span>پی ڈی ایف رپورٹ</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {productReports.length > 0 && (
                <div className="p-3 border-t border-slate-200">
                  <PaginationControls
                    currentPage={prodReportPage}
                    totalPages={prodReportTotalPages}
                    totalItems={productReports.length}
                    pageSize={prodReportPageSize}
                    onPageChange={setProdReportPage}
                    onPageSizeChange={setProdReportPageSize}
                    isUrdu={isUrdu}
                    itemName={isUrdu ? 'اجناس' : 'products'}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. SHOP EXPENSES REPORT (دکان کے روزنامچہ و عمومی اخراجات) */}
      {activeReport === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
          {/* Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq flex items-center gap-2">
                <Wallet className="w-4 h-4 text-rose-600" />
                <span>{isUrdu ? 'دکان کے روزنامچہ و عمومی اخراجات' : 'Shop Operational Expenses Report'}</span>
              </h3>
              <p className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                {isUrdu ? `${getDateRangeDetails().label} • کل ریکارڈز: ${searchedExpenses.length}` : `${getDateRangeDetails().label} • Total: ${searchedExpenses.length} records`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePreviewPDF();
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isUrdu ? `اخراجات پی ڈی ایف (${getDateRangeDetails().label})` : `Expenses PDF (${getDateRangeDetails().label})`}</span>
              </button>
            </div>
          </div>

          {/* Mini Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4">
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
              <span className="text-[11px] text-rose-800 font-bold font-urdu-sans block">
                {isUrdu ? 'کل دکان اخراجات' : 'Total Expenses'}
              </span>
              <span className="text-base font-black text-rose-950 font-numbers block mt-0.5">
                {formatPKR(expenseReportStats.total, settings.currencySymbol, settings.language)}
              </span>
              <span className="text-[10px] text-rose-700 font-urdu-sans">
                {searchedExpenses.length} {isUrdu ? 'اندراجات' : 'records'}
              </span>
            </div>

            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="text-[11px] text-emerald-800 font-bold font-urdu-sans block">
                {isUrdu ? 'نقد ادائیگی' : 'Cash Paid'}
              </span>
              <span className="text-base font-black text-emerald-950 font-numbers block mt-0.5">
                {formatPKR(expenseReportStats.cash, settings.currencySymbol, settings.language)}
              </span>
              <span className="text-[10px] text-emerald-700 font-urdu-sans">
                {isUrdu ? 'کیش ادا شدہ' : 'Paid in cash'}
              </span>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
              <span className="text-[11px] text-blue-800 font-bold font-urdu-sans block">
                {isUrdu ? 'آن لائن / بینک' : 'Online / Bank'}
              </span>
              <span className="text-base font-black text-blue-950 font-numbers block mt-0.5">
                {formatPKR(expenseReportStats.online, settings.currencySymbol, settings.language)}
              </span>
              <span className="text-[10px] text-blue-700 font-urdu-sans">
                {isUrdu ? 'بینک ٹرانسفر' : 'Bank transfer'}
              </span>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
              <span className="text-[11px] text-amber-800 font-bold font-urdu-sans block">
                {isUrdu ? 'چیک ادائیگی' : 'Cheque Paid'}
              </span>
              <span className="text-base font-black text-amber-950 font-numbers block mt-0.5">
                {formatPKR(expenseReportStats.cheque, settings.currencySymbol, settings.language)}
              </span>
              <span className="text-[10px] text-amber-700 font-urdu-sans">
                {isUrdu ? 'بینک چیک' : 'Cheque issue'}
              </span>
            </div>
          </div>

          {/* Filter Chips for Category & Payment Method */}
          <div className="px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
            {/* Category selection */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              <span className="text-xs text-slate-500 font-bold font-urdu-sans flex-shrink-0">
                {isUrdu ? 'کیٹیگری:' : 'Category:'}
              </span>
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setSelectedExpenseCategoryFilter('all');
                  setExpenseReportPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex-shrink-0 ${
                  selectedExpenseCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isUrdu ? 'تمام کیٹیگریز' : 'All Categories'}
              </button>
              {(Object.keys(expenseCategoryLabels) as ExpenseCategory[])
                .filter((c) => c !== 'tea')
                .map((catKey) => {
                const label = expenseCategoryLabels[catKey];
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => {
                      sound.playTick();
                      setSelectedExpenseCategoryFilter(catKey);
                      setExpenseReportPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex-shrink-0 ${
                      selectedExpenseCategoryFilter === catKey
                        ? 'bg-rose-600 text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label.icon} {isUrdu ? label.ur : label.en}
                  </button>
                );
              })}
            </div>

            {/* Payment method selector */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-slate-500 font-bold font-urdu-sans">
                {isUrdu ? 'طریقہ:' : 'Method:'}
              </span>
              <select
                value={selectedExpensePaymentMethodFilter}
                onChange={(e) => {
                  setSelectedExpensePaymentMethodFilter(e.target.value);
                  setExpenseReportPage(1);
                }}
                className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-urdu-sans"
              >
                <option value="all">{isUrdu ? 'تمام طریقے' : 'All Methods'}</option>
                <option value="cash">{isUrdu ? 'نقد (کیش)' : 'Cash'}</option>
                <option value="online">{isUrdu ? 'آن لائن / بینک' : 'Online / Bank'}</option>
                <option value="cheque">{isUrdu ? 'چیک' : 'Cheque'}</option>
              </select>
            </div>
          </div>

          {/* Expenses Table */}
          {searchedExpenses.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {isUrdu ? 'منتخب فلٹر کے مطابق کوئی دکان خرچہ نہیں ملا۔' : 'No shop expenses found for this filter.'}
            </div>
          ) : (
            <div className="space-y-3 px-4 pb-4">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 font-bold font-urdu-sans border-b border-slate-200">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3 text-center">{isUrdu ? 'تاریخ' : 'Date'}</th>
                      <th className="py-2.5 px-3">{isUrdu ? 'مد / کیٹیگری' : 'Category'}</th>
                      <th className="py-2.5 px-3">{isUrdu ? 'تفصیل / عنوان' : 'Title / Details'}</th>
                      <th className="py-2.5 px-3">{isUrdu ? 'بنام / وصول کنندہ' : 'Paid To'}</th>
                      <th className="py-2.5 px-3 text-center">{isUrdu ? 'طریقہ' : 'Method'}</th>
                      <th className="py-2.5 px-3 text-left font-numbers">{isUrdu ? 'رقم' : 'Amount'}</th>
                      {onDeleteExpense && (
                        <th className="py-2.5 px-3 text-center w-12 no-print">{isUrdu ? 'حذف' : 'Action'}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-urdu-sans">
                    {paginatedExpenses.map((exp, idx) => {
                      const rowNumber = (expenseReportPage - 1) * expenseReportPageSize + idx + 1;
                      const catInfo = expenseCategoryLabels[exp.category] || {
                        ur: exp.category,
                        en: exp.category,
                        icon: '📦',
                      };
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-numbers">{rowNumber}</td>
                          <td className="py-2.5 px-3 text-center text-slate-600 font-numbers">{exp.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                              <span>{catInfo.icon}</span>
                              <span>{isUrdu ? catInfo.ur : catInfo.en}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{exp.title}</div>
                            {exp.notes && (
                              <div className="text-[11px] text-slate-500 font-normal">{exp.notes}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{exp.paidTo || '-'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                exp.paymentMethod === 'cash'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : exp.paymentMethod === 'online'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {exp.paymentMethod === 'cash'
                                ? isUrdu ? 'نقد' : 'Cash'
                                : exp.paymentMethod === 'online'
                                ? isUrdu ? 'آن لائن' : 'Online'
                                : isUrdu ? 'چیک' : 'Cheque'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-left font-black text-rose-700 font-numbers text-sm">
                            {formatPKR(exp.amount, settings.currencySymbol, settings.language)}
                          </td>
                          {onDeleteExpense && (
                            <td className="py-2.5 px-3 text-center no-print">
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(isUrdu ? 'کیا آپ واقعی اس خرچے کو حذف کرنا چاہتے ہیں؟' : 'Delete this expense?')) {
                                    sound.playTick();
                                    onDeleteExpense(exp.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                title={isUrdu ? 'حذف کریں' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {searchedExpenses.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <PaginationControls
                    currentPage={expenseReportPage}
                    totalPages={expenseReportTotalPages}
                    totalItems={searchedExpenses.length}
                    pageSize={expenseReportPageSize}
                    onPageChange={setExpenseReportPage}
                    onPageSizeChange={setExpenseReportPageSize}
                    isUrdu={isUrdu}
                    itemName={isUrdu ? 'اخراجات' : 'expenses'}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONSOLIDATED ALL-PRODUCTS BILL MODAL (تمام اجناس کا مشترکہ بل) */}
      {consolidatedBillVendor && (
        <VendorConsolidatedBillModal
          isOpen={!!consolidatedBillVendor}
          vendorName={consolidatedBillVendor.vendorName}
          vendorPhone={consolidatedBillVendor.vendorPhone}
          vendorCity={consolidatedBillVendor.vendorCity}
          lots={consolidatedBillVendor.lots}
          dateLabel={consolidatedBillVendor.dateLabel}
          settings={settings}
          onClose={() => setConsolidatedBillVendor(null)}
        />
      )}

      {/* ALL VENDOR BILLS BATCH MODAL (تمام زمینداروں کے پکے بل - بل بک مشترکہ پرنٹ) */}
      {isAllVendorBillsOpen && (
        <AllVendorBillsModal
          isOpen={isAllVendorBillsOpen}
          onClose={() => setIsAllVendorBillsOpen(false)}
          lots={filteredLotsByDate.length > 0 ? filteredLotsByDate : lots}
          settings={settings}
          dateLabel={getDateRangeDetails().label}
        />
      )}

      {/* PDF REPORT INTERACTIVE PREVIEW MODAL (دیکھیں یا ڈاؤن لوڈ کریں) */}
      {pdfPreview && (
        <ReportPDFPreviewModal
          previewData={pdfPreview}
          onClose={() => setPdfPreview(null)}
          isUrdu={isUrdu}
        />
      )}

      {/* CASH IN DRAWER MODAL */}
      <CashDrawerModal
        isOpen={isCashDrawerModalOpen}
        onClose={() => setIsCashDrawerModalOpen(false)}
        lots={lots}
        customers={customers}
        expenses={expenses}
        drawerAdjustments={drawerAdjustments}
        onAddAdjustment={(adj) => {
          if (onAddDrawerAdjustment) onAddDrawerAdjustment(adj);
        }}
        onDeleteAdjustment={(id) => {
          if (onDeleteDrawerAdjustment) onDeleteDrawerAdjustment(id);
        }}
        settings={settings}
      />
    </div>
  );
};
