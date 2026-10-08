import React, { useState, useMemo, useEffect } from 'react';
import {
  VendorLot,
  AppSettings,
  CustomerBuyer,
  BuyerPaymentRecord,
  BuyerCreditRecord,
  SavedVendor,
  VendorPaymentRecord,
  VendorPaymentStatus,
} from '../types';
import { translations, unitLabels, getUnitDisplayLabel } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import { getLotReceiptNumber } from '../utils/calculations';
import { sound } from '../utils/sound';
import { printConsolidatedThermalPOSReceipt } from '../utils/receiptGenerator';
import { PaginationControls } from './PaginationControls';
import { PinPromptModal } from './PinPromptModal';
import {
  Users,
  Search,
  CheckCircle,
  Clock,
  Banknote,
  CreditCard,
  Phone,
  Filter,
  Plus,
  Share2,
  PhoneCall,
  MessageCircle,
  Edit2,
  Trash2,
  Receipt,
  UserPlus,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Building2,
  Package,
  Layers,
  Sparkles,
  Printer,
  Calendar,
  AlertCircle,
  FileText,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';

interface BuyersKhataViewProps {
  lots: VendorLot[];
  customers: CustomerBuyer[];
  vendors?: SavedVendor[];
  onSaveCustomer: (customer: CustomerBuyer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onRecordCustomerPayment: (customerId: string, payment: BuyerPaymentRecord) => void;
  onDeleteCustomerPayment?: (customerIdOrName: string, paymentId: string) => void;
  onRecordCustomerCredit?: (customerId: string, credit: BuyerCreditRecord) => void;
  onDeleteCustomerCredit?: (customerIdOrName: string, creditId: string) => void;
  onToggleSalePaymentStatus: (lotId: string, saleId: string) => void;
  onSaveVendor?: (vendor: SavedVendor) => void;
  onDeleteVendor?: (vendorId: string) => void;
  onRecordVendorPayment?: (
    vendorName: string,
    payment: {
      lotId?: string;
      amount: number;
      notes?: string;
      paymentDate?: string;
      paymentMethod?: 'cash' | 'online' | 'cheque';
      status?: VendorPaymentStatus;
    }
  ) => void;
  onDeleteVendorPayment?: (vendorName: string, paymentId: string, lotId?: string, amount?: number) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onOpenReceipt?: (lotId: string) => void;
  onOpenExpenseSlip?: (lotId: string) => void;
  onDeleteSale?: (lotId: string, saleId: string) => void;
  onDeleteLot?: (lotId: string) => void;
  settings: AppSettings;
}

export const BuyersKhataView: React.FC<BuyersKhataViewProps> = ({
  lots,
  customers,
  vendors = [],
  onSaveCustomer,
  onDeleteCustomer,
  onRecordCustomerPayment,
  onDeleteCustomerPayment,
  onRecordCustomerCredit,
  onDeleteCustomerCredit,
  onToggleSalePaymentStatus,
  onSaveVendor,
  onDeleteVendor,
  onRecordVendorPayment,
  onDeleteVendorPayment,
  onToggleVendorPaymentStatus,
  onOpenReceipt,
  onOpenExpenseSlip,
  onDeleteSale,
  onDeleteLot,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  // Primary Tab: Customer Khata vs. Vendor Khata & Payments
  const [activeKhataSection, setActiveKhataSection] = useState<'customers' | 'vendors'>('customers');

  // Unified PIN Security Delete Action State
  const [pendingDeleteAction, setPendingDeleteAction] = useState<{
    type: 'buyer_sale' | 'customer_payment' | 'customer_credit' | 'vendor_payment' | 'vendor_lot';
    title: string;
    description: string;
    execute: () => void;
  } | null>(null);

  // Customer Section States
  const [viewMode, setViewMode] = useState<'khatas' | 'transactions'>('khatas');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'credit' | 'cleared'>('all');
  const [selectedCustomerIdForPayment, setSelectedCustomerIdForPayment] = useState<string | null>(null);
  const [selectedCustomerIdForCredit, setSelectedCustomerIdForCredit] = useState<string | null>(null);
  const [expandedCustomerKhatas, setExpandedCustomerKhatas] = useState<Record<string, boolean>>({});

  // Performance / Lazy chunk rendering limits
  const [visibleCustomersCount, setVisibleCustomersCount] = useState<number>(30);
  const [visibleVendorsCount, setVisibleVendorsCount] = useState<number>(30);
  const [visibleTransactionsCount, setVisibleTransactionsCount] = useState<number>(40);
  const [transactionsDateFilter, setTransactionsDateFilter] = useState<'thismonth' | 'today' | 'last7days' | 'all'>('today');

  // Add/Edit Customer Modal State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerBuyer | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custShop, setCustShop] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custOpeningBalance, setCustOpeningBalance] = useState<number>(0);
  const [custNotes, setCustNotes] = useState('');
  const [custError, setCustError] = useState<string | null>(null);

  // Customer Payment Recording State
  const [custPaymentAmount, setCustPaymentAmount] = useState<number>(0);
  const [custPaymentNote, setCustPaymentNote] = useState('');

  // Customer Manual Credit Recording State
  const [custCreditAmount, setCustCreditAmount] = useState<number>(0);
  const [custCreditNote, setCustCreditNote] = useState('');
  const [custCreditDate, setCustCreditDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Vendor Section States
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [vendorFilterStatus, setVendorFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [selectedVendorForPayment, setSelectedVendorForPayment] = useState<string | null>(null);
  const [expandedVendorKhatas, setExpandedVendorKhatas] = useState<Record<string, boolean>>({});

  // Vendor Payment Recording State
  const [vendorPaymentAmount, setVendorPaymentAmount] = useState<number>(0);
  const [vendorPaymentNote, setVendorPaymentNote] = useState('');
  const [vendorPaymentMethod, setVendorPaymentMethod] = useState<'cash' | 'online' | 'cheque'>('cash');
  const [vendorPaymentDate, setVendorPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [vendorPaymentLotTarget, setVendorPaymentLotTarget] = useState<string>('all');

  // Sub-pagination states for expanded Customer Details and Vendor Details
  const [customerSalesSubPages, setCustomerSalesSubPages] = useState<Record<string, number>>({});
  const [customerPaymentsSubPages, setCustomerPaymentsSubPages] = useState<Record<string, number>>({});
  const [customerCreditsSubPages, setCustomerCreditsSubPages] = useState<Record<string, number>>({});
  const [vendorLotsSubPages, setVendorLotsSubPages] = useState<Record<string, number>>({});
  const [vendorPaymentsSubPages, setVendorPaymentsSubPages] = useState<Record<string, number>>({});

  // Add/Edit Vendor Modal State
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<SavedVendor | null>(null);
  const [vName, setVName] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vCity, setVCity] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vError, setVError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // 1. CUSTOMER KHATA AGGREGATION (HIGH PERFORMANCE MEMOIZED)
  // -------------------------------------------------------------
  const allSales = useMemo(() => {
    return lots.flatMap((lot) =>
      lot.sales.map((sale) => ({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        vendorName: lot.vendorName,
        productUrdu: lot.productUrdu,
        unitLabel: getUnitDisplayLabel(lot.unitType, settings.language),
        saleId: sale.id,
        buyerName: sale.buyerName,
        buyerPhone: sale.buyerPhone,
        quantity: sale.quantity,
        ratePerUnit: sale.ratePerUnit,
        totalAmount: sale.totalAmount,
        paymentStatus: sale.paymentStatus,
        paidAmount: sale.paidAmount,
        timestamp: sale.timestamp,
        date: lot.arrivalDate,
      }))
    );
  }, [lots, settings.language]);

  const customerList = useMemo(() => {
    const customerMap = new Map<
      string,
      {
        id: string;
        name: string;
        phone?: string;
        shopName?: string;
        address?: string;
        openingBalance: number;
        totalPurchases: number;
        grossPurchasesAmount: number;
        cashPaidDirect: number;
        creditBidsAmount: number;
        khataPaymentsReceived: number;
        balance: number;
        sales: typeof allSales;
        paymentHistory: BuyerPaymentRecord[];
        manualCreditHistory: BuyerCreditRecord[];
      }
    >();

    customers.forEach((c) => {
      const manualCreditsTotal = c.manualCredits?.reduce((sum, cr) => sum + cr.amount, 0) || 0;
      const paymentsTotal = c.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      customerMap.set(c.name, {
        id: c.id,
        name: c.name,
        phone: c.phone,
        shopName: c.shopName,
        address: c.address,
        openingBalance: c.openingBalance || 0,
        totalPurchases: 0,
        grossPurchasesAmount: (c.openingBalance || 0) + manualCreditsTotal,
        cashPaidDirect: 0,
        creditBidsAmount: (c.openingBalance || 0) + manualCreditsTotal,
        khataPaymentsReceived: paymentsTotal,
        balance: ((c.openingBalance || 0) + manualCreditsTotal) - paymentsTotal,
        sales: [],
        paymentHistory: c.payments || [],
        manualCreditHistory: c.manualCredits || [],
      });
    });

    allSales.forEach((sale) => {
      let entry = customerMap.get(sale.buyerName);
      if (!entry) {
        entry = {
          id: `cust-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: sale.buyerName,
          phone: sale.buyerPhone,
          openingBalance: 0,
          totalPurchases: 0,
          grossPurchasesAmount: 0,
          cashPaidDirect: 0,
          creditBidsAmount: 0,
          khataPaymentsReceived: 0,
          balance: 0,
          sales: [],
          paymentHistory: [],
          manualCreditHistory: [],
        };
        customerMap.set(sale.buyerName, entry);
      }

      entry.totalPurchases += 1;
      entry.grossPurchasesAmount += sale.totalAmount;
      if (sale.paymentStatus === 'cash') {
        entry.cashPaidDirect += sale.totalAmount;
      } else {
        entry.creditBidsAmount += sale.totalAmount;
      }
      if (!entry.phone && sale.buyerPhone) {
        entry.phone = sale.buyerPhone;
      }
      entry.sales.push(sale);
    });

    return Array.from(customerMap.values()).map((c) => {
      const totalDue = c.creditBidsAmount;
      const netOutstanding = Math.max(0, totalDue - c.khataPaymentsReceived);
      return {
        ...c,
        balance: netOutstanding,
      };
    });
  }, [allSales, customers]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return customerList.filter((c) => {
      const matchesSearch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term)) ||
        (c.shopName && c.shopName.toLowerCase().includes(term));

      if (!matchesSearch) return false;
      if (filterStatus === 'credit') return c.balance > 0;
      if (filterStatus === 'cleared') return c.balance === 0;
      return true;
    });
  }, [customerList, searchTerm, filterStatus]);

  const totalOverallCredit = useMemo(
    () => customerList.reduce((sum, c) => sum + c.balance, 0),
    [customerList]
  );
  const totalCashCollected = useMemo(
    () => customerList.reduce((sum, c) => sum + c.cashPaidDirect + c.khataPaymentsReceived, 0),
    [customerList]
  );

  // Customer pagination
  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize, setCustomerPageSize] = useState(20);
  useEffect(() => {
    setCustomerPage(1);
  }, [searchTerm, filterStatus]);

  const customerTotalPages = Math.ceil(filteredCustomers.length / customerPageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (customerPage - 1) * customerPageSize;
    return filteredCustomers.slice(start, start + customerPageSize);
  }, [filteredCustomers, customerPage, customerPageSize]);

  // Filtered sales for transactions view
  const filteredSalesForTransactions = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthPrefix = todayStr.slice(0, 7);
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const last7DaysStr = d.toISOString().slice(0, 10);

    const term = searchTerm.trim().toLowerCase();

    return allSales.filter((sale) => {
      const saleDate = sale.date || sale.timestamp?.slice(0, 10) || todayStr;
      if (transactionsDateFilter === 'today' && saleDate !== todayStr) return false;
      if (transactionsDateFilter === 'thismonth' && !saleDate.startsWith(thisMonthPrefix)) return false;
      if (transactionsDateFilter === 'last7days' && saleDate < last7DaysStr) return false;

      if (!term) return true;
      return (
        sale.buyerName.toLowerCase().includes(term) ||
        sale.vendorName.toLowerCase().includes(term) ||
        sale.productUrdu.includes(term) ||
        sale.lotNumber.toLowerCase().includes(term)
      );
    });
  }, [allSales, transactionsDateFilter, searchTerm]);

  // Transactions pagination
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(30);
  useEffect(() => {
    setTxPage(1);
  }, [transactionsDateFilter, searchTerm]);

  const txTotalPages = Math.ceil(filteredSalesForTransactions.length / txPageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (txPage - 1) * txPageSize;
    return filteredSalesForTransactions.slice(start, start + txPageSize);
  }, [filteredSalesForTransactions, txPage, txPageSize]);

  // -------------------------------------------------------------
  // 2. VENDOR KHATA & PAYMENTS AGGREGATION (HIGH PERFORMANCE MEMOIZED)
  // -------------------------------------------------------------
  const vendorList = useMemo(() => {
    const vendorMap = new Map<
      string,
      {
        id: string;
        name: string;
        phone?: string;
        city?: string;
        notes?: string;
        totalLots: number;
        grossSales: number;
        totalExpenses: number;
        netPayable: number;
        totalPaid: number;
        remainingDue: number;
        isAllPaid: boolean;
        isPartial: boolean;
        lots: VendorLot[];
        payments: VendorPaymentRecord[];
      }
    >();

    // Pre-seed saved vendors
    vendors.forEach((v) => {
      vendorMap.set(v.name, {
        id: v.id,
        name: v.name,
        phone: v.phone,
        city: v.city,
        notes: v.notes,
        totalLots: 0,
        grossSales: 0,
        totalExpenses: 0,
        netPayable: v.openingBalance || 0,
        totalPaid: 0,
        remainingDue: v.openingBalance || 0,
        isAllPaid: false,
        isPartial: false,
        lots: [],
        payments: v.payments || [],
      });
    });

    // Aggregate lots
    lots.forEach((lot) => {
      let entry = vendorMap.get(lot.vendorName);
      if (!entry) {
        entry = {
          id: `vend-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: lot.vendorName,
          phone: lot.vendorPhone,
          city: lot.vendorCity,
          notes: '',
          totalLots: 0,
          grossSales: 0,
          totalExpenses: 0,
          netPayable: 0,
          totalPaid: 0,
          remainingDue: 0,
          isAllPaid: false,
          isPartial: false,
          lots: [],
          payments: [],
        };
        vendorMap.set(lot.vendorName, entry);
      }

      entry.totalLots += 1;
      entry.grossSales += lot.summary.grossSales;
      entry.totalExpenses += lot.summary.totalExpenses;
      entry.netPayable += lot.summary.netPayableToVendor;

      if (!entry.phone && lot.vendorPhone) entry.phone = lot.vendorPhone;
      if (!entry.city && lot.vendorCity) entry.city = lot.vendorCity;
      entry.lots.push(lot);
    });

    return Array.from(vendorMap.values()).map((v) => {
      // Build unified payment history for this vendor
      const historyMap = new Map<string, VendorPaymentRecord>();
      const seenSignatures = new Set<string>();

      // 1. From saved vendor payments (deduplicate identical duplicate records)
      (v.payments || []).forEach((p) => {
        const timeKey = p.timestamp ? p.timestamp.slice(0, 16) : (p.date || p.paymentDate || '');
        const signature = `${p.amount}_${p.paymentDate || p.date || ''}_${timeKey}_${p.lotId || 'all'}`;
        if (!seenSignatures.has(signature) && !historyMap.has(p.id)) {
          seenSignatures.add(signature);
          historyMap.set(p.id, { ...p });
        }
      });

      // Track explicitly linked lots from saved payments
      const linkedLotIds = new Set<string>();
      historyMap.forEach((p) => {
        if (p.lotId) linkedLotIds.add(p.lotId);
      });

      // Pool of unassigned/general vendor payments (payments made from Khata to vendor without specific lotId)
      let unassignedSavedPool = Array.from(historyMap.values())
        .filter((p) => !p.lotId)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      // 2. From lot-specific payments:
      // Only synthesize a lot-pay record if this lot's payment is NOT already covered by v.payments!
      v.lots.forEach((lot) => {
        const lotPaid =
          lot.vendorPaymentAmount !== undefined
            ? lot.vendorPaymentAmount
            : lot.vendorPaymentStatus === 'paid'
            ? lot.summary.netPayableToVendor
            : 0;

        if (lotPaid > 0) {
          // If this lot was already explicitly linked in a saved payment, skip
          if (linkedLotIds.has(lot.id)) {
            return;
          }

          // If covered by general/unassigned vendor payments (like payments made from Khata):
          if (unassignedSavedPool >= lotPaid) {
            unassignedSavedPool -= lotPaid;
            // The payment for this lot is ALREADY recorded in v.payments! Do NOT add duplicate!
            return;
          } else if (unassignedSavedPool > 0) {
            const excess = lotPaid - unassignedSavedPool;
            unassignedSavedPool = 0;
            if (excess > 0) {
              const lotPayKey = `lot-pay-${lot.id}`;
              historyMap.set(lotPayKey, {
                id: lotPayKey,
                vendorName: lot.vendorName,
                lotId: lot.id,
                lotNumber: lot.lotNumber,
                amount: excess,
                date: lot.vendorPaymentDate || lot.updatedAt?.slice(0, 10) || lot.arrivalDate,
                paymentDate: lot.vendorPaymentDate || lot.updatedAt?.slice(0, 10) || lot.arrivalDate,
                paymentMethod: lot.vendorPaymentMethod || 'cash',
                notes: lot.vendorPaymentNotes || `لاٹ #${lot.lotNumber} (${lot.productUrdu}) کی ادائیگی`,
              });
            }
            return;
          }

          // Lot was paid independently (e.g. marked paid in Bolli room directly without a payment record)
          const lotPayKey = `lot-pay-${lot.id}`;
          historyMap.set(lotPayKey, {
            id: lotPayKey,
            vendorName: lot.vendorName,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            amount: lotPaid,
            date: lot.vendorPaymentDate || lot.updatedAt?.slice(0, 10) || lot.arrivalDate,
            paymentDate: lot.vendorPaymentDate || lot.updatedAt?.slice(0, 10) || lot.arrivalDate,
            paymentMethod: lot.vendorPaymentMethod || 'cash',
            notes: lot.vendorPaymentNotes || `لاٹ #${lot.lotNumber} (${lot.productUrdu}) کی ادائیگی`,
          });
        }
      });

      const paymentHistory = Array.from(historyMap.values()).sort((a, b) => {
        const dateA = a.date || a.paymentDate || '';
        const dateB = b.date || b.paymentDate || '';
        return dateB.localeCompare(dateA);
      });

      // Total paid is accurately computed from all unique, non-overlapping payments
      const totalPaid = paymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0);
      const remaining = Math.max(0, v.netPayable - totalPaid);
      const isAllPaid = remaining === 0 && v.netPayable > 0;
      const isPartial = totalPaid > 0 && remaining > 0;

      return {
        ...v,
        totalPaid,
        remainingDue: remaining,
        isAllPaid,
        isPartial,
        paymentHistory,
      };
    });
  }, [lots, vendors]);

  const filteredVendors = useMemo(() => {
    const term = vendorSearchTerm.trim().toLowerCase();
    return vendorList.filter((v) => {
      const matchesSearch =
        !term ||
        v.name.toLowerCase().includes(term) ||
        (v.phone && v.phone.includes(term)) ||
        (v.city && v.city.toLowerCase().includes(term));

      if (!matchesSearch) return false;
      if (vendorFilterStatus === 'pending') return v.remainingDue > 0;
      if (vendorFilterStatus === 'paid') return v.isAllPaid;
      return true;
    });
  }, [vendorList, vendorSearchTerm, vendorFilterStatus]);

  const totalPayableToVendors = useMemo(
    () => vendorList.reduce((sum, v) => sum + v.netPayable, 0),
    [vendorList]
  );
  const totalPaidToVendors = useMemo(
    () => vendorList.reduce((sum, v) => sum + v.totalPaid, 0),
    [vendorList]
  );
  const totalRemainingPayable = Math.max(0, totalPayableToVendors - totalPaidToVendors);

  // Vendor pagination
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPageSize, setVendorPageSize] = useState(20);
  useEffect(() => {
    setVendorPage(1);
  }, [vendorSearchTerm, vendorFilterStatus]);

  const vendorTotalPages = Math.ceil(filteredVendors.length / vendorPageSize) || 1;
  const paginatedVendors = useMemo(() => {
    const start = (vendorPage - 1) * vendorPageSize;
    return filteredVendors.slice(start, start + vendorPageSize);
  }, [filteredVendors, vendorPage, vendorPageSize]);

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const toggleCustomerAccordion = (name: string) => {
    setExpandedCustomerKhatas((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const toggleVendorAccordion = (name: string) => {
    setExpandedVendorKhatas((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleOpenAddCustomer = () => {
    sound.playTick();
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustShop('');
    setCustAddress('');
    setCustOpeningBalance(0);
    setCustNotes('');
    setCustError(null);
    setIsCustomerModalOpen(true);
  };

  const handleOpenEditCustomer = (cust: CustomerBuyer | typeof customerList[0]) => {
    sound.playTick();
    const payments = 'paymentHistory' in cust ? cust.paymentHistory : cust.payments;
    setEditingCustomer({
      id: cust.id,
      name: cust.name,
      phone: cust.phone,
      shopName: cust.shopName,
      address: cust.address,
      openingBalance: cust.balance,
      balance: cust.balance,
      notes: '',
      payments: payments || [],
    });
    setCustName(cust.name);
    setCustPhone(cust.phone || '');
    setCustShop(cust.shopName || '');
    setCustAddress(cust.address || '');
    setCustOpeningBalance(cust.balance || 0);
    setCustNotes('');
    setCustError(null);
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = custName.trim();
    if (!trimmedName) {
      setCustError(isUrdu ? 'براہ کرم خریدار کا نام درج کریں' : 'Please enter customer name');
      return;
    }

    const nameLower = trimmedName.toLowerCase();
    const nameExists =
      customers.some(
        (c) =>
          c.name.trim().toLowerCase() === nameLower &&
          (!editingCustomer || c.id !== editingCustomer.id)
      ) ||
      customerList.some(
        (c) =>
          c.name.trim().toLowerCase() === nameLower &&
          (!editingCustomer || c.id !== editingCustomer.id)
      );

    if (nameExists) {
      setCustError(
        isUrdu
          ? 'اس نام سے گاہک پہلے سے موجود ہے (customer with name is already exists)'
          : 'customer with name is already exists'
      );
      return;
    }

    const newCust: CustomerBuyer = {
      id: editingCustomer?.id || `cust-${Date.now()}`,
      name: trimmedName,
      phone: custPhone.trim() || undefined,
      shopName: custShop.trim() || undefined,
      address: custAddress.trim() || undefined,
      openingBalance: custOpeningBalance,
      balance: editingCustomer ? editingCustomer.balance : custOpeningBalance,
      notes: custNotes.trim() || undefined,
      payments: editingCustomer?.payments || [],
      createdAt: editingCustomer?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sound.playBidSound();
    onSaveCustomer(newCust);
    setIsCustomerModalOpen(false);
  };

  const handleRecordCustomerPaymentSubmit = (customer: typeof customerList[0]) => {
    if (custPaymentAmount <= 0) return;

    sound.playCashChime();
    const newRecord: BuyerPaymentRecord = {
      id: `pay-${Date.now()}`,
      amount: custPaymentAmount,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'cash',
      notes: custPaymentNote.trim() || undefined,
    };

    let targetCust = customers.find((c) => c.name === customer.name);
    if (!targetCust) {
      targetCust = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        shopName: customer.shopName,
        balance: customer.balance,
        payments: [newRecord],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveCustomer(targetCust);
    } else {
      onRecordCustomerPayment(targetCust.id, newRecord);
    }

    setSelectedCustomerIdForPayment(null);
    setCustPaymentAmount(0);
    setCustPaymentNote('');
  };

  const handleRecordCustomerCreditSubmit = (customer: typeof customerList[0]) => {
    if (custCreditAmount <= 0) return;

    sound.playCashChime();
    const newRecord: BuyerCreditRecord = {
      id: `crd-${Date.now()}`,
      buyerName: customer.name,
      buyerPhone: customer.phone,
      amount: custCreditAmount,
      date: custCreditDate || new Date().toISOString().slice(0, 10),
      notes: custCreditNote.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    let targetCust = customers.find((c) => c.name === customer.name);
    if (!targetCust) {
      targetCust = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        shopName: customer.shopName,
        balance: custCreditAmount,
        manualCredits: [newRecord],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveCustomer(targetCust);
    } else {
      if (onRecordCustomerCredit) {
        onRecordCustomerCredit(targetCust.id, newRecord);
      } else {
        const updatedCredits = [newRecord, ...(targetCust.manualCredits || [])];
        onSaveCustomer({
          ...targetCust,
          manualCredits: updatedCredits,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    setSelectedCustomerIdForCredit(null);
    setCustCreditAmount(0);
    setCustCreditNote('');
  };

  // Vendor Payment Submission
  const handleRecordVendorPaymentSubmit = (vendor: typeof vendorList[0]) => {
    if (vendorPaymentAmount <= 0) return;

    sound.playCashChime();
    if (onRecordVendorPayment) {
      onRecordVendorPayment(vendor.name, {
        lotId: vendorPaymentLotTarget === 'all' ? undefined : vendorPaymentLotTarget,
        amount: vendorPaymentAmount,
        notes: vendorPaymentNote.trim() || undefined,
        paymentDate: vendorPaymentDate,
        paymentMethod: vendorPaymentMethod,
      });
    }

    setSelectedVendorForPayment(null);
    setVendorPaymentAmount(0);
    setVendorPaymentNote('');
  };

  const handleQuickMarkVendorFullyPaid = (vendor: typeof vendorList[0]) => {
    if (vendor.remainingDue <= 0) return;
    sound.playCashChime();
    if (onRecordVendorPayment) {
      onRecordVendorPayment(vendor.name, {
        amount: vendor.remainingDue,
        notes: isUrdu ? 'مکمل بقایا رقم ادا کی گئی' : 'Marked fully paid in full',
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'cash',
        status: 'paid',
      });
    }
    setSelectedVendorForPayment(null);
    setVendorPaymentAmount(0);
    setVendorPaymentNote('');
  };

  const handleOpenAddVendor = () => {
    sound.playTick();
    setEditingVendor(null);
    setVName('');
    setVPhone('');
    setVCity('');
    setVNotes('');
    setVError(null);
    setIsVendorModalOpen(true);
  };

  const handleSaveVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) {
      setVError(isUrdu ? 'براہ کرم زمیندار کا نام درج کریں' : 'Please enter vendor name');
      return;
    }

    if (onSaveVendor) {
      const savedV: SavedVendor = {
        id: editingVendor?.id || `vend-${Date.now()}`,
        name: vName.trim(),
        phone: vPhone.trim() || undefined,
        city: vCity.trim() || undefined,
        notes: vNotes.trim() || undefined,
        createdAt: editingVendor?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveVendor(savedV);
    }
    sound.playBidSound();
    setIsVendorModalOpen(false);
  };

  // WhatsApp Statements
  const handleSendCustomerWhatsAppReminder = (c: typeof customerList[0]) => {
    sound.playCashChime();
    let text = `*محترم ${c.name} صاحب!* السلام علیکم\n\n`;
    text += `*${settings.shopNameUrdu || settings.shopNameEn}* کی طرف سے آپ کا موجودہ کھاتہ گوشوارہ:\n`;
    text += `---------------------------------\n`;
    text += `💰 *بقایا واجب الادا رقم:* ${formatPKR(c.balance, settings.currencySymbol, settings.language)}\n`;
    text += `📦 *کل خریداریاں:* ${c.totalPurchases} مرتبہ\n`;
    text += `---------------------------------\n`;
    text += `براہ کرم بقایا رقم کی جلد از جلد ادائیگی فرما کر رسید حاصل کریں۔ شکریہ!\n\n`;
    text += `👤 *آڑھتی:* ${settings.arhtiNameUrdu || settings.arhtiNameEn}\n`;
    text += `📞 *رابطہ:* ${settings.shopPhone}`;

    const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone ? (cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone) : '';
    const waUrl = phoneParam ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleSendVendorWhatsAppStatement = (v: typeof vendorList[0]) => {
    sound.playCashChime();
    let text = `*محترم زمیندار / مال مالک: ${v.name} صاحب!* السلام علیکم\n\n`;
    text += `*${settings.shopNameUrdu || settings.shopNameEn}* کی طرف سے آپ کا حساب کتاب و بل گوشوارہ:\n`;
    text += `---------------------------------\n`;
    text += `📦 *کل اجناس / لاٹس:* ${v.totalLots}\n`;
    text += `💵 *کل مال فروخت:* ${formatPKR(v.grossSales, settings.currencySymbol, settings.language)}\n`;
    text += `✂️ *کل کٹوتیاں و مندی اخراجات:* -${formatPKR(v.totalExpenses, settings.currencySymbol, settings.language)}\n`;
    text += `💰 *صافی واجب الادا رقم:* ${formatPKR(v.netPayable, settings.currencySymbol, settings.language)}\n`;
    text += `✅ *ادا شدہ رقم:* ${formatPKR(v.totalPaid, settings.currencySymbol, settings.language)}\n`;
    text += `⏳ *بقایا میزان:* ${formatPKR(v.remainingDue, settings.currencySymbol, settings.language)}\n`;
    text += `---------------------------------\n`;
    text += `کیفیت: ${v.isAllPaid ? 'تمام رقم ادا شدہ ہے ✅' : 'ادائیگی جاری ہے ⏳'}\n\n`;
    text += `👤 *آڑھتی:* ${settings.arhtiNameUrdu || settings.arhtiNameEn}\n`;
    text += `📞 *رابطہ:* ${settings.shopPhone}`;

    const cleanPhone = (v.phone || '').replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone ? (cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone) : '';
    const waUrl = phoneParam ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-4 pb-16 sm:pb-6 font-urdu-sans">
      {/* PRIMARY KHATA SECTION SWITCHER: CUSTOMERS VS VENDORS */}
      <div className="bg-slate-900 text-white p-1.5 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            sound.playTick();
            setActiveKhataSection('customers');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 ${
            activeKhataSection === 'customers'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isUrdu ? 'خریدار / گاہک کھاتہ جات (Customers)' : 'Customer Khatas'}</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-black/30 font-numbers">
            {customerList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            sound.playTick();
            setActiveKhataSection('vendors');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 ${
            activeKhataSection === 'vendors'
              ? 'bg-amber-600 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>{isUrdu ? 'زمیندار کھاتہ و ادائیگیاں (Vendors & Payments)' : 'Vendors Khata & Payments'}</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-black/30 font-numbers">
            {vendorList.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: CUSTOMERS KHATA (خریدار کھاتہ) */}
      {/* ========================================================= */}
      {activeKhataSection === 'customers' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Top Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-amber-900 font-bold font-urdu-sans block">{t.totalReceivables} (کل ادھار)</span>
                  <span className="text-lg sm:text-xl font-black text-amber-950 font-numbers block">
                    {formatPKR(totalOverallCredit, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-emerald-800 font-bold font-urdu-sans block">{t.totalCashReceived} (نقد وصولی)</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-950 font-numbers block">
                    {formatPKR(totalCashCollected, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-urdu-sans block">{t.customerDirectory}</span>
                  <span className="text-lg sm:text-xl font-black text-slate-900 font-numbers block">
                    {customerList.length} {isUrdu ? 'گاہک' : 'buyers'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenAddCustomer}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-sm active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>{t.addNewCustomer}</span>
              </button>
            </div>
          </div>

          {/* View Switcher, Filter & Search Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
              {/* Toggle View Mode */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setViewMode('khatas');
                  }}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition font-urdu-sans ${
                    viewMode === 'khatas'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isUrdu ? 'گاہک کھاتہ جات سمری' : 'Customer Khatas'} ({customerList.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setViewMode('transactions');
                  }}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition font-urdu-sans ${
                    viewMode === 'transactions'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isUrdu ? 'تمام نیلامی بولیاں' : 'All Auction Bids'} ({allSales.length})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-urdu-sans focus:ring-2 focus:ring-emerald-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 rtl:left-auto top-2.5" />
              </div>
            </div>

            {/* Filter Chips */}
            {viewMode === 'khatas' ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
                    filterStatus === 'all'
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.filterAll}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('credit')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
                    filterStatus === 'credit'
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isUrdu ? 'صرف ادھار کھاتہ دار' : 'Only Credit'} ({customerList.filter((c) => c.balance > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('cleared')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
                    filterStatus === 'cleared'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isUrdu ? 'صاف کھاتہ (بے باق)' : 'Fully Paid'} ({customerList.filter((c) => c.balance === 0).length})
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-xs font-bold text-slate-500 font-urdu-sans pl-1">
                  {isUrdu ? 'تاریخ فلٹر:' : 'Date Filter:'}
                </span>
                {[
                  { id: 'today', label: isUrdu ? 'آج' : 'Today' },
                  { id: 'last7days', label: isUrdu ? 'گزشتہ ۷ دن' : 'Last 7 Days' },
                  { id: 'thismonth', label: isUrdu ? 'رواں ماہ' : 'This Month' },
                  { id: 'all', label: isUrdu ? 'تمام تاریخیں' : 'All' },
                ].map((df) => (
                  <button
                    key={df.id}
                    type="button"
                    onClick={() => setTransactionsDateFilter(df.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
                      transactionsDateFilter === df.id
                        ? 'bg-slate-900 text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CUSTOMER KHATAS LIST */}
          {viewMode === 'khatas' && (
            <div className="space-y-3">
              {filteredCustomers.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-600 font-urdu-sans">
                    {isUrdu ? 'کوئی خریدار کھاتہ نہیں ملا' : 'No customer khata found'}
                  </p>
                </div>
              ) : (
                paginatedCustomers.map((cust) => {
                  const isExpanded = !!expandedCustomerKhatas[cust.name];
                  const isCleared = cust.balance === 0;

                  return (
                    <div
                      key={cust.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
                    >
                      {/* Customer Summary Bar */}
                      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                              isCleared
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {isCleared ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq truncate">
                                {cust.name}
                              </h3>
                              {cust.shopName && (
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-urdu-sans">
                                  {cust.shopName}
                                </span>
                              )}
                              {cust.address && (
                                <span className="text-[10px] text-slate-400 font-urdu-sans">
                                  📍 {cust.address}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-urdu-sans flex-wrap">
                              {cust.phone ? (
                                <span className="flex items-center gap-1 font-numbers text-slate-700 font-semibold">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  {cust.phone}
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-700 font-urdu-sans">
                                  (فون نمبر درج نہیں)
                                </span>
                              )}
                              <span>•</span>
                              <span>
                                {cust.totalPurchases} {isUrdu ? 'بار خریداری' : 'purchases'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Figures: Nakad & Uddar Under Individual Customer */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          {/* Nakad (Received) */}
                          <div className="bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-1 rounded-xl text-start sm:text-end">
                            <span className="text-[10px] text-emerald-800 font-bold font-urdu-sans block">
                              {isUrdu ? 'نقد (وصول شدہ):' : 'Nakad (Received):'}
                            </span>
                            <span className="text-sm sm:text-base font-black font-numbers text-emerald-700 block">
                              {formatPKR(cust.cashPaidDirect + cust.khataPaymentsReceived, settings.currencySymbol, settings.language)}
                            </span>
                          </div>

                          {/* Uddar (Credit Balance) */}
                          <div className={`px-2.5 py-1 rounded-xl border text-start sm:text-end ${
                            isCleared ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/90 border-amber-200/80'
                          }`}>
                            <span className="text-[10px] text-amber-900 font-bold font-urdu-sans block">
                              {isUrdu ? 'ادھار (بقایا):' : 'Uddar (Credit):'}
                            </span>
                            <span
                              className={`text-sm sm:text-base font-black font-numbers block ${
                                isCleared ? 'text-emerald-700' : 'text-amber-800'
                              }`}
                            >
                              {formatPKR(cust.balance, settings.currencySymbol, settings.language)}
                            </span>
                          </div>

                          {/* Connect Buttons */}
                          <div className="flex items-center gap-1.5">
                            {cust.phone && (
                              <a
                                href={`tel:${cust.phone}`}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 transition flex items-center justify-center"
                                title={isUrdu ? 'کال کریں' : 'Call'}
                              >
                                <PhoneCall className="w-4 h-4" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSendCustomerWhatsAppReminder(cust)}
                              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center justify-center active:scale-95"
                              title={isUrdu ? 'واٹس ایپ کھاتہ میسج' : 'WhatsApp Statement'}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>

                            {/* Add Manual Credit Button - ALWAYS ACCESSIBLE */}
                            <button
                              type="button"
                              onClick={() => {
                                sound.playTick();
                                setSelectedCustomerIdForCredit(
                                  selectedCustomerIdForCredit === cust.name ? null : cust.name
                                );
                                setSelectedCustomerIdForPayment(null);
                                setCustCreditAmount(0);
                                setCustCreditNote('');
                              }}
                              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer ${
                                selectedCustomerIdForCredit === cust.name
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                              title={isUrdu ? 'کھاتے میں دستی ادھار رقم کا اضافہ کریں' : 'Add manual credit'}
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{isUrdu ? 'ادھار اضافہ' : '+ Credit'}</span>
                            </button>

                            {/* Record Payment Button - STRICTLY ONLY IF PENDING BALANCE > 0 */}
                            {cust.balance > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  sound.playTick();
                                  setSelectedCustomerIdForPayment(
                                    selectedCustomerIdForPayment === cust.name ? null : cust.name
                                  );
                                  setSelectedCustomerIdForCredit(null);
                                  setCustPaymentAmount(cust.balance);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer"
                              >
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                <span>{isUrdu ? 'وصولی' : 'Payment'}</span>
                              </button>
                            ) : (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold font-urdu-sans flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>{isUrdu ? 'مکمل بے باق' : 'Cleared'}</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEditCustomer(cust)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                              title={t.edit}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleCustomerAccordion(cust.name)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline Record Payment Form - STRICTLY ONLY IF PENDING BALANCE > 0 */}
                      {selectedCustomerIdForPayment === cust.name && cust.balance > 0 && (
                        <div className="bg-emerald-50/80 p-3.5 border-t border-emerald-200 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in duration-150">
                          <div className="text-xs font-bold text-emerald-950 font-urdu-sans flex items-center gap-1.5 flex-shrink-0">
                            <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                            <span>{isUrdu ? 'نقد وصولی کا اندراج:' : 'Record Cash Recovery:'}</span>
                          </div>

                          <input
                            type="number"
                            inputMode="decimal"
                            value={custPaymentAmount || ''}
                            onChange={(e) => setCustPaymentAmount(parseNumber(e.target.value))}
                            placeholder="رقم (روپے)"
                            className="w-full sm:w-36 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-numbers font-bold focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                          />

                          <input
                            type="text"
                            value={custPaymentNote}
                            onChange={(e) => setCustPaymentNote(e.target.value)}
                            placeholder={isUrdu ? 'تفصیل (مثلاً: نقد بذریعہ حاجی صاحب)' : 'Note e.g. Cash payment'}
                            className="w-full sm:flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-urdu-sans"
                          />

                          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomerIdForPayment(null)}
                              className="px-3 py-1.5 bg-white text-slate-600 rounded-xl text-xs font-urdu-sans border border-slate-300"
                            >
                              {t.cancel}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecordCustomerPaymentSubmit(cust)}
                              disabled={custPaymentAmount <= 0}
                              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-urdu-sans shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{t.save}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Record Manual Credit Form */}
                      {selectedCustomerIdForCredit === cust.name && (
                        <div className="bg-amber-50/90 p-3.5 border-t border-amber-200 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in duration-150">
                          <div className="text-xs font-bold text-amber-950 font-urdu-sans flex items-center gap-1.5 flex-shrink-0">
                            <ArrowUpRight className="w-4 h-4 text-amber-700 stroke-[2.5]" />
                            <span>{isUrdu ? 'دستی ادھار رقم کا اندراج:' : 'Record Manual Credit:'}</span>
                          </div>

                          <input
                            type="number"
                            inputMode="decimal"
                            value={custCreditAmount || ''}
                            onChange={(e) => setCustCreditAmount(parseNumber(e.target.value))}
                            placeholder="رقم (روپے)"
                            className="w-full sm:w-36 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-numbers font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
                            autoFocus
                          />

                          <input
                            type="text"
                            value={custCreditNote}
                            onChange={(e) => setCustCreditNote(e.target.value)}
                            placeholder={isUrdu ? 'تفصیل (مثلاً: سابقہ بل، کیش لون، کھاتہ بقایا اضافہ)' : 'Note e.g. Previous balance, loan'}
                            className="w-full sm:flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-urdu-sans"
                          />

                          <input
                            type="date"
                            value={custCreditDate}
                            onChange={(e) => setCustCreditDate(e.target.value)}
                            className="w-full sm:w-32 px-2 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-numbers"
                          />

                          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomerIdForCredit(null)}
                              className="px-3 py-1.5 bg-white text-slate-600 rounded-xl text-xs font-urdu-sans border border-slate-300 cursor-pointer"
                            >
                              {t.cancel}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecordCustomerCreditSubmit(cust)}
                              disabled={custCreditAmount <= 0}
                              className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-urdu-sans shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{t.save}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Expanded Itemized Sales & Payment History with Sub-Pagination */}
                      {isExpanded && (() => {
                        const salesPageSize = 8;
                        const currentSalesPage = customerSalesSubPages[cust.name] || 1;
                        const totalSalesPages = Math.ceil(cust.sales.length / salesPageSize) || 1;
                        const paginatedCustSales = cust.sales.slice(
                          (currentSalesPage - 1) * salesPageSize,
                          currentSalesPage * salesPageSize
                        );

                        const payPageSize = 8;
                        const currentPayPage = customerPaymentsSubPages[cust.name] || 1;
                        const totalPayPages = Math.ceil(cust.paymentHistory.length / payPageSize) || 1;
                        const paginatedCustPayments = cust.paymentHistory.slice(
                          (currentPayPage - 1) * payPageSize,
                          currentPayPage * payPageSize
                        );

                        const creditPageSize = 8;
                        const currentCreditPage = customerCreditsSubPages[cust.name] || 1;
                        const totalCreditPages = Math.ceil((cust.manualCreditHistory?.length || 0) / creditPageSize) || 1;
                        const paginatedCustCredits = (cust.manualCreditHistory || []).slice(
                          (currentCreditPage - 1) * creditPageSize,
                          currentCreditPage * creditPageSize
                        );

                        const totalManualCredits = (cust.manualCreditHistory || []).reduce(
                          (sum, cr) => sum + (Number(cr.amount) || 0),
                          0
                        );
                        const totalOpeningAndManual = (cust.openingBalance || 0) + totalManualCredits;

                        return (
                        <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 space-y-4 animate-in fade-in duration-150">
                          {/* Individual Customer Financial Breakdown: Nakad vs Uddar */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-urdu-sans">
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                              <span className="text-slate-500 text-[11px] block">{isUrdu ? 'بولی خریداری' : 'Auction Bids'}</span>
                              <span className="font-bold text-slate-800 text-sm font-numbers block">
                                {formatPKR(
                                  cust.sales.reduce((sum, s) => sum + s.totalAmount, 0),
                                  settings.currencySymbol,
                                  settings.language
                                )}
                              </span>
                            </div>
                            <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-100 text-center">
                              <span className="text-amber-900 font-bold text-[11px] block">{isUrdu ? 'دستی ادھار و سابقہ' : 'Manual Credit / Prev'}</span>
                              <span className="font-bold text-amber-800 text-sm font-numbers block">
                                {formatPKR(totalOpeningAndManual, settings.currencySymbol, settings.language)}
                              </span>
                            </div>
                            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-center">
                              <span className="text-emerald-800 font-bold text-[11px] block">{isUrdu ? 'نقد وصول شدہ' : 'Cash Received'}</span>
                              <span className="font-bold text-emerald-700 text-sm font-numbers block">
                                {formatPKR(cust.cashPaidDirect + cust.khataPaymentsReceived, settings.currencySymbol, settings.language)}
                              </span>
                            </div>
                            <div className={`p-2 rounded-lg border text-center ${isCleared ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                              <span className="text-amber-900 font-bold text-[11px] block">{isUrdu ? 'خالص بقایا ادھار' : 'Net Balance Due'}</span>
                              <span className={`font-bold text-sm font-numbers block ${isCleared ? 'text-emerald-700' : 'text-amber-800'}`}>
                                {formatPKR(cust.balance, settings.currencySymbol, settings.language)}
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-slate-700 font-urdu-sans">
                                {t.salesList} ({cust.sales.length})
                              </h4>
                              {totalSalesPages > 1 && (
                                <div className="flex items-center gap-1.5 text-[11px] font-urdu-sans">
                                  <span className="text-slate-500 font-numbers">
                                    صفحہ {currentSalesPage} از {totalSalesPages}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={currentSalesPage <= 1}
                                    onClick={() =>
                                      setCustomerSalesSubPages((prev) => ({
                                        ...prev,
                                        [cust.name]: Math.max(1, currentSalesPage - 1),
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
                                  >
                                    ‹ پچھلا
                                  </button>
                                  <button
                                    type="button"
                                    disabled={currentSalesPage >= totalSalesPages}
                                    onClick={() =>
                                      setCustomerSalesSubPages((prev) => ({
                                        ...prev,
                                        [cust.name]: Math.min(totalSalesPages, currentSalesPage + 1),
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
                                  >
                                    اگلا ›
                                  </button>
                                </div>
                              )}
                            </div>

                            {cust.sales.length === 0 ? (
                              <p className="text-xs text-slate-400 font-urdu-sans">
                                {isUrdu ? 'کوئی بولی درج نہیں' : 'No bids yet'}
                              </p>
                            ) : (
                              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                                <table className="w-full text-xs text-start font-urdu-sans">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                                      <th className="py-1.5 px-2.5 text-start">{t.lotNumber}</th>
                                      <th className="py-1.5 px-2.5 text-start">{t.product}</th>
                                      <th className="py-1.5 px-2.5 text-center">{t.qty}</th>
                                      <th className="py-1.5 px-2.5 text-center">{t.rate}</th>
                                      <th className="py-1.5 px-2.5 text-end">{t.totalAmount}</th>
                                      {onDeleteSale && <th className="py-1.5 px-2 text-center">{isUrdu ? 'حذف' : 'Action'}</th>}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {paginatedCustSales.map((sale) => (
                                      <tr key={sale.saleId} className="hover:bg-slate-50/80">
                                        <td className="py-1.5 px-2.5 text-slate-500 font-numbers">#{sale.lotNumber}</td>
                                        <td className="py-1.5 px-2.5 font-bold text-slate-800">{sale.productUrdu}</td>
                                        <td className="py-1.5 px-2.5 text-center font-numbers">{sale.quantity} {sale.unitLabel}</td>
                                        <td className="py-1.5 px-2.5 text-center font-numbers">
                                          {formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-end font-bold font-numbers text-slate-900">
                                          {formatPKR(sale.totalAmount, settings.currencySymbol, settings.language)}
                                        </td>
                                        {onDeleteSale && (
                                          <td className="py-1.5 px-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                sound.playTick();
                                                setPendingDeleteAction({
                                                  type: 'buyer_sale',
                                                  title: isUrdu ? 'بولی ریکارڈ حذف کرنے کی تصدیق' : 'Confirm Bid Deletion',
                                                  description: isUrdu
                                                    ? `خریدار بولی حذف کریں: ${cust.name} - ${sale.productUrdu} (${sale.quantity} ${sale.unitLabel} @ ${formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)})`
                                                    : `Delete buyer bid: ${cust.name} - ${sale.productUrdu} (${sale.quantity} ${sale.unitLabel})`,
                                                  execute: () => {
                                                    if (onDeleteSale) {
                                                      onDeleteSale(sale.lotId, sale.saleId);
                                                    }
                                                  },
                                                });
                                              }}
                                              className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                              title={isUrdu ? 'بولی حذف کریں' : 'Delete bid'}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Manual Credit & Previous Balance Records */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-amber-950 font-urdu-sans flex items-center gap-1.5">
                                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
                                  <span>{isUrdu ? 'دستی ادھار و کھاتہ بقایا ریکارڈز' : 'Manual Credit & Balance Records'}</span>
                                  <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-numbers font-bold">
                                    {(cust.manualCreditHistory?.length || 0) + (cust.openingBalance && cust.openingBalance > 0 ? 1 : 0)}
                                  </span>
                                </h4>
                                {totalOpeningAndManual > 0 && (
                                  <span className="text-[11px] font-bold font-numbers text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-lg border border-amber-200">
                                    +{formatPKR(totalOpeningAndManual, settings.currencySymbol, settings.language)}
                                  </span>
                                )}
                              </div>

                              {totalCreditPages > 1 && (
                                <div className="flex items-center gap-1.5 text-[11px] font-urdu-sans">
                                  <span className="text-slate-500 font-numbers">
                                    {isUrdu ? `صفحہ ${currentCreditPage} از ${totalCreditPages}` : `Page ${currentCreditPage} of ${totalCreditPages}`}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={currentCreditPage <= 1}
                                    onClick={() =>
                                      setCustomerCreditsSubPages((prev) => ({
                                        ...prev,
                                        [cust.name]: Math.max(1, currentCreditPage - 1),
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700 cursor-pointer"
                                  >
                                    ‹ {isUrdu ? 'پچھلا' : 'Prev'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={currentCreditPage >= totalCreditPages}
                                    onClick={() =>
                                      setCustomerCreditsSubPages((prev) => ({
                                        ...prev,
                                        [cust.name]: Math.min(totalCreditPages, currentCreditPage + 1),
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700 cursor-pointer"
                                  >
                                    {isUrdu ? 'اگلا' : 'Next'} ›
                                  </button>
                                </div>
                              )}
                            </div>

                            {(!cust.manualCreditHistory || cust.manualCreditHistory.length === 0) && (!cust.openingBalance || cust.openingBalance <= 0) ? (
                              <div className="bg-white p-3 rounded-xl border border-dashed border-amber-200 text-center text-xs text-amber-900/70 font-urdu-sans">
                                {isUrdu
                                  ? 'اس گاہک کے کھاتے میں کوئی دستی ادھار یا سابقہ بقایا درج نہیں ہے۔ (اوپر "+ ادھار اضافہ" سے درج کریں)'
                                  : 'No manual credit records for this customer. Use "+ Credit" button above to add.'}
                              </div>
                            ) : (
                              <div className="overflow-x-auto bg-white rounded-xl border border-amber-200/90 shadow-2xs">
                                <table className="w-full text-xs text-start font-urdu-sans">
                                  <thead>
                                    <tr className="bg-amber-50/80 text-amber-950 border-b border-amber-200 text-[11px] font-bold">
                                      <th className="py-2 px-2.5 text-start">{t.date}</th>
                                      <th className="py-2 px-2.5 text-end">{isUrdu ? 'ادھار رقم' : 'Credit Amount'}</th>
                                      <th className="py-2 px-2.5 text-start">{isUrdu ? 'تفصیل / وجہ' : 'Description / Reason'}</th>
                                      <th className="py-2 px-2 text-center">{isUrdu ? 'حذف' : 'Action'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-amber-100/70">
                                    {/* Opening balance row if present */}
                                    {cust.openingBalance && cust.openingBalance > 0 && currentCreditPage === 1 && (
                                      <tr className="bg-amber-50/40">
                                        <td className="py-2 px-2.5 text-slate-500 font-urdu-sans text-[11px]">
                                          {isUrdu ? 'کھاتہ آغاز' : 'Account Opening'}
                                        </td>
                                        <td className="py-2 px-2.5 text-end font-bold font-numbers text-amber-900">
                                          +{formatPKR(cust.openingBalance, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-2 px-2.5 text-amber-950">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold font-urdu-sans">
                                            {isUrdu ? 'سابقہ اوپننگ بیلنس' : 'Opening Balance'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-center text-slate-400 text-[11px]">
                                          -
                                        </td>
                                      </tr>
                                    )}

                                    {/* Itemized manual credit history entries */}
                                    {paginatedCustCredits.map((cred) => (
                                      <tr key={cred.id} className="hover:bg-amber-50/30">
                                        <td className="py-2 px-2.5 text-slate-600 font-numbers">{cred.date || '-'}</td>
                                        <td className="py-2 px-2.5 text-end font-bold font-numbers text-amber-900">
                                          +{formatPKR(cred.amount, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-2 px-2.5 text-slate-700">
                                          {cred.notes || (isUrdu ? 'دستی ادھار رقم' : 'Manual credit balance')}
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              sound.playTick();
                                              setPendingDeleteAction({
                                                type: 'customer_credit',
                                                title: isUrdu ? 'دستی ادھار ریکارڈ حذف کرنے کی تصدیق' : 'Confirm Manual Credit Deletion',
                                                description: isUrdu
                                                  ? `دستی ادھار انٹری حذف کریں: ${cust.name} - رقم: ${formatPKR(cred.amount, settings.currencySymbol, settings.language)} (${cred.date || ''})`
                                                  : `Delete manual credit: ${cust.name} - Amount: ${formatPKR(cred.amount, settings.currencySymbol, settings.language)}`,
                                                execute: () => {
                                                  if (onDeleteCustomerCredit) {
                                                    onDeleteCustomerCredit(cust.name, cred.id);
                                                  }
                                                },
                                              });
                                            }}
                                            className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                            title={isUrdu ? 'ادھار ریکارڈ حذف کریں' : 'Delete credit record'}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Payment History Records */}
                          {cust.paymentHistory.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                                <h4 className="text-xs font-bold text-slate-700 font-urdu-sans flex items-center gap-1.5">
                                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>وصول شدہ ادائیگیاں ({cust.paymentHistory.length})</span>
                                </h4>
                                {totalPayPages > 1 && (
                                  <div className="flex items-center gap-1.5 text-[11px] font-urdu-sans">
                                    <span className="text-slate-500 font-numbers">
                                      صفحہ {currentPayPage} از {totalPayPages}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={currentPayPage <= 1}
                                      onClick={() =>
                                        setCustomerPaymentsSubPages((prev) => ({
                                          ...prev,
                                          [cust.name]: Math.max(1, currentPayPage - 1),
                                        }))
                                      }
                                      className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
                                    >
                                      ‹ پچھلا
                                    </button>
                                    <button
                                      type="button"
                                      disabled={currentPayPage >= totalPayPages}
                                      onClick={() =>
                                        setCustomerPaymentsSubPages((prev) => ({
                                          ...prev,
                                          [cust.name]: Math.min(totalPayPages, currentPayPage + 1),
                                        }))
                                      }
                                      className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
                                    >
                                      اگلا ›
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                                <table className="w-full text-xs text-start font-urdu-sans">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                                      <th className="py-1.5 px-2.5 text-start">{t.date}</th>
                                      <th className="py-1.5 px-2.5 text-end">رقم وصول</th>
                                      <th className="py-1.5 px-2.5 text-start">تفصیل</th>
                                      <th className="py-1.5 px-2 text-center">حذف</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {paginatedCustPayments.map((pay) => (
                                      <tr key={pay.id} className="hover:bg-slate-50/80">
                                        <td className="py-1.5 px-2.5 text-slate-500 font-numbers">{pay.date || '-'}</td>
                                        <td className="py-1.5 px-2.5 text-end font-bold font-numbers text-emerald-700">
                                          +{formatPKR(pay.amount, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{pay.notes || 'نقد وصولی'}</td>
                                        <td className="py-1.5 px-2 text-center">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              sound.playTick();
                                              setPendingDeleteAction({
                                                type: 'customer_payment',
                                                title: isUrdu ? 'گاہک ادائیگی ریکارڈ حذف کرنے کی تصدیق' : 'Confirm Customer Payment Deletion',
                                                description: isUrdu
                                                  ? `گاہک ادائیگی حذف کریں: ${cust.name} - رقم: ${formatPKR(pay.amount, settings.currencySymbol, settings.language)} (${pay.date || ''})`
                                                  : `Delete customer payment: ${cust.name} - Amount: ${formatPKR(pay.amount, settings.currencySymbol, settings.language)}`,
                                                execute: () => {
                                                  if (onDeleteCustomerPayment) {
                                                    onDeleteCustomerPayment(cust.name, pay.id);
                                                  }
                                                },
                                              });
                                            }}
                                            className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                                            title={isUrdu ? 'ادائیگی حذف کریں' : 'Delete payment'}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}

              {filteredCustomers.length > 0 && (
                <div className="pt-2">
                  <PaginationControls
                    currentPage={customerPage}
                    totalPages={customerTotalPages}
                    totalItems={filteredCustomers.length}
                    pageSize={customerPageSize}
                    onPageChange={setCustomerPage}
                    onPageSizeChange={setCustomerPageSize}
                    isUrdu={isUrdu}
                    itemName={isUrdu ? 'خریدار کھاتے' : 'customer khatas'}
                  />
                </div>
              )}
            </div>
          )}

          {/* ALL AUCTION TRANSACTIONS VIEW */}
          {viewMode === 'transactions' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start font-urdu-sans">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-bold">
                      <th className="py-2.5 px-3 text-start">{t.lotNumber}</th>
                      <th className="py-2.5 px-3 text-start">{t.vendorName}</th>
                      <th className="py-2.5 px-3 text-start">{t.customerName}</th>
                      <th className="py-2.5 px-3 text-start">{t.product}</th>
                      <th className="py-2.5 px-3 text-center">{t.qty}</th>
                      <th className="py-2.5 px-3 text-center">{t.rate}</th>
                      <th className="py-2.5 px-3 text-end">{t.totalAmount}</th>
                      <th className="py-2.5 px-3 text-center">{t.paymentMethod || (isUrdu ? 'ادائیگی نوعیت' : 'Type')}</th>
                      {onDeleteSale && <th className="py-2.5 px-2 text-center">{isUrdu ? 'حذف' : 'Action'}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedTransactions.map((sale) => (
                      <tr key={sale.saleId} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">#{sale.lotNumber}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{sale.vendorName}</td>
                        <td className="py-2 px-3 font-bold text-emerald-800">{sale.buyerName}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{sale.productUrdu}</td>
                        <td className="py-2 px-3 text-center font-numbers">{sale.quantity} {sale.unitLabel}</td>
                        <td className="py-2 px-3 text-center font-numbers">{formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)}</td>
                        <td className="py-2 px-3 text-end font-bold font-numbers text-slate-950">
                          {formatPKR(sale.totalAmount, settings.currencySymbol, settings.language)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              sale.paymentStatus === 'cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {sale.paymentStatus === 'cash' ? t.paymentCash : t.paymentCredit}
                          </span>
                        </td>
                        {onDeleteSale && (
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                sound.playTick();
                                setPendingDeleteAction({
                                  type: 'buyer_sale',
                                  title: isUrdu ? 'بولی ریکارڈ حذف کرنے کی تصدیق' : 'Confirm Bid Deletion',
                                  description: isUrdu
                                    ? `بولی ریکارڈ حذف کریں: ${sale.buyerName} - ${sale.productUrdu} (${sale.quantity} ${sale.unitLabel})`
                                    : `Delete bid transaction: ${sale.buyerName} - ${sale.productUrdu} (${sale.quantity} ${sale.unitLabel})`,
                                  execute: () => {
                                    if (onDeleteSale) {
                                      onDeleteSale(sale.lotId, sale.saleId);
                                    }
                                  },
                                });
                              }}
                              className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                              title={isUrdu ? 'بولی حذف کریں' : 'Delete bid'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredSalesForTransactions.length > 0 && (
                <div className="p-3 border-t border-slate-200">
                  <PaginationControls
                    currentPage={txPage}
                    totalPages={txTotalPages}
                    totalItems={filteredSalesForTransactions.length}
                    pageSize={txPageSize}
                    onPageChange={setTxPage}
                    onPageSizeChange={setTxPageSize}
                    isUrdu={isUrdu}
                    itemName={isUrdu ? 'لین دین' : 'transactions'}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: VENDORS KHATA & PAYMENT RECEIVE / PAY TO VENDOR */}
      {/* ========================================================= */}
      {activeKhataSection === 'vendors' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Vendor Financial Overview Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-slate-950 p-4 rounded-2xl shadow-xs">
              <span className="text-xs text-slate-900/80 font-bold block mb-1">
                کل واجب الادا رقم (Total Payable):
              </span>
              <div className="text-xl sm:text-2xl font-black font-numbers tracking-tight">
                {formatPKR(totalPayableToVendors, settings.currencySymbol, settings.language)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-emerald-700 font-bold block mb-1">
                ادا شدہ رقم (Total Paid to Vendors):
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-800 font-numbers tracking-tight">
                {formatPKR(totalPaidToVendors, settings.currencySymbol, settings.language)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-amber-700 font-bold block mb-1">
                بقایا ادائیگیاں (Remaining Due):
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-900 font-numbers tracking-tight">
                {formatPKR(totalRemainingPayable, settings.currencySymbol, settings.language)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block mb-1">کل زمیندار (Active Vendors):</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-numbers">
                  {vendorList.length}
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenAddVendor}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{isUrdu ? 'نیا زمیندار' : 'Add Vendor'}</span>
              </button>
            </div>
          </div>

          {/* Search Bar & Filter Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
              {/* Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setVendorFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    vendorFilterStatus === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isUrdu ? 'تمام زمیندار' : 'All Vendors'} ({vendorList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVendorFilterStatus('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    vendorFilterStatus === 'pending'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isUrdu ? 'ادائیگی بقایا' : 'Pending Payment'} ({vendorList.filter((v) => v.remainingDue > 0).length})
                </button>
                <button
                  type="button"
                  onClick={() => setVendorFilterStatus('paid')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    vendorFilterStatus === 'paid'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {isUrdu ? 'مکمل ادا شدہ' : 'Paid in Full'} ({vendorList.filter((v) => v.isAllPaid).length})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder={isUrdu ? 'زمیندار کا نام، شہر یا فون تلاش کریں...' : 'Search vendor name, city or phone...'}
                  value={vendorSearchTerm}
                  onChange={(e) => setVendorSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-urdu-sans focus:ring-2 focus:ring-amber-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-3 rtl:left-auto top-2.5" />
              </div>
            </div>
          </div>

          {/* VENDORS KHATA LIST */}
          <div className="space-y-3">
            {filteredVendors.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600">
                  {isUrdu ? 'کوئی زمیندار کھاتہ نہیں ملا' : 'No vendor khata found'}
                </p>
              </div>
            ) : (
              paginatedVendors.map((vendor) => {
                const isExpanded = !!expandedVendorKhatas[vendor.name];
                const isPaymentFormOpen = selectedVendorForPayment === vendor.name;

                return (
                  <div
                    key={vendor.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
                  >
                    {/* Vendor Summary Bar */}
                    <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            vendor.isAllPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {vendor.isAllPaid ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Clock className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq truncate">
                              {vendor.name}
                            </h3>
                            {vendor.city && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                📍 {vendor.city}
                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-numbers font-bold">
                              {vendor.totalLots} {isUrdu ? 'لاٹس' : 'lots'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                            {vendor.phone ? (
                              <span className="flex items-center gap-1 font-numbers text-slate-700 font-semibold">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                {vendor.phone}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                (فون نمبر درج نہیں)
                              </span>
                            )}
                            <span>•</span>
                            <span>
                              کل فروخت: <b className="font-numbers text-slate-800">{formatPKR(vendor.grossSales, settings.currencySymbol, settings.language)}</b>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Financial Figures & Action Buttons */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-start sm:text-end">
                          <span className="text-[10px] text-slate-400 block">
                            صافی واجب الادا (Net Payable):
                          </span>
                          <span className="text-sm font-bold font-numbers text-slate-900 block">
                            {formatPKR(vendor.netPayable, settings.currencySymbol, settings.language)}
                          </span>
                          <span className="text-[11px] font-bold font-numbers block mt-0.5">
                            {vendor.isAllPaid ? (
                              <span className="text-emerald-700">✅ مکمل ادا شدہ</span>
                            ) : (
                              <span className="text-amber-800">
                                بقایا: {formatPKR(vendor.remainingDue, settings.currencySymbol, settings.language)}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {vendor.phone && (
                            <a
                              href={`tel:${vendor.phone}`}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 transition flex items-center justify-center"
                              title="کال کریں"
                            >
                              <PhoneCall className="w-4 h-4" />
                            </a>
                          )}

                          {/* WhatsApp Statement */}
                          <button
                            type="button"
                            onClick={() => handleSendVendorWhatsAppStatement(vendor)}
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center justify-center active:scale-95"
                            title="واٹس ایپ بل میسج"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          {/* POS Thermal Print for Consolidated Lots */}
                          {vendor.lots.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                sound.playTick();
                                printConsolidatedThermalPOSReceipt(
                                  vendor.name,
                                  vendor.phone,
                                  vendor.city,
                                  vendor.lots,
                                  settings
                                );
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 transition flex items-center justify-center"
                              title="80mm POS تھرمل پرچی پرنٹ کریں"
                            >
                              <Printer className="w-4 h-4 text-amber-600" />
                            </button>
                          )}

                          {/* Dedicated Record Payment / Pay to Vendor Button - STRICTLY ONLY IF REMAINING DUE > 0 */}
                          {vendor.remainingDue > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                sound.playTick();
                                setSelectedVendorForPayment(
                                  isPaymentFormOpen ? null : vendor.name
                                );
                                setVendorPaymentAmount(vendor.remainingDue);
                                setVendorPaymentLotTarget('all');
                                setVendorPaymentNote('');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black transition flex items-center gap-1 shadow-xs active:scale-95"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>{isUrdu ? 'ادائیگی کا اندراج' : 'Pay to Vendor'}</span>
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold font-urdu-sans flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>{isUrdu ? 'مکمل ادا شدہ' : 'Fully Paid'}</span>
                            </span>
                          )}

                          {/* Toggle Details */}
                          <button
                            type="button"
                            onClick={() => toggleVendorAccordion(vendor.name)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="تفصیلات دیکھیں"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ========================================================= */}
                    {/* DEDICATED INLINE VENDOR PAYMENT RECEIVE / PAY INTERFACE DIV - STRICTLY ONLY IF REMAINING DUE > 0 */}
                    {/* ========================================================= */}
                    {isPaymentFormOpen && vendor.remainingDue > 0 && (
                      <div className="bg-amber-50/90 p-4 border-t border-b border-amber-200 animate-in fade-in duration-150 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4 text-amber-700" />
                            <span>زمیندار ادائیگی کا نیا اندراج (Record Payment to Vendor):</span>
                          </div>
                          <span className="text-[11px] text-amber-800 font-bold">
                            کل بقایا: {formatPKR(vendor.remainingDue, settings.currencySymbol, settings.language)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          {/* Payment Amount Input */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              ادائیگی کی رقم (روپے) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={vendorPaymentAmount || ''}
                              onChange={(e) => setVendorPaymentAmount(parseNumber(e.target.value))}
                              placeholder="رقم (روپے)"
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-numbers font-bold focus:ring-2 focus:ring-amber-500"
                              autoFocus
                            />
                          </div>

                          {/* Payment Method */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              ادائیگی کا طریقہ
                            </label>
                            <select
                              value={vendorPaymentMethod}
                              onChange={(e) => setVendorPaymentMethod(e.target.value as any)}
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-bold"
                            >
                              <option value="cash">💵 نقد (Cash)</option>
                              <option value="online">🏦 آن لائن بینک ٹرانسفر (Online Bank)</option>
                              <option value="cheque">📜 چیک (Bank Cheque)</option>
                            </select>
                          </div>

                          {/* Target Lot or Whole Balance */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              لاٹ منتخب کریں
                            </label>
                            <select
                              value={vendorPaymentLotTarget}
                              onChange={(e) => setVendorPaymentLotTarget(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                            >
                              <option value="all">مجموعی کھاتہ پر تقسیم کریں (All Lots)</option>
                              {vendor.lots.map((l) => (
                                <option key={l.id} value={l.id}>
                                  لاٹ #{l.lotNumber} - {l.productUrdu} ({formatPKR(l.summary.netPayableToVendor, settings.currencySymbol, settings.language)})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Payment Date */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              تاریخ ادائیگی
                            </label>
                            <input
                              type="date"
                              value={vendorPaymentDate}
                              onChange={(e) => setVendorPaymentDate(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-numbers focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        {/* Payment Note / Description */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            تفصیل / ریمارکس (Description / Notes)
                          </label>
                          <input
                            type="text"
                            value={vendorPaymentNote}
                            onChange={(e) => setVendorPaymentNote(e.target.value)}
                            placeholder="تفصیل درج کریں (مثلاً: نقد بذریعہ حاجی صاحب، یا آن لائن ٹرانسفر رسید نمبر)"
                            className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleQuickMarkVendorFullyPaid(vendor)}
                            className="text-xs font-bold text-amber-900 hover:text-amber-950 underline"
                          >
                            ⚡ مکمل یکمشت ادائیگی کے طور پر محفوظ کریں
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedVendorForPayment(null)}
                              className="px-3.5 py-1.5 bg-white text-slate-600 rounded-xl text-xs border border-slate-300 hover:bg-slate-100"
                            >
                              {t.cancel}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecordVendorPaymentSubmit(vendor)}
                              disabled={vendorPaymentAmount <= 0}
                              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>ادائیگی محفوظ کریں</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expanded Lots Table with Sub-Pagination & Payment History */}
                    {isExpanded && (() => {
                      const vendorLotsPageSize = 8;
                      const currentVendorLotsPage = vendorLotsSubPages[vendor.name] || 1;
                      const totalVendorLotsPages = Math.ceil(vendor.lots.length / vendorLotsPageSize) || 1;
                      const paginatedVendorLots = vendor.lots.slice(
                        (currentVendorLotsPage - 1) * vendorLotsPageSize,
                        currentVendorLotsPage * vendorLotsPageSize
                      );

                      const vendorPayPageSize = 6;
                      const currentVendorPayPage = vendorPaymentsSubPages[vendor.name] || 1;
                      const totalVendorPayPages = Math.ceil(vendor.paymentHistory.length / vendorPayPageSize) || 1;
                      const paginatedVendorPayments = vendor.paymentHistory.slice(
                        (currentVendorPayPage - 1) * vendorPayPageSize,
                        currentVendorPayPage * vendorPayPageSize
                      );

                      return (
                      <div className="bg-slate-50 p-3.5 sm:p-4 border-t border-slate-200 space-y-4">
                        {/* 3-part financial overview card for vendor */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] text-slate-500 font-urdu-sans block">صافی مال فروخت (واجب الادا):</span>
                            <span className="text-sm font-bold text-slate-900 font-numbers block">
                              {formatPKR(vendor.netPayable, settings.currencySymbol, settings.language)}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                            <span className="text-[10px] text-emerald-800 font-bold font-urdu-sans block">ادا شدہ نقد (Paid to Vendor):</span>
                            <span className="text-sm font-bold text-emerald-950 font-numbers block">
                              {formatPKR(vendor.totalPaid, settings.currencySymbol, settings.language)}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-amber-200 bg-amber-50/50">
                            <span className="text-[10px] text-amber-900 font-bold font-urdu-sans block">بقایا ادھار کھاتہ (Balance Due):</span>
                            <span className="text-sm font-bold text-amber-900 font-numbers block">
                              {formatPKR(vendor.remainingDue, settings.currencySymbol, settings.language)}
                            </span>
                          </div>
                        </div>

                        {/* Vendor Lots Section */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                              <Package className="w-4 h-4 text-amber-600" />
                              <span>زمیندار کی کل اجناس و لاٹس ({vendor.lots.length})</span>
                            </h4>

                            {totalVendorLotsPages > 1 && (
                              <div className="flex items-center gap-1.5 text-[11px] font-urdu-sans">
                                <span className="text-slate-500 font-numbers">
                                  صفحہ {currentVendorLotsPage} از {totalVendorLotsPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={currentVendorLotsPage <= 1}
                                  onClick={() =>
                                    setVendorLotsSubPages((prev) => ({
                                      ...prev,
                                      [vendor.name]: Math.max(1, currentVendorLotsPage - 1),
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
                                >
                                  ‹ پچھلا
                                </button>
                                <button
                                  type="button"
                                  disabled={currentVendorLotsPage >= totalVendorLotsPages}
                                  onClick={() =>
                                    setVendorLotsSubPages((prev) => ({
                                      ...prev,
                                      [vendor.name]: Math.min(totalVendorLotsPages, currentVendorLotsPage + 1),
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
                                >
                                  اگلا ›
                                </button>
                              </div>
                            )}
                          </div>

                          {vendor.lots.length === 0 ? (
                            <p className="text-xs text-slate-400">کوئی لاٹ موجود نہیں</p>
                          ) : (
                            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                              <table className="w-full text-xs text-start">
                                <thead>
                                  <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                                    <th className="py-2 px-2.5 text-start">لاٹ نمبر</th>
                                    <th className="py-2 px-2.5 text-start">تاریخ آمد</th>
                                    <th className="py-2 px-2.5 text-start">جنس مال</th>
                                    <th className="py-2 px-2.5 text-center">تعداد</th>
                                    <th className="py-2 px-2.5 text-end">کل فروخت</th>
                                    <th className="py-2 px-2.5 text-end">کٹوتیاں</th>
                                    <th className="py-2 px-2.5 text-end">صافی رقم</th>
                                    <th className="py-2 px-2.5 text-center">کیفیت</th>
                                    <th className="py-2 px-2.5 text-center">ایکشن</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {paginatedVendorLots.map((lot) => {
                                    const isLotPaid = lot.vendorPaymentStatus === 'paid';
                                    const lotUnitLabel = getUnitDisplayLabel(lot.unitType, settings.language);

                                    return (
                                      <tr key={lot.id} className="hover:bg-slate-50/80">
                                        <td
                                          className="py-2 px-2.5 font-mono font-bold text-slate-700"
                                          title={`لاٹ ID: ${lot.lotNumber}`}
                                        >
                                          #{getLotReceiptNumber(lot.lotNumber)}
                                        </td>
                                        <td className="py-2 px-2.5 text-slate-500 font-numbers">{lot.arrivalDate}</td>
                                        <td className="py-2 px-2.5 font-bold text-slate-900">{lot.productUrdu}</td>
                                        <td className="py-2 px-2.5 text-center font-numbers">{lot.totalQuantity} {lotUnitLabel}</td>
                                        <td className="py-2 px-2.5 text-end font-bold font-numbers text-slate-900">
                                          {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-2 px-2.5 text-end text-rose-700 font-numbers font-bold">
                                          -{formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-2 px-2.5 text-end font-black font-numbers text-slate-950">
                                          {formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-2 px-2.5 text-center">
                                          <button
                                            type="button"
                                            onClick={() => onToggleVendorPaymentStatus && onToggleVendorPaymentStatus(lot.id)}
                                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition ${
                                              isLotPaid
                                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                            }`}
                                            title="کلک کر کے ادا شدہ / بقایا سوئچ کریں"
                                          >
                                            {isLotPaid ? '✅ ادا شدہ' : '⏳ بقایا'}
                                          </button>
                                        </td>
                                        <td className="py-2 px-2.5 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            {onOpenReceipt && (
                                              <button
                                                type="button"
                                                onClick={() => onOpenReceipt(lot.id)}
                                                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                                                title="پرچی رسید دیکھیں"
                                              >
                                                <Receipt className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                            {onOpenExpenseSlip && (
                                              <button
                                                type="button"
                                                onClick={() => onOpenExpenseSlip(lot.id)}
                                                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                                                title="خرچہ پرچی دیکھیں"
                                              >
                                                <FileText className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                            {onDeleteLot && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  sound.playTick();
                                                  setPendingDeleteAction({
                                                    type: 'vendor_lot',
                                                    title: isUrdu ? 'لاٹ ریکارڈ حذف کرنے کی تصدیق' : 'Confirm Lot Deletion',
                                                    description: isUrdu
                                                      ? `لاٹ ریکارڈ حذف کریں: #${lot.lotNumber} - ${vendor.name} (${lot.productUrdu})`
                                                      : `Delete lot record: #${lot.lotNumber} - ${vendor.name} (${lot.productUrdu})`,
                                                    execute: () => {
                                                      if (onDeleteLot) {
                                                        onDeleteLot(lot.id);
                                                      }
                                                    },
                                                  });
                                                }}
                                                className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                                                title={isUrdu ? 'لاٹ حذف کریں' : 'Delete lot'}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
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

                        {/* Vendor Payment History Records - EXACT MATCH TO CUSTOMER WASOOL SHUDA ADYGYA */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-700 font-urdu-sans flex items-center gap-1.5">
                              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                              <span>مالک / زمیندار کو کی گئی ادائیگیاں ({vendor.paymentHistory.length})</span>
                            </h4>
                            {totalVendorPayPages > 1 && (
                              <div className="flex items-center gap-1.5 text-[11px] font-urdu-sans">
                                <span className="text-slate-500 font-numbers">
                                  صفحہ {currentVendorPayPage} از {totalVendorPayPages}
                                </span>
                                <button
                                  type="button"
                                  disabled={currentVendorPayPage <= 1}
                                  onClick={() =>
                                    setVendorPaymentsSubPages((prev) => ({
                                      ...prev,
                                      [vendor.name]: Math.max(1, currentVendorPayPage - 1),
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
                                >
                                  ‹ پچھلا
                                </button>
                                <button
                                  type="button"
                                  disabled={currentVendorPayPage >= totalVendorPayPages}
                                  onClick={() =>
                                    setVendorPaymentsSubPages((prev) => ({
                                      ...prev,
                                      [vendor.name]: Math.min(totalVendorPayPages, currentVendorPayPage + 1),
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-100 text-slate-700"
                                >
                                  اگلا ›
                                </button>
                              </div>
                            )}
                          </div>

                          {vendor.paymentHistory.length === 0 ? (
                            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500 font-urdu-sans">
                              ابھی تک زمیندار کو کوئی نقد ادائیگی درج نہیں ہوئی۔ اوپر <b className="text-amber-700">"ادائیگی کا اندراج"</b> بٹن سے ادائیگی محفوظ کریں۔
                            </div>
                          ) : (
                            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                              <table className="w-full text-xs text-start font-urdu-sans">
                                <thead>
                                  <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                                    <th className="py-1.5 px-2.5 text-start">{t.date}</th>
                                    <th className="py-1.5 px-2.5 text-end">ادا شدہ رقم</th>
                                    <th className="py-1.5 px-2.5 text-center">طریقہ کار</th>
                                    <th className="py-1.5 px-2.5 text-start">تفصیل / لاٹ نمبر</th>
                                    <th className="py-1.5 px-2 text-center">حذف</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {paginatedVendorPayments.map((pay) => (
                                    <tr key={pay.id} className="hover:bg-slate-50/80">
                                      <td className="py-1.5 px-2.5 text-slate-500 font-numbers">{pay.date || pay.paymentDate || '-'}</td>
                                      <td className="py-1.5 px-2.5 text-end font-bold font-numbers text-emerald-700">
                                        +{formatPKR(pay.amount, settings.currencySymbol, settings.language)}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-center">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                                          {pay.paymentMethod === 'online' ? '🏦 آن لائن بینک' : pay.paymentMethod === 'cheque' ? '📜 چیک' : '💵 نقد'}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2.5 text-slate-600">
                                        {pay.notes || (pay.lotNumber ? `لاٹ #${pay.lotNumber}` : 'نقد ادائیگی')}
                                      </td>
                                      <td className="py-1.5 px-2 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            sound.playTick();
                                            setPendingDeleteAction({
                                              type: 'vendor_payment',
                                              title: isUrdu ? 'زمیندار ادائیگی ریکارڈ حذف کرنے کی تصدیق' : 'Confirm Vendor Payment Deletion',
                                              description: isUrdu
                                                ? `زمیندار ادائیگی حذف کریں: ${vendor.name} - رقم: ${formatPKR(pay.amount, settings.currencySymbol, settings.language)} (${pay.paymentDate || ''})`
                                                : `Delete vendor payment: ${vendor.name} - Amount: ${formatPKR(pay.amount, settings.currencySymbol, settings.language)}`,
                                              execute: () => {
                                                if (onDeleteVendorPayment) {
                                                  onDeleteVendorPayment(vendor.name, pay.id, pay.lotId, pay.amount);
                                                }
                                              },
                                            });
                                          }}
                                          className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                                          title={isUrdu ? 'ادائیگی حذف کریں' : 'Delete payment'}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })()}
                  </div>
                );
              })
            )}

            {filteredVendors.length > 0 && (
              <div className="pt-2">
                <PaginationControls
                  currentPage={vendorPage}
                  totalPages={vendorTotalPages}
                  totalItems={filteredVendors.length}
                  pageSize={vendorPageSize}
                  onPageChange={setVendorPage}
                  onPageSizeChange={setVendorPageSize}
                  isUrdu={isUrdu}
                  itemName={isUrdu ? 'زمیندار کھاتے' : 'vendor khatas'}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT CUSTOMER MODAL */}
      {/* ========================================================= */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base font-urdu-nastaliq text-white">
                  {editingCustomer ? t.editCustomer : t.addNewCustomer}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
              {custError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {custError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.customerName} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => {
                    setCustName(e.target.value);
                    setCustError(null);
                  }}
                  placeholder={isUrdu ? 'مثلاً: طارق سبزی فروش' : 'e.g. Tariq Sabzi Shop'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.customerPhone}
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-numbers"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.shopName}
                  </label>
                  <input
                    type="text"
                    value={custShop}
                    onChange={(e) => setCustShop(e.target.value)}
                    placeholder={isUrdu ? 'دکان / مارکیٹ' : 'Shop / Market'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.address}
                </label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder={isUrdu ? 'پتہ یا علاقہ' : 'Address or area'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              {!editingCustomer && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.openingBalance} (سابقہ بقایا رقم)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={custOpeningBalance || ''}
                    onChange={(e) => setCustOpeningBalance(parseNumber(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-numbers"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.saveCustomer}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ADD / EDIT VENDOR MODAL */}
      {/* ========================================================= */}
      {isVendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base font-urdu-nastaliq text-white">
                  {editingVendor ? 'زمیندار ترمیم کریں' : 'نیا زمیندار شامل کریں'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVendorModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVendorSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
              {vError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {vError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  زمیندار / مال مالک کا نام <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={vName}
                  onChange={(e) => {
                    setVName(e.target.value);
                    setVError(null);
                  }}
                  placeholder="مثلاً: چوہدری اصغر، میاں اسلم"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    فون نمبر
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={vPhone}
                    onChange={(e) => setVPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-numbers"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    شہر / علاقہ
                  </label>
                  <input
                    type="text"
                    value={vCity}
                    onChange={(e) => setVCity(e.target.value)}
                    placeholder="مثلاً: اوکاڑہ، ساہیوال"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  نوٹس / تفصیل
                </label>
                <input
                  type="text"
                  value={vNotes}
                  onChange={(e) => setVNotes(e.target.value)}
                  placeholder="کوئی خاص معلومات یا حوالہ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-sm"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>زمیندار محفوظ کریں</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified PIN Security Prompt Modal for Deletion Actions */}
      <PinPromptModal
        isOpen={!!pendingDeleteAction}
        onClose={() => setPendingDeleteAction(null)}
        onSuccess={() => {
          if (pendingDeleteAction) {
            sound.playTrash();
            pendingDeleteAction.execute();
            setPendingDeleteAction(null);
          }
        }}
        correctPin={settings.securityPin || '1234'}
        isUrdu={isUrdu}
        title={pendingDeleteAction?.title}
        itemDescription={pendingDeleteAction?.description}
      />
    </div>
  );
};
