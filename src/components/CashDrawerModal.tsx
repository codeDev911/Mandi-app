import React, { useState, useMemo } from 'react';
import {
  VendorLot,
  CustomerBuyer,
  ShopExpense,
  DrawerAdjustment,
  AppSettings,
  CashDrawerSummary,
} from '../types';
import { calculateCashDrawerSummary } from '../utils/calculations';
import { formatPKR, parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import {
  X,
  Plus,
  Minus,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Calendar,
  Trash2,
  Share2,
  Printer,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';

interface CashDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lots: VendorLot[];
  customers: CustomerBuyer[];
  expenses: ShopExpense[];
  drawerAdjustments: DrawerAdjustment[];
  onAddAdjustment: (adj: Omit<DrawerAdjustment, 'id' | 'timestamp'>) => void;
  onDeleteAdjustment: (id: string) => void;
  settings: AppSettings;
}

export const CashDrawerModal: React.FC<CashDrawerModalProps> = ({
  isOpen,
  onClose,
  lots,
  customers,
  expenses,
  drawerAdjustments,
  onAddAdjustment,
  onDeleteAdjustment,
  settings,
}) => {
  const isUrdu = settings.language === 'ur';

  // Overall running summary across all records (physical drawer balance)
  const overallSummary = useMemo(() => {
    return calculateCashDrawerSummary(lots, customers, expenses, drawerAdjustments);
  }, [lots, customers, expenses, drawerAdjustments]);

  // Today's summary
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todaySummary = useMemo(() => {
    return calculateCashDrawerSummary(lots, customers, expenses, drawerAdjustments, undefined, (d) => d === todayStr);
  }, [lots, customers, expenses, drawerAdjustments, todayStr]);

  // State for manual cash adjustment form
  const [activeTab, setActiveTab] = useState<'overview' | 'add_entry' | 'history'>('overview');
  const [adjType, setAdjType] = useState<'in' | 'out'>('in');
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjReason, setAdjReason] = useState<string>('');
  const [adjDate, setAdjDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [adjNotes, setAdjNotes] = useState<string>('');

  if (!isOpen) return null;

  const quickReasonPresets = {
    in: [
      'صبح کا اوپننگ بیلنس',
      'بینک سے کیش نکلوایا',
      'مالک ذاتی جمع',
      'اضافی کیش جمع',
      'متفرق وصولی',
    ],
    out: [
      'بینک میں کیش جمع کروایا',
      'مالک ذاتی نکاسی (Drawings)',
      'سیف / تجوری میں منتقل',
      'دیگر نقد نکاسی',
    ],
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseNumber(adjAmount);
    if (!amountNum || amountNum <= 0) return;

    sound.playCashChime();
    onAddAdjustment({
      type: adjType,
      amount: amountNum,
      reason: adjReason.trim() || (adjType === 'in' ? 'دستی کیش جمع' : 'دستی کیش نکاسی'),
      date: adjDate || new Date().toISOString().slice(0, 10),
      notes: adjNotes.trim() || undefined,
    });

    setAdjAmount('');
    setAdjReason('');
    setAdjNotes('');
    setActiveTab('overview');
  };

  const handleShareWA = () => {
    sound.playCashChime();
    let text = `*💼 گلہ کیش رپورٹ (Cash in Drawer)*\n`;
    text += `*${settings.shopNameUrdu}*\n`;
    text += `📅 تاریخ: ${new Date().toLocaleDateString('en-PK')}\n`;
    text += `--------------------------------\n`;
    text += `💰 *موجودہ کل گلہ کیش:* ${formatPKR(overallSummary.netCashInDrawer, settings.currencySymbol, settings.language)}\n`;
    text += `--------------------------------\n`;
    text += `📥 *کل نقد وصولیاں:* ${formatPKR(overallSummary.totalCashIn, settings.currencySymbol, settings.language)}\n`;
    text += `  • نقد فروخت: ${formatPKR(overallSummary.salesCashCollected, settings.currencySymbol, settings.language)}\n`;
    text += `  • کھاتہ نقد وصولی: ${formatPKR(overallSummary.buyerKhataCashCollected, settings.currencySymbol, settings.language)}\n`;
    text += `  • دستی جمع: ${formatPKR(overallSummary.manualCashIn, settings.currencySymbol, settings.language)}\n`;
    text += `--------------------------------\n`;
    text += `📤 *کل نقد اخراجات و ادائیگیاں:* ${formatPKR(overallSummary.totalCashOut, settings.currencySymbol, settings.language)}\n`;
    text += `  • دکان اخراجات: ${formatPKR(overallSummary.shopCashExpenses, settings.currencySymbol, settings.language)}\n`;
    text += `  • زمیندار ادائیگی: ${formatPKR(overallSummary.vendorCashPaid, settings.currencySymbol, settings.language)}\n`;
    text += `  • دستی نکاسی: ${formatPKR(overallSummary.manualCashOut, settings.currencySymbol, settings.language)}\n`;
    text += `--------------------------------\n`;
    text += `👤 آڑھتی: ${settings.arhtiNameUrdu}\n`;
    text += `📞 رابطہ: ${settings.shopPhone}`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shadow-inner">
              <Wallet className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg font-urdu-nastaliq">
                {isUrdu ? 'گلہ کیش ریکارڈ و حساب (Cash in Drawer)' : 'Cash in Drawer Record'}
              </h3>
              <p className="text-xs text-emerald-200 font-urdu-sans mt-0.5">
                {isUrdu ? 'دکان کیش دراز کا مکمل آمد و اخراج حساب' : 'Shop till and cash ledger'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWA}
              title="واٹس ایپ پر شیئر کریں"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                sound.playTick();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Big Balance Banner */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
          <div>
            <span className="text-xs text-slate-400 font-bold font-urdu-sans block">
              {isUrdu ? 'کل موجودہ کیش دراز (Current Cash in Drawer):' : 'Current Cash in Drawer:'}
            </span>
            <span
              className={`text-2xl sm:text-3xl font-black font-numbers block mt-1 ${
                overallSummary.netCashInDrawer >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatPKR(overallSummary.netCashInDrawer, settings.currencySymbol, settings.language)}
            </span>
            <span className="text-[11px] text-slate-400 font-urdu-sans mt-0.5 block">
              {isUrdu
                ? `آمد: ${formatPKR(overallSummary.totalCashIn, settings.currencySymbol, settings.language)} | اخراج: ${formatPKR(overallSummary.totalCashOut, settings.currencySymbol, settings.language)}`
                : `In: ${formatPKR(overallSummary.totalCashIn, settings.currencySymbol, settings.language)} | Out: ${formatPKR(overallSummary.totalCashOut, settings.currencySymbol, settings.language)}`}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-urdu-sans">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {isUrdu ? 'مکمل آمد و خرچ تفصیل' : 'Overview & Breakdown'}
          </button>
          <button
            onClick={() => setActiveTab('add_entry')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition ${
              activeTab === 'add_entry'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {isUrdu ? 'دستی کیش جمع / نکاسی' : 'Manual Add / Deduct'}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {isUrdu ? `دستی اندراجات ہسٹری (${drawerAdjustments.length})` : `Manual Ledger (${drawerAdjustments.length})`}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* TAB 1: OVERVIEW & BREAKDOWN */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Formula explanation box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-3">
                <Calculator className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 font-urdu-sans space-y-1">
                  <p className="font-bold">
                    {isUrdu ? 'گلہ کیش کا باضابطہ حسابی فارمولا:' : 'Cash Drawer Expression:'}
                  </p>
                  <p className="text-emerald-900 font-numbers">
                    <strong>[نقد فروخت وصولی + کھاتہ نقد وصولی + دستی جمع]</strong> - <strong>[نقد دکان اخراجات + زمینداروں کو نقد ادائیگی + دستی نکاسی]</strong>
                  </p>
                </div>
              </div>

              {/* Inflow vs Outflow Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Cash Inflow */}
                <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                    <span className="text-xs font-bold text-emerald-900 font-urdu-sans flex items-center gap-1.5">
                      <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                      <span>{isUrdu ? 'کل نقد آمد (Cash Inflow)' : 'Total Cash In'}</span>
                    </span>
                    <span className="text-sm font-black text-emerald-800 font-numbers">
                      {formatPKR(overallSummary.totalCashIn, settings.currencySymbol, settings.language)}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-urdu-sans">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{isUrdu ? '1. نقد فروخت سے وصولی:' : 'Sales Cash:'}</span>
                      <strong className="text-slate-900 font-numbers">
                        {formatPKR(overallSummary.salesCashCollected, settings.currencySymbol, settings.language)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{isUrdu ? '2. خریداروں کے کھاتہ سے نقد وصولی:' : 'Buyer Khata Cash:'}</span>
                      <strong className="text-slate-900 font-numbers">
                        {formatPKR(overallSummary.buyerKhataCashCollected, settings.currencySymbol, settings.language)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{isUrdu ? '3. دستی گلہ میں کیش جمع:' : 'Manual Cash In:'}</span>
                      <strong className="text-slate-900 font-numbers">
                        {formatPKR(overallSummary.manualCashIn, settings.currencySymbol, settings.language)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. Cash Outflow */}
                <div className="bg-white border-2 border-rose-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                    <span className="text-xs font-bold text-rose-900 font-urdu-sans flex items-center gap-1.5">
                      <ArrowUpRight className="w-4 h-4 text-rose-600" />
                      <span>{isUrdu ? 'کل نقد اخراج (Cash Outflow)' : 'Total Cash Out'}</span>
                    </span>
                    <span className="text-sm font-black text-rose-800 font-numbers">
                      {formatPKR(overallSummary.totalCashOut, settings.currencySymbol, settings.language)}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-urdu-sans">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{isUrdu ? '1. دکان کے نقد اخراجات:' : 'Shop Cash Expenses:'}</span>
                      <strong className="text-slate-900 font-numbers">
                        {formatPKR(overallSummary.shopCashExpenses, settings.currencySymbol, settings.language)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{isUrdu ? '2. زمینداروں کو نقد ادائیگی:' : 'Paid to Vendors:'}</span>
                      <strong className="text-slate-900 font-numbers">
                        {formatPKR(overallSummary.vendorCashPaid, settings.currencySymbol, settings.language)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>{isUrdu ? '3. دستی گلہ سے کیش نکاسی:' : 'Manual Cash Out:'}</span>
                      <strong className="text-slate-900 font-numbers">
                        {formatPKR(overallSummary.manualCashOut, settings.currencySymbol, settings.language)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's Live Snapshot */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 font-urdu-sans flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>{isUrdu ? 'صرف آج کا کیش فلو (Today):' : "Today's Cash Flow:"}</span>
                  </span>
                  <span
                    className={`text-xs font-black font-numbers px-2 py-0.5 rounded-md ${
                      todaySummary.netCashInDrawer >= 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isUrdu ? 'آج کا خالص: ' : 'Net Today: '}
                    {formatPKR(todaySummary.netCashInDrawer, settings.currencySymbol, settings.language)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-urdu-sans pt-1">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">{isUrdu ? 'آج وصولی:' : 'Collected:'}</span>
                    <strong className="text-emerald-700 font-numbers">
                      {formatPKR(todaySummary.salesCashCollected + todaySummary.buyerKhataCashCollected, settings.currencySymbol, settings.language)}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">{isUrdu ? 'آج دکان خرچ:' : 'Expenses:'}</span>
                    <strong className="text-rose-700 font-numbers">
                      {formatPKR(todaySummary.shopCashExpenses, settings.currencySymbol, settings.language)}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">{isUrdu ? 'آج زمیندار ادائیگی:' : 'Paid Vendors:'}</span>
                    <strong className="text-indigo-700 font-numbers">
                      {formatPKR(todaySummary.vendorCashPaid, settings.currencySymbol, settings.language)}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">{isUrdu ? 'آج دستی جمع/نکاسی:' : 'Manual Adj:'}</span>
                    <strong className="text-purple-700 font-numbers">
                      {formatPKR(todaySummary.manualCashIn - todaySummary.manualCashOut, settings.currencySymbol, settings.language)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL ADD / DEDUCT CASH FORM */}
          {activeTab === 'add_entry' && (
            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setAdjType('in')}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition flex items-center justify-center gap-2 ${
                    adjType === 'in'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{isUrdu ? '+ گلہ میں کیش جمع کریں' : '+ Add Cash to Drawer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType('out')}
                  className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition flex items-center justify-center gap-2 ${
                    adjType === 'out'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  <span>{isUrdu ? '- گلہ سے کیش نکالیں' : '- Deduct Cash from Drawer'}</span>
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-800 font-urdu-sans mb-1">
                  {isUrdu ? 'رقم (روپے):' : 'Amount (PKR):'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    placeholder="مثلاً 5000"
                    required
                    autoFocus
                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-300 focus:border-emerald-500 rounded-xl text-base font-bold font-numbers text-slate-900 focus:outline-hidden focus:bg-white shadow-2xs"
                  />
                  <span className="absolute right-3 rtl:left-3 rtl:right-auto top-3 text-xs font-bold text-slate-400 font-urdu-sans">
                    {settings.currencySymbol}
                  </span>
                </div>
              </div>

              {/* Reason / Title Input with Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-800 font-urdu-sans mb-1">
                  {isUrdu ? 'وجہ / تفصیل:' : 'Reason / Title:'}
                </label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder={
                    adjType === 'in'
                      ? 'مثلاً صبح کا اوپننگ بیلنس یا بینک سے کیش'
                      : 'مثلاً بینک میں جمع کروایا یا مالک نے لیا'
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-emerald-500 rounded-xl text-xs font-urdu-sans focus:outline-hidden focus:bg-white shadow-2xs"
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  <span className="text-[11px] text-slate-500 font-urdu-sans">{isUrdu ? 'فوری انتخاب:' : 'Quick:'}</span>
                  {quickReasonPresets[adjType].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjReason(preset)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-urdu-sans transition border border-slate-200"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 font-urdu-sans mb-1">
                    {isUrdu ? 'تاریخ:' : 'Date:'}
                  </label>
                  <input
                    type="date"
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-numbers focus:bg-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 font-urdu-sans mb-1">
                    {isUrdu ? 'اضافی نوٹ (اختیاری):' : 'Notes (Optional):'}
                  </label>
                  <input
                    type="text"
                    value={adjNotes}
                    onChange={(e) => setAdjNotes(e.target.value)}
                    placeholder="کوئی حوالہ یا رسید وغیرہ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold font-urdu-sans transition shadow-2xs"
                >
                  {isUrdu ? 'منسوخ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!adjAmount || parseNumber(adjAmount) <= 0}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold font-urdu-sans shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50 ${
                    adjType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {adjType === 'in'
                      ? isUrdu
                        ? 'گلہ میں رقم جمع محفوظ کریں'
                        : 'Record Cash In'
                      : isUrdu
                      ? 'گلہ سے رقم نکاسی محفوظ کریں'
                      : 'Record Cash Out'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: MANUAL ADJUSTMENTS HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 font-urdu-sans">
                  {isUrdu ? 'دستی کیش جمع و نکاسی کے تمام ریکارڈز:' : 'Manual Adjustments Ledger:'}
                </span>
                <span className="text-[11px] text-slate-500 font-urdu-sans">
                  {drawerAdjustments.length} {isUrdu ? 'اندراجات' : 'entries'}
                </span>
              </div>

              {drawerAdjustments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-urdu-sans text-xs bg-slate-50 rounded-2xl border border-slate-200">
                  {isUrdu ? 'ابھی تک کوئی دستی گلہ اندراج نہیں کیا گیا۔' : 'No manual drawer adjustments recorded yet.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs max-h-80 overflow-y-auto">
                  {drawerAdjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="p-3 hover:bg-slate-50 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
                            adj.type === 'in'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {adj.type === 'in' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 font-urdu-sans truncate block">
                            {adj.reason}
                          </span>
                          <span className="text-[10px] text-slate-400 font-numbers">
                            {adj.date} {adj.notes && `• ${adj.notes}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className={`font-black font-numbers text-xs sm:text-sm ${
                            adj.type === 'in' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {adj.type === 'in' ? '+' : '-'}
                          {formatPKR(adj.amount, settings.currencySymbol, settings.language)}
                        </span>

                        <button
                          onClick={() => {
                            if (window.confirm(isUrdu ? 'کیا آپ اس اندراج کو حذف کرنا چاہتے ہیں؟' : 'Delete this entry?')) {
                              sound.playTick();
                              onDeleteAdjustment(adj.id);
                            }
                          }}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                          title="حذف کریں"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-urdu-sans">
          <span className="text-slate-500 text-[11px]">
            {isUrdu ? 'تمام حساب کتاب خودکار گلہ کیش میں اپڈیٹ رہتا ہے' : 'All drawer figures update in real-time'}
          </span>
          <button
            onClick={() => {
              sound.playTick();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-xl font-bold shadow-xs hover:bg-slate-800 transition active:scale-95"
          >
            {isUrdu ? 'بند کریں' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
