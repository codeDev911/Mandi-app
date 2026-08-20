import React, { useState } from 'react';
import {
  VendorLot,
  AppSettings,
  CustomerBuyer,
  BuyerPaymentRecord,
  SavedVendor,
  VendorPaymentRecord,
  VendorPaymentStatus,
} from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { printConsolidatedThermalPOSReceipt } from '../utils/receiptGenerator';
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
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onOpenReceipt?: (lotId: string) => void;
  onOpenExpenseSlip?: (lotId: string) => void;
  settings: AppSettings;
}

export const BuyersKhataView: React.FC<BuyersKhataViewProps> = ({
  lots,
  customers,
  vendors = [],
  onSaveCustomer,
  onDeleteCustomer,
  onRecordCustomerPayment,
  onToggleSalePaymentStatus,
  onSaveVendor,
  onDeleteVendor,
  onRecordVendorPayment,
  onToggleVendorPaymentStatus,
  onOpenReceipt,
  onOpenExpenseSlip,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  // Primary Tab: Customer Khata vs. Vendor Khata & Payments
  const [activeKhataSection, setActiveKhataSection] = useState<'customers' | 'vendors'>('customers');

  // Customer Section States
  const [viewMode, setViewMode] = useState<'khatas' | 'transactions'>('khatas');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'credit' | 'cleared'>('all');
  const [selectedCustomerIdForPayment, setSelectedCustomerIdForPayment] = useState<string | null>(null);
  const [expandedCustomerKhatas, setExpandedCustomerKhatas] = useState<Record<string, boolean>>({});

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

  // Add/Edit Vendor Modal State
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<SavedVendor | null>(null);
  const [vName, setVName] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vCity, setVCity] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vError, setVError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // 1. CUSTOMER KHATA AGGREGATION
  // -------------------------------------------------------------
  const allSales = lots.flatMap((lot) =>
    lot.sales.map((sale) => ({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      vendorName: lot.vendorName,
      productUrdu: lot.productUrdu,
      unitLabel: unitLabels[lot.unitType][settings.language],
      saleId: sale.id,
      buyerName: sale.buyerName,
      buyerPhone: sale.buyerPhone,
      quantity: sale.quantity,
      ratePerUnit: sale.ratePerUnit,
      totalAmount: sale.totalAmount,
      paymentStatus: sale.paymentStatus,
      paidAmount: sale.paidAmount,
      timestamp: sale.timestamp,
    }))
  );

  const customerMap = new Map<
    string,
    {
      id: string;
      name: string;
      phone?: string;
      shopName?: string;
      address?: string;
      totalPurchases: number;
      grossPurchasesAmount: number;
      cashPaidDirect: number;
      creditBidsAmount: number;
      khataPaymentsReceived: number;
      balance: number;
      sales: typeof allSales;
      paymentHistory: BuyerPaymentRecord[];
    }
  >();

  customers.forEach((c) => {
    customerMap.set(c.name, {
      id: c.id,
      name: c.name,
      phone: c.phone,
      shopName: c.shopName,
      address: c.address,
      totalPurchases: 0,
      grossPurchasesAmount: c.openingBalance || 0,
      cashPaidDirect: 0,
      creditBidsAmount: c.openingBalance || 0,
      khataPaymentsReceived: c.payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
      balance: (c.openingBalance || 0) - (c.payments?.reduce((sum, p) => sum + p.amount, 0) || 0),
      sales: [],
      paymentHistory: c.payments || [],
    });
  });

  allSales.forEach((sale) => {
    let entry = customerMap.get(sale.buyerName);
    if (!entry) {
      entry = {
        id: `cust-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: sale.buyerName,
        phone: sale.buyerPhone,
        totalPurchases: 0,
        grossPurchasesAmount: 0,
        cashPaidDirect: 0,
        creditBidsAmount: 0,
        khataPaymentsReceived: 0,
        balance: 0,
        sales: [],
        paymentHistory: [],
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

  const customerList = Array.from(customerMap.values()).map((c) => {
    const totalDue = c.creditBidsAmount;
    const netOutstanding = Math.max(0, totalDue - c.khataPaymentsReceived);
    return {
      ...c,
      balance: netOutstanding,
    };
  });

  const filteredCustomers = customerList.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.shopName && c.shopName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterStatus === 'credit') return c.balance > 0;
    if (filterStatus === 'cleared') return c.balance === 0;
    return true;
  });

  const totalOverallCredit = customerList.reduce((sum, c) => sum + c.balance, 0);
  const totalCashCollected = customerList.reduce((sum, c) => sum + c.cashPaidDirect + c.khataPaymentsReceived, 0);

  // -------------------------------------------------------------
  // 2. VENDOR KHATA & PAYMENTS AGGREGATION
  // -------------------------------------------------------------
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
      totalPaid: v.payments?.reduce((sum, p) => sum + p.amount, 0) || 0,
      remainingDue: (v.openingBalance || 0) - (v.payments?.reduce((sum, p) => sum + p.amount, 0) || 0),
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

    const lotPaid =
      lot.vendorPaymentAmount !== undefined
        ? lot.vendorPaymentAmount
        : lot.vendorPaymentStatus === 'paid'
        ? lot.summary.netPayableToVendor
        : 0;

    entry.totalPaid += lotPaid;
    if (!entry.phone && lot.vendorPhone) entry.phone = lot.vendorPhone;
    if (!entry.city && lot.vendorCity) entry.city = lot.vendorCity;
    entry.lots.push(lot);
  });

  const vendorList = Array.from(vendorMap.values()).map((v) => {
    const remaining = Math.max(0, v.netPayable - v.totalPaid);
    const isAllPaid = remaining === 0 && v.netPayable > 0;
    const isPartial = v.totalPaid > 0 && remaining > 0;
    return {
      ...v,
      remainingDue: remaining,
      isAllPaid,
      isPartial,
    };
  });

  const filteredVendors = vendorList.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(vendorSearchTerm.toLowerCase()) ||
      (v.phone && v.phone.includes(vendorSearchTerm)) ||
      (v.city && v.city.toLowerCase().includes(vendorSearchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (vendorFilterStatus === 'pending') return v.remainingDue > 0;
    if (vendorFilterStatus === 'paid') return v.isAllPaid;
    return true;
  });

  const totalPayableToVendors = vendorList.reduce((sum, v) => sum + v.netPayable, 0);
  const totalPaidToVendors = vendorList.reduce((sum, v) => sum + v.totalPaid, 0);
  const totalRemainingPayable = Math.max(0, totalPayableToVendors - totalPaidToVendors);

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
    if (!custName.trim()) {
      setCustError(isUrdu ? 'براہ کرم خریدار کا نام درج کریں' : 'Please enter customer name');
      return;
    }

    const newCust: CustomerBuyer = {
      id: editingCustomer?.id || `cust-${Date.now()}`,
      name: custName.trim(),
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

  // Vendor Payment Submission
  const handleRecordVendorPaymentSubmit = (vendor: typeof vendorList[0]) => {
    if (vendorPaymentAmount <= 0 && vendorPaymentLotTarget === 'all') return;

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
    sound.playCashChime();
    if (onRecordVendorPayment) {
      onRecordVendorPayment(vendor.name, {
        amount: vendor.netPayable,
        notes: isUrdu ? 'مکمل ادائیگی یکمشت ادا کی گئی' : 'Marked fully paid in full',
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'cash',
        status: 'paid',
      });
    }
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
                filteredCustomers.map((cust) => {
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

                        {/* Financial Figures & Connect/Action Buttons */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-start sm:text-end">
                            <span className="text-[10px] text-slate-400 font-urdu-sans block">
                              {t.balanceDue} (بقایا کھاتہ):
                            </span>
                            <span
                              className={`text-base sm:text-lg font-black font-numbers block ${
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

                            {/* Record Payment Button */}
                            <button
                              type="button"
                              onClick={() => {
                                sound.playTick();
                                setSelectedCustomerIdForPayment(
                                  selectedCustomerIdForPayment === cust.name ? null : cust.name
                                );
                                setCustPaymentAmount(cust.balance > 0 ? cust.balance : 0);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-xs active:scale-95"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>{isUrdu ? 'وصولی' : 'Payment'}</span>
                            </button>

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

                      {/* Inline Record Payment Form */}
                      {selectedCustomerIdForPayment === cust.name && (
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
                              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-urdu-sans shadow-xs flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{t.save}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Expanded Itemized Sales & Payment History */}
                      {isExpanded && (
                        <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 space-y-3 animate-in fade-in duration-150">
                          <div>
                            <h4 className="text-xs font-bold text-slate-700 mb-1.5 font-urdu-sans">
                              {t.salesList} ({cust.sales.length})
                            </h4>
                            {cust.sales.length === 0 ? (
                              <p className="text-xs text-slate-400 font-urdu-sans">
                                {isUrdu ? 'کوئی بولی درج نہیں' : 'No bids yet'}
                              </p>
                            ) : (
                              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                                <table className="w-full text-xs text-start font-urdu-sans">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                                      <th className="py-1.5 px-2.5 text-start">{t.date}</th>
                                      <th className="py-1.5 px-2.5 text-start">{t.product}</th>
                                      <th className="py-1.5 px-2.5 text-center">{t.qty}</th>
                                      <th className="py-1.5 px-2.5 text-center">{t.rate}</th>
                                      <th className="py-1.5 px-2.5 text-end">{t.totalAmount}</th>
                                      <th className="py-1.5 px-2.5 text-center">{t.status}</th>
                                      <th className="py-1.5 px-2.5 text-center">{t.action}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {cust.sales.map((sale) => (
                                      <tr key={sale.saleId} className="hover:bg-slate-50/80">
                                        <td className="py-1.5 px-2.5 text-slate-500 font-numbers">{sale.lotNumber}</td>
                                        <td className="py-1.5 px-2.5 font-bold text-slate-800">{sale.productUrdu}</td>
                                        <td className="py-1.5 px-2.5 text-center font-numbers">{sale.quantity} {sale.unitLabel}</td>
                                        <td className="py-1.5 px-2.5 text-center font-numbers">
                                          {formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-end font-bold font-numbers text-slate-900">
                                          {formatPKR(sale.totalAmount, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                          <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                              sale.paymentStatus === 'cash'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-amber-100 text-amber-900'
                                            }`}
                                          >
                                            {sale.paymentStatus === 'cash' ? t.paymentCash : t.paymentCredit}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                          <button
                                            type="button"
                                            onClick={() => onToggleSalePaymentStatus(sale.lotId, sale.saleId)}
                                            className="text-[11px] text-emerald-700 hover:underline font-bold"
                                          >
                                            {sale.paymentStatus === 'cash' ? (isUrdu ? 'ادھار کریں' : 'Set Credit') : t.markPaid}
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
                              <h4 className="text-xs font-bold text-slate-700 mb-1.5 font-urdu-sans flex items-center gap-1.5">
                                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                                <span>وصول شدہ ادائیگیاں (Payment Receipts)</span>
                              </h4>
                              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                                <table className="w-full text-xs text-start font-urdu-sans">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                                      <th className="py-1.5 px-2.5 text-start">{t.date}</th>
                                      <th className="py-1.5 px-2.5 text-end">رقم وصول</th>
                                      <th className="py-1.5 px-2.5 text-start">تفصیل</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {cust.paymentHistory.map((pay) => (
                                      <tr key={pay.id} className="hover:bg-slate-50/80">
                                        <td className="py-1.5 px-2.5 text-slate-500 font-numbers">{pay.date || '-'}</td>
                                        <td className="py-1.5 px-2.5 text-end font-bold font-numbers text-emerald-700">
                                          +{formatPKR(pay.amount, settings.currencySymbol, settings.language)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{pay.notes || 'نقد وصولی'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
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
                      <th className="py-2.5 px-3 text-center">{t.status}</th>
                      <th className="py-2.5 px-3 text-center">{t.action}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allSales.map((sale) => (
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
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onToggleSalePaymentStatus(sale.lotId, sale.saleId)}
                            className="text-xs text-emerald-700 font-bold hover:underline"
                          >
                            {sale.paymentStatus === 'cash' ? (isUrdu ? 'ادھار کریں' : 'Set Credit') : t.markPaid}
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
              filteredVendors.map((vendor) => {
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

                          {/* Dedicated Record Payment / Pay to Vendor Button */}
                          <button
                            type="button"
                            onClick={() => {
                              sound.playTick();
                              setSelectedVendorForPayment(
                                isPaymentFormOpen ? null : vendor.name
                              );
                              setVendorPaymentAmount(vendor.remainingDue > 0 ? vendor.remainingDue : vendor.netPayable);
                              setVendorPaymentLotTarget('all');
                              setVendorPaymentNote('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black transition flex items-center gap-1 shadow-xs active:scale-95"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>{isUrdu ? 'ادائیگی کا اندراج' : 'Pay to Vendor'}</span>
                          </button>

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
                    {/* DEDICATED INLINE VENDOR PAYMENT RECEIVE / PAY INTERFACE DIV */}
                    {/* ========================================================= */}
                    {isPaymentFormOpen && (
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

                    {/* Expanded Lots Table */}
                    {isExpanded && (
                      <div className="bg-slate-50 p-3.5 sm:p-4 border-t border-slate-200 space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-2">
                          <Package className="w-4 h-4 text-amber-600" />
                          <span>زمیندار کی کل اجناس و لاٹس ({vendor.lots.length})</span>
                        </h4>

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
                                {vendor.lots.map((lot) => {
                                  const isLotPaid = lot.vendorPaymentStatus === 'paid';
                                  const lotUnitLabel = unitLabels[lot.unitType][settings.language];

                                  return (
                                    <tr key={lot.id} className="hover:bg-slate-50/80">
                                      <td className="py-2 px-2.5 font-mono font-bold text-slate-700">#{lot.lotNumber}</td>
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
                    )}
                  </div>
                );
              })
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
    </div>
  );
};
