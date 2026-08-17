import React, { useState } from 'react';
import { VendorLot, AppSettings, CustomerBuyer, BuyerPaymentRecord } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
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
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface BuyersKhataViewProps {
  lots: VendorLot[];
  customers: CustomerBuyer[];
  onSaveCustomer: (customer: CustomerBuyer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onRecordCustomerPayment: (customerId: string, payment: BuyerPaymentRecord) => void;
  onToggleSalePaymentStatus: (lotId: string, saleId: string) => void;
  settings: AppSettings;
}

export const BuyersKhataView: React.FC<BuyersKhataViewProps> = ({
  lots,
  customers,
  onSaveCustomer,
  onDeleteCustomer,
  onRecordCustomerPayment,
  onToggleSalePaymentStatus,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

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

  // Payment Recording Modal State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState('');

  // 1. Flatten all sales across all lots
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

  // 2. Aggregate per-customer khata summaries
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

  // Initialize with saved customers
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

  // Accumulate transactions from all lots
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

  // Calculate final balance per customer
  const customerList = Array.from(customerMap.values()).map((c) => {
    const totalDue = c.creditBidsAmount;
    const netOutstanding = Math.max(0, totalDue - c.khataPaymentsReceived);
    return {
      ...c,
      balance: netOutstanding,
    };
  });

  // Filters
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

  const filteredSales = allSales.filter((item) => {
    const matchesSearch =
      item.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productUrdu.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lotNumber.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === 'credit') return item.paymentStatus === 'credit';
    if (filterStatus === 'cleared') return item.paymentStatus === 'cash';
    return true;
  });

  const totalOverallCredit = customerList.reduce((acc, c) => acc + c.balance, 0);
  const totalCashCollected = allSales
    .filter((s) => s.paymentStatus === 'cash')
    .reduce((acc, s) => acc + s.totalAmount, 0) +
    customers.reduce((sum, c) => sum + (c.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0), 0);

  // Toggle Khata Accordion
  const toggleAccordion = (name: string) => {
    sound.playTick();
    setExpandedCustomerKhatas((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Open Add/Edit Customer Modal
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

  const handleOpenEditCustomer = (c: typeof customerList[0]) => {
    sound.playTick();
    const existing = customers.find((cust) => cust.name === c.name);
    setEditingCustomer(existing || {
      id: c.id,
      name: c.name,
      phone: c.phone,
      shopName: c.shopName,
      address: c.address,
      balance: c.balance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setCustName(c.name);
    setCustPhone(c.phone || '');
    setCustShop(c.shopName || '');
    setCustAddress(c.address || '');
    setCustOpeningBalance(existing?.openingBalance || 0);
    setCustNotes(existing?.notes || '');
    setCustError(null);
    setIsCustomerModalOpen(true);
  };

  // Save Customer
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

  // Record Payment Submit
  const handleRecordPaymentSubmit = (customer: typeof customerList[0]) => {
    if (paymentAmount <= 0) return;

    sound.playCashChime();
    const newRecord: BuyerPaymentRecord = {
      id: `pay-${Date.now()}`,
      amount: paymentAmount,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'cash',
      notes: paymentNote.trim() || undefined,
    };

    // If customer doesn't exist in saved list, save them first
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
    setPaymentAmount(0);
    setPaymentNote('');
  };

  // WhatsApp reminder message
  const handleSendWhatsAppReminder = (c: typeof customerList[0]) => {
    sound.playCashChime();
    let text = `*محترم ${c.name} صاحب!* السلام علیکم\n\n`;
    text += `*${settings.shopNameUrdu}* کی طرف سے آپ کا موجودہ کھاتہ گوشوارہ:\n`;
    text += `---------------------------------\n`;
    text += `💰 *بقایا واجب الادا رقم:* ${formatPKR(c.balance, settings.currencySymbol, settings.language)}\n`;
    text += `📦 *کل خریداریاں:* ${c.totalPurchases} مرتبہ\n`;
    text += `---------------------------------\n`;
    text += `براہ کرم بقایا رقم کی جلد از جلد ادائیگی فرما کر رسید حاصل کریں۔ شکریہ!\n\n`;
    text += `👤 *آڑھتی:* ${settings.arhtiNameUrdu}\n`;
    text += `📞 *رابطہ:* ${settings.shopPhone}`;

    const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone ? (cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone) : '';
    const waUrl = phoneParam ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-4 pb-16 sm:pb-6">
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
            onClick={() => setFilterStatus('credit')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
              filterStatus === 'credit'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isUrdu ? 'صرف بقایا ادھار کھاتے' : 'With Pending Credit'}
          </button>
          <button
            onClick={() => setFilterStatus('cleared')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
              filterStatus === 'cleared'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isUrdu ? 'صاف کھاتے / نقد' : 'Cleared / Zero Balance'}
          </button>
        </div>
      </div>

      {/* VIEW 1: CUSTOMER KHATA CARDS WITH DIRECT CONNECT & PAYMENT CONTROLS */}
      {viewMode === 'khatas' && (
        <div className="space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 font-urdu-sans">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs">{isUrdu ? 'کوئی خریدار نہیں ملا' : 'No customers found'}</p>
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const isExpanded = !!expandedCustomerKhatas[cust.name];
              const isCleard = cust.balance === 0;

              return (
                <div
                  key={cust.name}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
                >
                  {/* Card Main Row */}
                  <div className="p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                          isCleard
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isCleard ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
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

                        {/* Phone and Purchases Count */}
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
                            isCleard ? 'text-emerald-700' : 'text-amber-800'
                          }`}
                        >
                          {formatPKR(cust.balance, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      {/* Connect Buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Call Button */}
                        {cust.phone && (
                          <a
                            href={`tel:${cust.phone}`}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 text-slate-700 transition flex items-center justify-center"
                            title={isUrdu ? 'کال کریں' : 'Call'}
                          >
                            <PhoneCall className="w-4 h-4" />
                          </a>
                        )}

                        {/* WhatsApp Reminder Button */}
                        <button
                          onClick={() => handleSendWhatsAppReminder(cust)}
                          className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center justify-center active:scale-95"
                          title={isUrdu ? 'واٹس ایپ کھاتہ میسج' : 'WhatsApp Statement'}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        {/* Record Payment Button */}
                        <button
                          onClick={() => {
                            sound.playTick();
                            setSelectedCustomerIdForPayment(
                              selectedCustomerIdForPayment === cust.name ? null : cust.name
                            );
                            setPaymentAmount(cust.balance > 0 ? cust.balance : 0);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-xs active:scale-95"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>{isUrdu ? 'وصولی' : 'Payment'}</span>
                        </button>

                        {/* Edit Customer Button */}
                        <button
                          onClick={() => handleOpenEditCustomer(cust)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                          title={t.edit}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Expand Ledger Details */}
                        <button
                          onClick={() => toggleAccordion(cust.name)}
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
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(parseNumber(e.target.value))}
                        placeholder="رقم (روپے)"
                        className="w-full sm:w-36 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-numbers font-bold focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />

                      <input
                        type="text"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder={isUrdu ? 'تفصیل (مثلاً: نقد بذریعہ حاجی صاحب)' : 'Note e.g. Cash payment'}
                        className="w-full sm:flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-urdu-sans"
                      />

                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => setSelectedCustomerIdForPayment(null)}
                          className="px-3 py-1.5 bg-white text-slate-600 rounded-xl text-xs font-urdu-sans border border-slate-300"
                        >
                          {t.cancel}
                        </button>
                        <button
                          onClick={() => handleRecordPaymentSubmit(cust)}
                          disabled={paymentAmount <= 0}
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
                      {/* Bids List */}
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

                      {/* Payment History Log */}
                      {cust.paymentHistory.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-emerald-800 mb-1.5 font-urdu-sans">
                            {isUrdu ? 'وصولی کی تاریخ' : 'Payment History'}
                          </h4>
                          <div className="space-y-1">
                            {cust.paymentHistory.map((p) => (
                              <div
                                key={p.id}
                                className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between text-xs font-urdu-sans"
                              >
                                <span className="font-numbers text-slate-500">{p.date}</span>
                                <span className="text-slate-600">{p.notes || (isUrdu ? 'نقد وصولی' : 'Cash')}</span>
                                <span className="font-bold text-emerald-800 font-numbers">
                                  + {formatPKR(p.amount, settings.currencySymbol, settings.language)}
                                </span>
                              </div>
                            ))}
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

      {/* VIEW 2: ALL INDIVIDUAL BIDS LIST */}
      {viewMode === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredSales.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {isUrdu ? 'کوئی نیلامی ریکارڈ نہیں ملا' : 'No records found'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSales.map((item) => {
                const isPaid = item.paymentStatus === 'cash';

                return (
                  <div
                    key={`${item.lotId}-${item.saleId}`}
                    className="p-3 sm:p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                          isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isPaid ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq truncate">
                            {item.buyerName}
                          </h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-urdu-sans ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {isPaid ? t.paid : t.paymentCredit}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                          {item.productUrdu} • {item.quantity} {item.unitLabel} @{' '}
                          <strong className="font-numbers">
                            {formatPKR(item.ratePerUnit, settings.currencySymbol, settings.language)}
                          </strong>{' '}
                          • {item.vendorName} ({item.lotNumber})
                        </p>
                      </div>
                    </div>

                    {/* Amount & Status Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-start sm:text-end">
                        <span className="text-xs sm:text-base font-black text-slate-900 font-numbers block">
                          {formatPKR(item.totalAmount, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          sound.playCashChime();
                          onToggleSalePaymentStatus(item.lotId, item.saleId);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 font-urdu-sans active:scale-95 shadow-xs ${
                          isPaid
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        }`}
                      >
                        {isPaid ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{isUrdu ? 'کھاتہ کریں' : 'Make Credit'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{t.markPaid}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base font-urdu-nastaliq text-white">
                  {editingCustomer ? t.editCustomer : t.addNewCustomer}
                </h3>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
              {custError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-urdu-sans">
                  {custError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-urdu-sans">
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 font-urdu-sans">
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
                  <label className="block text-xs font-medium text-slate-700 mb-1 font-urdu-sans">
                    {t.shopName}
                  </label>
                  <input
                    type="text"
                    value={custShop}
                    onChange={(e) => setCustShop(e.target.value)}
                    placeholder={isUrdu ? 'دکان / مارکیٹ' : 'Shop / Market'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 font-urdu-sans">
                  {t.address}
                </label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder={isUrdu ? 'پتہ یا علاقہ' : 'Address or area'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans"
                />
              </div>

              {!editingCustomer && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 font-urdu-sans">
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
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs font-urdu-sans"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs font-urdu-sans flex items-center justify-center gap-1 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.saveCustomer}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
