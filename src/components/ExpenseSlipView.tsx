import React, { useState, useMemo } from 'react';
import {
  VendorLot,
  AppSettings,
  ShopExpense,
  ExpenseCategory,
  expenseCategoryLabels,
} from '../types';
import { translations } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import {
  Receipt,
  Plus,
  Trash2,
  Edit3,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Calendar,
  Filter,
  X,
  Printer,
  Download,
} from 'lucide-react';
import { PaginationControls } from './PaginationControls';
import { ReportPDFPreviewModal } from './ReportPDFPreviewModal';
import { buildExpenseReportPDF, PDFPreviewData } from '../utils/pdfReportGenerator';
import { printDetailedReportDocument } from '../utils/printHelper';

export type ExpenseDateFilter = 'all' | 'today' | 'yesterday' | 'last7days' | 'thismonth' | 'custom';

interface ExpenseSlipViewProps {
  lot?: VendorLot;
  lots?: VendorLot[];
  expenses?: ShopExpense[];
  onSaveExpense?: (expense: ShopExpense) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onUpdateLotExpenses?: (lotId: string, updatedExpenses: VendorLot['expenses']) => void;
  onOpenReceipt?: (lotId: string) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onBackToBolli?: () => void;
  onSelectLot?: (lotId: string) => void;
  settings: AppSettings;
}

export const ExpenseSlipView: React.FC<ExpenseSlipViewProps> = ({
  expenses: shopExpenses = [],
  onSaveExpense,
  onDeleteExpense,
  onBackToBolli,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  // -------------------------------------------------------------
  // SHOP GENERAL EXPENSES STATE & HANDLERS
  // -------------------------------------------------------------
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('tea');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formPaidTo, setFormPaidTo] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'cash' | 'online' | 'cheque'>('cash');
  const [formNotes, setFormNotes] = useState('');

  // Filters state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<ExpenseDateFilter>('today');
  const [customFromDate, setCustomFromDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customToDate, setCustomToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state for Shop Expenses list
  const [expensePage, setExpensePage] = useState<number>(1);
  const [expensePageSize, setExpensePageSize] = useState<number>(20);

  // PDF Preview Modal State
  const [pdfPreview, setPdfPreview] = useState<PDFPreviewData | null>(null);

  const openAddExpenseModal = () => {
    sound.playTick();
    setEditingExpenseId(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormCategory('tea');
    setFormTitle('');
    setFormAmount('');
    setFormPaidTo('');
    setFormPaymentMethod('cash');
    setFormNotes('');
    setIsExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: ShopExpense) => {
    sound.playTick();
    setEditingExpenseId(exp.id);
    setFormDate(exp.date);
    setFormCategory(exp.category);
    setFormTitle(exp.title);
    setFormAmount(exp.amount);
    setFormPaidTo(exp.paidTo || '');
    setFormPaymentMethod(exp.paymentMethod || 'cash');
    setFormNotes(exp.notes || '');
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseNumber(formAmount);
    if (!formTitle.trim() || numAmount <= 0) return;

    const payload: ShopExpense = {
      id: editingExpenseId || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: formDate,
      category: formCategory,
      title: formTitle.trim(),
      amount: numAmount,
      paidTo: formPaidTo.trim() || undefined,
      paymentMethod: formPaymentMethod,
      notes: formNotes.trim() || undefined,
      createdAt: editingExpenseId
        ? shopExpenses.find((x) => x.id === editingExpenseId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onSaveExpense) {
      onSaveExpense(payload);
    }
    setIsExpenseModalOpen(false);
  };

  // Helper for human-readable date filter label (used in headers, PDF, and print)
  const getDateFilterLabel = () => {
    if (dateFilter === 'all') return isUrdu ? 'تمام دستیاب ریکارڈ' : 'All Time Records';
    if (dateFilter === 'today') return isUrdu ? 'آج کی تاریخ' : "Today's Date";
    if (dateFilter === 'yesterday') return isUrdu ? 'گزشتہ کل کی تاریخ' : 'Yesterday';
    if (dateFilter === 'last7days') return isUrdu ? 'گزشتہ ۷ دن' : 'Last 7 Days';
    if (dateFilter === 'thismonth') return isUrdu ? 'رواں ماہ' : 'This Month';
    if (dateFilter === 'custom') {
      if (customFromDate && customToDate) {
        return isUrdu
          ? `از تاریخ ${customFromDate} تا ${customToDate}`
          : `From ${customFromDate} to ${customToDate}`;
      }
      if (customFromDate) return isUrdu ? `از تاریخ ${customFromDate}` : `From ${customFromDate}`;
      if (customToDate) return isUrdu ? `تا تاریخ ${customToDate}` : `Until ${customToDate}`;
    }
    return isUrdu ? 'تمام ریکارڈ' : 'All Records';
  };

  // Check if expense date falls within chosen range
  const isExpenseInDateRange = (expDate: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return expDate === todayStr;
    if (dateFilter === 'yesterday') return expDate === yesterdayStr;
    if (dateFilter === 'last7days') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return expDate >= sevenDaysAgo && expDate <= todayStr;
    }
    if (dateFilter === 'thismonth') {
      const monthPrefix = new Date().toISOString().slice(0, 7);
      return expDate.startsWith(monthPrefix);
    }
    if (dateFilter === 'custom') {
      if (customFromDate && customToDate) {
        return expDate >= customFromDate && expDate <= customToDate;
      }
      if (customFromDate) return expDate >= customFromDate;
      if (customToDate) return expDate <= customToDate;
      return true;
    }
    return true;
  };

  // Filtered Shop Expenses
  const filteredShopExpenses = useMemo(() => {
    return shopExpenses.filter((exp) => {
      if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;
      if (!isExpenseInDateRange(exp.date)) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = exp.title.toLowerCase().includes(query);
        const matchesPaidTo = exp.paidTo?.toLowerCase().includes(query) ?? false;
        const matchesCategory =
          expenseCategoryLabels[exp.category]?.ur.includes(query) || exp.category.includes(query);
        if (!matchesTitle && !matchesPaidTo && !matchesCategory) return false;
      }
      return true;
    });
  }, [shopExpenses, categoryFilter, dateFilter, customFromDate, customToDate, searchTerm]);

  // Shop Expenses Stats
  const shopExpensesStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = new Date().toISOString().slice(0, 7);

    let totalAll = 0;
    let todayTotal = 0;
    let monthTotal = 0;
    let cashTotal = 0;

    shopExpenses.forEach((exp) => {
      const amt = exp.amount || 0;
      totalAll += amt;
      if (exp.date === todayStr) todayTotal += amt;
      if (exp.date.startsWith(monthStr)) monthTotal += amt;
      if (exp.paymentMethod === 'cash') cashTotal += amt;
    });

    return { totalAll, todayTotal, monthTotal, cashTotal, count: shopExpenses.length };
  }, [shopExpenses]);

  // Paginated Expenses
  const totalExpensePages = Math.ceil(filteredShopExpenses.length / expensePageSize) || 1;
  const paginatedShopExpenses = useMemo(() => {
    const start = (expensePage - 1) * expensePageSize;
    return filteredShopExpenses.slice(start, start + expensePageSize);
  }, [filteredShopExpenses, expensePage, expensePageSize]);

  // Reset pagination to page 1 when filters change
  React.useEffect(() => {
    setExpensePage(1);
  }, [categoryFilter, dateFilter, customFromDate, customToDate, searchTerm]);

  // PDF Report Handler for Shop Expenses
  const handlePreviewExpensePDF = () => {
    sound.playTick();
    const dateFilterLabel = getDateFilterLabel();
    const filteredTotal = filteredShopExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const filteredCash = filteredShopExpenses
      .filter((e) => e.paymentMethod === 'cash')
      .reduce((s, e) => s + (e.amount || 0), 0);
    const filteredOnline = filteredShopExpenses
      .filter((e) => e.paymentMethod === 'online' || e.paymentMethod === 'cheque')
      .reduce((s, e) => s + (e.amount || 0), 0);

    const preview = buildExpenseReportPDF(
      filteredShopExpenses,
      settings,
      dateFilterLabel,
      filteredTotal,
      filteredCash,
      filteredOnline
    );
    setPdfPreview(preview);
  };

  // Direct High-Quality Print for Shop Expenses
  const handlePrintExpenseReport = () => {
    sound.playTick();
    const dateFilterLabel = getDateFilterLabel();
    const filteredTotal = filteredShopExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const filteredCash = filteredShopExpenses
      .filter((e) => e.paymentMethod === 'cash')
      .reduce((s, e) => s + (e.amount || 0), 0);
    const filteredOnline = filteredShopExpenses
      .filter((e) => e.paymentMethod === 'online' || e.paymentMethod === 'cheque')
      .reduce((s, e) => s + (e.amount || 0), 0);

    const preview = buildExpenseReportPDF(
      filteredShopExpenses,
      settings,
      dateFilterLabel,
      filteredTotal,
      filteredCash,
      filteredOnline
    );
    printDetailedReportDocument(preview);
  };

  return (
    <div className="space-y-4 pb-16 sm:pb-6">
      {/* Header Bar: Shop Expenses & Petty Cash */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq">
                {isUrdu ? 'دکان کے اخراجات و روزنامچہ' : 'Shop Expenses & Petty Cash'}
              </h2>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[11px] rounded-full font-numbers font-bold">
                {shopExpenses.length} {isUrdu ? 'اندراجات' : 'entries'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-urdu-sans">
              {isUrdu
                ? 'دکان کا چائے، کرایہ، تنخواہ، بجلی بل اور دیگر متفرق روزمرہ اخراجات کا محفوظ حساب کتاب'
                : 'Manage shop petty cash, daily expenses, bills, rent, and staff costs'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openAddExpenseModal}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{isUrdu ? 'نیا خرچہ درج کریں' : 'Add Expense'}</span>
          </button>

          {onBackToBolli && (
            <button
              onClick={onBackToBolli}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 font-urdu-sans border border-slate-200"
            >
              {isUrdu ? <ArrowRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowLeft className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{t.backToBolli}</span>
            </button>
          )}
        </div>
      </div>

      {/* Shop Expenses Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. Today's Expenses */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold font-urdu-sans block">
            {isUrdu ? 'آج کے اخراجات' : "Today's Expenses"}
          </span>
          <span className="text-base sm:text-lg font-black text-rose-700 font-numbers block mt-0.5">
            {formatPKR(shopExpensesStats.todayTotal, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-slate-400 font-urdu-sans">
            {new Date().toISOString().slice(0, 10)}
          </span>
        </div>

        {/* 2. This Month's Expenses */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold font-urdu-sans block">
            {isUrdu ? 'رواں ماہ کے اخراجات' : "This Month's"}
          </span>
          <span className="text-base sm:text-lg font-black text-slate-900 font-numbers block mt-0.5">
            {formatPKR(shopExpensesStats.monthTotal, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-slate-400 font-urdu-sans">
            {new Date().toISOString().slice(0, 7)}
          </span>
        </div>

        {/* 3. Cash Expenses */}
        <div className="bg-emerald-50 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[11px] text-emerald-800 font-bold font-urdu-sans block">
            {isUrdu ? 'نقد ادا شدہ' : 'Paid in Cash'}
          </span>
          <span className="text-base sm:text-lg font-black text-emerald-950 font-numbers block mt-0.5">
            {formatPKR(shopExpensesStats.cashTotal, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-emerald-700 font-urdu-sans">
            {isUrdu ? 'دکان کی دراز سے' : 'Direct from register'}
          </span>
        </div>

        {/* 4. Total Overall Expenses */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl border border-slate-800 shadow-xs">
          <span className="text-[11px] text-slate-300 font-bold font-urdu-sans block">
            {isUrdu ? 'کل دکان اخراجات' : 'Total Shop Expenses'}
          </span>
          <span className="text-base sm:text-lg font-black text-rose-400 font-numbers block mt-0.5">
            {formatPKR(shopExpensesStats.totalAll, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-slate-400 font-urdu-sans">
            {shopExpensesStats.count} {isUrdu ? 'کل اندراجات' : 'total entries'}
          </span>
        </div>
      </div>

      {/* Search, Date Filter & Category Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isUrdu ? 'خرچے کا عنوان، وصول کنندہ یا مد تلاش کریں...' : 'Search expenses by title, recipient...'}
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-urdu-sans text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Filters Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
            <span className="text-xs text-slate-500 font-bold font-urdu-sans flex items-center gap-1 whitespace-nowrap pl-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>{isUrdu ? 'تاریخ فلٹر:' : 'Date:'}</span>
            </span>
            {[
              { id: 'all' as ExpenseDateFilter, label: isUrdu ? 'تمام' : 'All' },
              { id: 'today' as ExpenseDateFilter, label: isUrdu ? 'آج' : 'Today' },
              { id: 'yesterday' as ExpenseDateFilter, label: isUrdu ? 'گزشتہ کل' : 'Yesterday' },
              { id: 'last7days' as ExpenseDateFilter, label: isUrdu ? 'گزشتہ ۷ دن' : 'Last 7 Days' },
              { id: 'thismonth' as ExpenseDateFilter, label: isUrdu ? 'رواں ماہ' : 'This Month' },
              { id: 'custom' as ExpenseDateFilter, label: isUrdu ? 'اپنی مرضی کی تاریخ' : 'Custom Range' },
            ].map((df) => (
              <button
                key={df.id}
                onClick={() => {
                  sound.playTick();
                  setDateFilter(df.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-urdu-sans whitespace-nowrap transition ${
                  dateFilter === df.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker Box (Shown when Custom Range is active) */}
        {dateFilter === 'custom' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-150">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-urdu-sans">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isUrdu ? 'از تاریخ:' : 'From:'}</span>
                </span>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-numbers text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-urdu-sans">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isUrdu ? 'تا تاریخ:' : 'To:'}</span>
                </span>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-numbers text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Quick Presets within custom range */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  const d = new Date();
                  const today = d.toISOString().slice(0, 10);
                  d.setDate(d.getDate() - 30);
                  setCustomFromDate(d.toISOString().slice(0, 10));
                  setCustomToDate(today);
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold font-urdu-sans transition shadow-2xs"
              >
                {isUrdu ? 'گزشتہ ۳۰ دن' : 'Last 30 Days'}
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  const now = new Date();
                  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                  setCustomFromDate(startOfMonth);
                  setCustomToDate(endOfMonth);
                }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold font-urdu-sans transition shadow-2xs"
              >
                {isUrdu ? 'پورا مہینہ' : 'Full Month'}
              </button>
            </div>
          </div>
        )}

        {/* Category Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar pt-1 border-t border-slate-100">
          <button
            onClick={() => {
              sound.playTick();
              setCategoryFilter('all');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition font-urdu-sans ${
              categoryFilter === 'all'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {isUrdu ? 'تمام مدات' : 'All Categories'}
          </button>
          {(Object.keys(expenseCategoryLabels) as ExpenseCategory[]).map((cat) => {
            const info = expenseCategoryLabels[cat];
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  sound.playTick();
                  setCategoryFilter(cat);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition font-urdu-sans flex items-center gap-1 ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{info.icon}</span>
                <span>{isUrdu ? info.ur : info.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expenses List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Receipt className="w-4 h-4 text-slate-700" />
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq">
              {isUrdu ? 'دکان اخراجات ریکارڈ' : 'Shop Expenses Records'} ({filteredShopExpenses.length})
            </h3>
            {dateFilter !== 'all' && (
              <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-urdu-sans">
                {getDateFilterLabel()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 justify-between sm:justify-end flex-wrap">
            <div className="text-xs font-bold text-slate-800 font-urdu-sans">
              {isUrdu ? 'مجموعہ:' : 'Total:'}{' '}
              <span className="text-rose-700 font-numbers font-black">
                {formatPKR(
                  filteredShopExpenses.reduce((s, e) => s + (e.amount || 0), 0),
                  settings.currencySymbol,
                  settings.language
                )}
              </span>
            </div>

            {filteredShopExpenses.length > 0 && (
              <div className="flex items-center gap-1.5">
                {/* PDF Report Preview Button */}
                <button
                  type="button"
                  onClick={handlePreviewExpensePDF}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
                  title={isUrdu ? 'پی ڈی ایف رپورٹ دیکھیں یا ڈاؤن لوڈ کریں' : 'Preview / Download PDF Report'}
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isUrdu ? 'پی ڈی ایف رپورٹ' : 'PDF Report'}</span>
                </button>

                {/* Direct High-Quality Print Button */}
                <button
                  type="button"
                  onClick={handlePrintExpenseReport}
                  className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition shadow-xs active:scale-95"
                  title={isUrdu ? 'پرنٹ کریں' : 'Print'}
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {filteredShopExpenses.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs sm:text-sm font-bold text-slate-700 font-urdu-sans">
              {isUrdu ? 'کوئی خرچہ ریکارڈ نہیں ملا' : 'No expenses recorded yet'}
            </p>
            <p className="text-xs text-slate-400 font-urdu-sans">
              {dateFilter !== 'all' || categoryFilter !== 'all' || searchTerm
                ? (isUrdu ? 'منتخب کردہ فلٹر کے مطابق کوئی ریکارڈ دستیاب نہیں ہے۔' : 'No records match the current filter.')
                : (isUrdu ? 'دکان کا نیا خرچہ درج کرنے کے لیے اوپر دیا گیا بٹن دبائیں۔' : 'Click "+ Add Expense" to record daily expenses.')}
            </p>
            <button
              onClick={openAddExpenseModal}
              className="mt-2 px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold font-urdu-sans hover:bg-slate-800 transition shadow-xs"
            >
              {isUrdu ? '+ نیا خرچہ درج کریں' : '+ Add Expense'}
            </button>
          </div>
        ) : (
          <div>
            <div className="divide-y divide-slate-100">
              {paginatedShopExpenses.map((exp) => {
                const catInfo = expenseCategoryLabels[exp.category] || { ur: exp.category, en: exp.category, icon: '💸' };
                return (
                  <div
                    key={exp.id}
                    className="p-3 sm:p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-center text-lg flex-shrink-0">
                        {catInfo.icon}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                            {exp.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold font-urdu-sans">
                            {isUrdu ? catInfo.ur : catInfo.en}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-urdu-sans ${
                              exp.paymentMethod === 'cash'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {exp.paymentMethod === 'cash'
                              ? isUrdu
                                ? 'نقد'
                                : 'Cash'
                              : exp.paymentMethod === 'online'
                              ? isUrdu
                                ? 'آن لائن'
                                : 'Online'
                              : isUrdu
                              ? 'چیک'
                              : 'Cheque'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-urdu-sans flex-wrap">
                          <span className="font-numbers">{exp.date}</span>
                          {exp.paidTo && (
                            <span>
                              {isUrdu ? 'وصول کنندہ:' : 'Paid to:'}{' '}
                              <strong className="text-slate-700">{exp.paidTo}</strong>
                            </span>
                          )}
                          {exp.notes && (
                            <span className="text-slate-400 italic">({exp.notes})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-sm sm:text-base font-black text-rose-700 font-numbers block">
                          {formatPKR(exp.amount, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditExpenseModal(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          title={isUrdu ? 'ترمیم کریں' : 'Edit'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteExpense && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(isUrdu ? 'کیا آپ واقعی یہ خرچہ حذف کرنا چاہتے ہیں؟' : 'Delete this expense entry?')) {
                                sound.playPop();
                                onDeleteExpense(exp.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title={isUrdu ? 'حذف کریں' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {filteredShopExpenses.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200">
                <PaginationControls
                  currentPage={expensePage}
                  totalPages={totalExpensePages}
                  totalItems={filteredShopExpenses.length}
                  pageSize={expensePageSize}
                  onPageChange={setExpensePage}
                  onPageSizeChange={(newSize) => {
                    setExpensePageSize(newSize);
                    setExpensePage(1);
                  }}
                  isUrdu={isUrdu}
                  itemName={isUrdu ? 'اخراجات' : 'expenses'}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* MODAL: ADD / EDIT SHOP GENERAL EXPENSE                         */}
      {/* ============================================================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-sm sm:text-base font-urdu-nastaliq">
                  {editingExpenseId ? (isUrdu ? 'خرچہ ترمیم کریں' : 'Edit Expense') : (isUrdu ? 'نیا دکان خرچہ درج کریں' : 'Record Shop Expense')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveExpenseSubmit} className="p-4 sm:p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                    {isUrdu ? 'تاریخ' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-numbers focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                    {isUrdu ? 'مد / کیٹیگری' : 'Category'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {(Object.keys(expenseCategoryLabels) as ExpenseCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {expenseCategoryLabels[cat].icon} {isUrdu ? expenseCategoryLabels[cat].ur : expenseCategoryLabels[cat].en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                  {isUrdu ? 'تفصیل / خرچے کا عنوان *' : 'Description / Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={isUrdu ? 'مثلاً صبح کی چائے، ملازمین دوپہر کھانا، بل بجلی وغیرہ' : 'e.g. Morning tea, Lunch, Electricity bill'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Amount in PKR */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                    {isUrdu ? 'رقم (روپے) *' : 'Amount (PKR) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value === '' ? '' : parseNumber(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-rose-800 font-numbers focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Paid To */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                    {isUrdu ? 'کس کو ادا کیا؟ (اختیاری)' : 'Paid To / Recipient'}
                  </label>
                  <input
                    type="text"
                    value={formPaidTo}
                    onChange={(e) => setFormPaidTo(e.target.value)}
                    placeholder={isUrdu ? 'مثلاً ہوٹل والا، اصغر منشی، واپڈا' : 'e.g. Asghar, WAPDA'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                  {isUrdu ? 'طریقہ ادائیگی' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', labelUrdu: 'نقد (کیش)', labelEn: 'Cash' },
                    { id: 'online', labelUrdu: 'آن لائن / بینک', labelEn: 'Online Bank' },
                    { id: 'cheque', labelUrdu: 'چیک', labelEn: 'Cheque' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormPaymentMethod(m.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold font-urdu-sans border transition flex items-center justify-center gap-1.5 ${
                        formPaymentMethod === m.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{isUrdu ? m.labelUrdu : m.labelEn}</span>
                      {formPaymentMethod === m.id && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                  {isUrdu ? 'مزید ریمارکس یا نوٹ (اختیاری)' : 'Notes / Remarks (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={isUrdu ? 'کوئی اضافی تفصیل لکھیں...' : 'Add any extra notes...'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition shadow-xs active:scale-95"
                >
                  {isUrdu ? 'محفوظ کریں' : 'Save Expense'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition"
                >
                  {isUrdu ? 'منسوخ' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF REPORT INTERACTIVE PREVIEW MODAL (دیکھیں یا ڈاؤن لوڈ کریں) */}
      {pdfPreview && (
        <ReportPDFPreviewModal
          previewData={pdfPreview}
          onClose={() => setPdfPreview(null)}
          isUrdu={isUrdu}
        />
      )}
    </div>
  );
};
