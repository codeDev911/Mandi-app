import React, { useState, useEffect, useMemo } from 'react';
import { VendorLot, AppSettings, LotExpenses, CustomExpense } from '../types';
import { translations, unitLabels, getUnitDisplayLabel } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { calculateLotSummary, getUnitMazdooriRate, getMazdooriItems } from '../utils/calculations';
import { printThermalPOSReceipt } from '../utils/receiptGenerator';
import { printSingleLotReceiptA4 } from '../utils/printHelper';
import { UniversalShareModal, UniversalShareItem } from './UniversalShareModal';
import {
  Receipt,
  Printer,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  RotateCcw,
  FileText,
  DollarSign,
  Truck,
  User,
  Percent,
  Save,
  Sparkles,
  Calculator,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';

interface LotExpenseSlipViewProps {
  lot: VendorLot;
  lots: VendorLot[];
  onSelectLot: (lotId: string) => void;
  onUpdateLotExpenses: (lotId: string, updatedExpenses: LotExpenses) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onOpenReceipt?: (lotId: string) => void;
  onBackToBolli?: () => void;
  settings: AppSettings;
}

export const LotExpenseSlipView: React.FC<LotExpenseSlipViewProps> = ({
  lot,
  lots,
  onSelectLot,
  onUpdateLotExpenses,
  onToggleVendorPaymentStatus,
  onOpenReceipt,
  onBackToBolli,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';
  const unitLabel = getUnitDisplayLabel(lot.unitType, settings.language);

  // Local state for editable lot expenses
  const [expenses, setExpenses] = useState<LotExpenses>(() => JSON.parse(JSON.stringify(lot.expenses)));
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [shareModalItem, setShareModalItem] = useState<UniversalShareItem | null>(null);

  // New custom expense row inputs
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomAmount, setNewCustomAmount] = useState<number | ''>('');

  // Sync state whenever lot changes
  useEffect(() => {
    setExpenses(JSON.parse(JSON.stringify(lot.expenses)));
    setHasChanges(false);
  }, [lot.id, lot.expenses]);

  // Find previous and next lots
  const currentIndex = lots.findIndex((l) => l.id === lot.id);
  const prevLot = currentIndex > 0 ? lots[currentIndex - 1] : null;
  const nextLot = currentIndex < lots.length - 1 ? lots[currentIndex + 1] : null;

  // Live calculated summary based on current expenses in form
  const liveSummary = useMemo(() => {
    return calculateLotSummary(lot.totalQuantity, lot.sales, expenses);
  }, [lot.totalQuantity, lot.sales, expenses]);

  const isPaid = lot.vendorPaymentStatus === 'paid';

  // Handler to update specific field in expenses
  const updateExpenseField = <K extends keyof LotExpenses>(
    field: K,
    updater: (prev: LotExpenses[K]) => LotExpenses[K]
  ) => {
    setExpenses((prev) => {
      const updated = {
        ...prev,
        [field]: updater(prev[field]),
      };
      return updated;
    });
    setHasChanges(true);
  };

  // Add custom deduction
  const handleAddCustomExpense = () => {
    if (!newCustomName.trim() || !newCustomAmount || Number(newCustomAmount) <= 0) {
      sound.playPop();
      return;
    }
    sound.playCashChime();
    const newExp: CustomExpense = {
      id: 'custom-' + Date.now(),
      nameUrdu: newCustomName.trim(),
      nameEn: newCustomName.trim(),
      amount: Number(newCustomAmount),
    };

    setExpenses((prev) => ({
      ...prev,
      customExpenses: [...(prev.customExpenses || []), newExp],
    }));
    setNewCustomName('');
    setNewCustomAmount('');
    setHasChanges(true);
  };

  // Delete custom deduction
  const handleDeleteCustomExpense = (customId: string) => {
    sound.playPop();
    setExpenses((prev) => ({
      ...prev,
      customExpenses: (prev.customExpenses || []).filter((e) => e.id !== customId),
    }));
    setHasChanges(true);
  };

  // Save changes to lot
  const handleSaveChanges = () => {
    sound.playCashChime();
    onUpdateLotExpenses(lot.id, expenses);
    setHasChanges(false);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  // Reset to shop defaults
  const handleResetToDefaults = () => {
    sound.playPop();
    const defaultMazdooriRate = getUnitMazdooriRate(lot.unitType, settings);
    const defaultCommissionRate = settings.defaultCommissionPercent || 6;
    const defaultMunshiana = settings.defaultMunshiana || 30;
    const defaultMarketFee = settings.defaultMarketFeePerUnit || 0;

    const computedGrossSales = lot.sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const computedMazdoori = (Number(lot.summary.totalSoldQuantity) || Number(lot.totalQuantity) || 0) * defaultMazdooriRate;
    const computedCommission = Math.round((computedGrossSales * defaultCommissionRate) / 100);

    const defaultLotExpenses: LotExpenses = {
      commission: {
        type: 'percentage',
        rate: defaultCommissionRate,
        amount: computedCommission,
        enabled: true,
      },
      kiraya: {
        amount: 0,
        enabled: false,
      },
      mazdoori: {
        ratePerUnit: defaultMazdooriRate,
        amount: computedMazdoori,
        enabled: true,
      },
      munshiana: {
        amount: defaultMunshiana,
        enabled: true,
      },
      naqdAdvance: {
        amount: 0,
        enabled: false,
      },
      marketFee: {
        ratePerUnit: defaultMarketFee,
        amount: defaultMarketFee * (Number(lot.totalQuantity) || 0),
        enabled: defaultMarketFee > 0,
      },
      customExpenses: [],
    };

    setExpenses(defaultLotExpenses);
    setHasChanges(true);
  };

  // Format Text for WhatsApp Sharing
  const getShareText = () => {
    let msg = `*📋 ${settings.shopNameUrdu || settings.shopNameEn}*\n`;
    if (settings.shopAddressUrdu) msg += `📍 ${settings.shopAddressUrdu}\n`;
    msg += `--------------------------------\n`;
    msg += `*🧾 اخراجات پرچی و میزان حساب*\n`;
    msg += `🔖 لاٹ نمبر: *${lot.lotNumber}*\n`;
    msg += `👤 زمیندار: *${lot.vendorName}*\n`;
    msg += `📦 جنس: *${lot.productUrdu}* (${lot.totalQuantity} ${unitLabel})\n`;
    msg += `📅 تاریخ آمد: ${lot.arrivalDate}\n`;
    msg += `--------------------------------\n`;
    msg += `💰 *کل مال فروخت:* ${formatPKR(liveSummary.grossSales, settings.currencySymbol, settings.language)} (${liveSummary.totalSoldQuantity} ${unitLabel})\n`;
    msg += `--------------------------------\n`;
    msg += `*✂️ کٹوتیاں و اخراجات:*\n`;

    if (expenses.commission.enabled) {
      msg += `• کمیشن (${expenses.commission.type === 'percentage' ? `${expenses.commission.rate}%` : 'فکسڈ'}): ${formatPKR(expenses.commission.amount, settings.currencySymbol, settings.language)}\n`;
    }
    if (expenses.mazdoori.enabled) {
      msg += `• مزدوری (${expenses.mazdoori.ratePerUnit || 0} روپے فی ${unitLabel}): ${formatPKR(expenses.mazdoori.amount, settings.currencySymbol, settings.language)}\n`;
    }
    if (expenses.kiraya.enabled && expenses.kiraya.amount > 0) {
      msg += `• کرایہ گاڑی: ${formatPKR(expenses.kiraya.amount, settings.currencySymbol, settings.language)}\n`;
    }
    if (expenses.munshiana.enabled && expenses.munshiana.amount > 0) {
      msg += `• منشیانہ: ${formatPKR(expenses.munshiana.amount, settings.currencySymbol, settings.language)}\n`;
    }
    if (expenses.marketFee.enabled && expenses.marketFee.amount > 0) {
      msg += `• مارکیٹ فیس: ${formatPKR(expenses.marketFee.amount, settings.currencySymbol, settings.language)}\n`;
    }
    if (expenses.naqdAdvance.enabled && expenses.naqdAdvance.amount > 0) {
      msg += `• نقد / پیشگی کٹوتی: ${formatPKR(expenses.naqdAdvance.amount, settings.currencySymbol, settings.language)}\n`;
    }
    if (expenses.customExpenses && expenses.customExpenses.length > 0) {
      expenses.customExpenses.forEach((ce) => {
        msg += `• ${ce.nameUrdu}: ${formatPKR(ce.amount, settings.currencySymbol, settings.language)}\n`;
      });
    }

    msg += `--------------------------------\n`;
    msg += `🔻 *کل منہا اخراجات:* ${formatPKR(liveSummary.totalExpenses, settings.currencySymbol, settings.language)}\n`;
    msg += `💎 *صافی میزان برائے زمیندار:* ${formatPKR(liveSummary.netPayableToVendor, settings.currencySymbol, settings.language)}\n`;
    msg += `💵 *ادائیگی کی کیفیت:* ${isPaid ? 'ادا شدہ (Paid) ✅' : 'ادائیگی بقایا (Pending) ⏳'}\n`;
    msg += `--------------------------------\n`;
    msg += `آڑھتی: ${settings.arhtiNameUrdu || 'کمیشن شاپ'} | رابطہ: ${settings.shopPhone || ''}`;

    return msg;
  };

  const handleCopyText = async () => {
    sound.playTick();
    const text = getShareText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleOpenShareModal = () => {
    sound.playTick();
    setShareModalItem({
      title: `${isUrdu ? 'اخراجات پرچی' : 'Expense Slip'} - ${lot.vendorName} (${lot.lotNumber})`,
      lotNumber: lot.lotNumber,
      date: lot.arrivalDate,
      category: isUrdu ? 'اخراجات پرچی و میزان' : 'Expense Slip & Meezan',
      text: getShareText(),
    });
  };

  return (
    <div className="space-y-4 pb-24 font-urdu-sans max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Top Header Bar & Quick Navigation */}
      <div className="bg-slate-900 text-white p-3 sm:p-4 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left Side: Back & Lot Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {onBackToBolli && (
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                onBackToBolli();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-urdu-sans flex items-center gap-1.5 border border-slate-700 transition active:scale-95 shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{isUrdu ? 'واپس بولی روم' : 'Back to Bolli'}</span>
            </button>
          )}

          {/* Previous / Next Lot Arrow Controls */}
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5">
            <button
              type="button"
              disabled={!prevLot}
              onClick={() => prevLot && onSelectLot(prevLot.id)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 transition"
              title={prevLot ? `پچھلی لاٹ: ${prevLot.vendorName}` : ''}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
            <select
              value={lot.id}
              onChange={(e) => {
                sound.playTick();
                onSelectLot(e.target.value);
              }}
              className="bg-transparent text-slate-100 text-xs px-2 py-1 border-none font-urdu-sans focus:outline-hidden font-bold max-w-[200px] truncate"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900 text-white">
                  {l.vendorName} - {l.productUrdu} ({l.arrivalDate})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!nextLot}
              onClick={() => nextLot && onSelectLot(nextLot.id)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white disabled:opacity-30 transition"
              title={nextLot ? `اگلی لاٹ: ${nextLot.vendorName}` : ''}
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>

          {/* 1-Click Payment Status Switcher */}
          {onToggleVendorPaymentStatus && (
            <button
              type="button"
              onClick={() => onToggleVendorPaymentStatus(lot.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-xs border ${
                isPaid
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                  : 'bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900'
              }`}
            >
              {isPaid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isPaid ? (isUrdu ? 'ادا شدہ ✅' : 'Paid ✅') : (isUrdu ? 'بقایا ⏳' : 'Pending ⏳')}</span>
            </button>
          )}
        </div>

        {/* Right Side: Receipt, Print, Share, Save */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {onOpenReceipt && (
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                onOpenReceipt(lot.id);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-urdu-sans flex items-center gap-1.5 border border-slate-700 transition active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>{isUrdu ? 'پرچی پرنٹ' : 'Receipt'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sound.playTick();
              printThermalPOSReceipt(lot, settings);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black font-urdu-sans flex items-center gap-1.5 transition shadow-xs"
            title="80mm تھرمل پرنٹر پر فوری پرچی پرنٹ کریں"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isUrdu ? 'POS پرنٹ' : 'POS Print'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-urdu-sans flex items-center gap-1 transition active:scale-95 border border-slate-700"
            title="تفصیل کاپی کریں"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isCopied ? (isUrdu ? 'کاپی شدہ!' : 'Copied!') : (isUrdu ? 'کاپی' : 'Copy')}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenShareModal}
            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs font-urdu-sans flex items-center gap-1.5 shadow-xs transition active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isUrdu ? 'شیئر' : 'Share'}</span>
          </button>

          {hasChanges && (
            <button
              type="button"
              onClick={handleSaveChanges}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs font-urdu-sans flex items-center gap-1.5 shadow-md transition active:scale-95 animate-pulse"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'تبدیلیاں محفوظ کریں' : 'Save Changes'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Save Toast Notification */}
      {showSaveToast && (
        <div className="bg-emerald-950 border border-emerald-600/40 text-emerald-200 px-4 py-2.5 rounded-xl text-xs font-bold font-urdu-sans flex items-center gap-2 animate-in fade-in shadow-md">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{isUrdu ? 'لاٹ کے اخراجات اور میزان کامیابی سے محفوظ ہو گئے ہیں!' : 'Lot expenses and settlement successfully saved!'}</span>
        </div>
      )}

      {/* Lot Overview & Sales Banner */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-numbers px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                {lot.lotNumber}
              </span>
              <h2 className="text-base sm:text-lg font-black text-stone-900 font-urdu-sans">
                {lot.vendorName} ({lot.productUrdu})
              </h2>
            </div>
            <p className="text-xs text-stone-500 font-urdu-sans mt-0.5">
              آمد: {lot.arrivalDate} • جنس: {lot.productUrdu} • کل تعداد: <strong className="text-stone-800 font-numbers">{lot.totalQuantity} {unitLabel}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-xl font-bold font-urdu-sans ${
                lot.status === 'completed'
                  ? 'bg-stone-100 text-stone-700'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {lot.status === 'completed' ? (isUrdu ? 'مکمل فروخت شدہ' : 'Completed') : (isUrdu ? 'بولی جاری' : 'Active')}
            </span>
          </div>
        </div>

        {/* 4 Key Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 font-numbers">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[11px] text-stone-500 font-urdu-sans block">فروخت شدہ مال</span>
            <span className="text-base font-black text-stone-900">
              {liveSummary.totalSoldQuantity} / {lot.totalQuantity} <span className="text-xs font-normal font-urdu-sans">{unitLabel}</span>
            </span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[11px] text-emerald-700 font-urdu-sans block">مجموعی فروخت (Gross)</span>
            <span className="text-base font-black text-emerald-950">
              {formatPKR(liveSummary.grossSales, settings.currencySymbol, settings.language)}
            </span>
          </div>

          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <span className="text-[11px] text-rose-700 font-urdu-sans block">کل منہا کٹوتیاں</span>
            <span className="text-base font-black text-rose-950">
              - {formatPKR(liveSummary.totalExpenses, settings.currencySymbol, settings.language)}
            </span>
          </div>

          <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-800">
            <span className="text-[11px] text-amber-300 font-urdu-sans block">صافی میزان زمیندار</span>
            <span className="text-base font-black text-white">
              {formatPKR(liveSummary.netPayableToVendor, settings.currencySymbol, settings.language)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Expense Slip Form: Itemized Deductions (کٹوتیاں) */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-bold text-sm sm:text-base text-stone-900 font-urdu-sans">
                {t.expenseSlipTitle || 'اخراجات پرچی و میزان کٹوتی'}
              </h3>
              <p className="text-xs text-stone-500 font-urdu-sans">
                {t.expenseSlipSubtitle || 'زمیندار کے اخراجات کی کٹوتی اور منافع کا حساب'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-2.5 py-1 rounded-lg text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 flex items-center gap-1 font-urdu-sans transition border border-stone-200"
            title="دوبارہ دکان کی ڈیفالٹ شرح پر لائیں"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetDefault || 'ڈیفالٹ پر لائیں'}</span>
          </button>
        </div>

        {/* Deduction Items Grid */}
        <div className="space-y-3">
          {/* 1. Commission (کمیشن) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            expenses.commission.enabled ? 'bg-amber-50/50 border-amber-200' : 'bg-stone-50/70 border-stone-200 opacity-70'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-commission"
                  checked={expenses.commission.enabled}
                  onChange={(e) =>
                    updateExpenseField('commission', (prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                />
                <label htmlFor="chk-commission" className="text-xs sm:text-sm font-bold text-stone-900 font-urdu-sans cursor-pointer flex items-center gap-1.5">
                  <span>{t.commission} (آڑھت کمیشن)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 font-numbers font-normal">
                    منافع
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Type Switcher: % vs Fixed */}
                <div className="flex items-center bg-white border border-stone-300 rounded-lg p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    disabled={!expenses.commission.enabled}
                    onClick={() =>
                      updateExpenseField('commission', (prev) => ({
                        ...prev,
                        type: 'percentage',
                      }))
                    }
                    className={`px-2 py-0.5 rounded-md transition ${
                      expenses.commission.type === 'percentage'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    فیصد %
                  </button>
                  <button
                    type="button"
                    disabled={!expenses.commission.enabled}
                    onClick={() =>
                      updateExpenseField('commission', (prev) => ({
                        ...prev,
                        type: 'fixed',
                      }))
                    }
                    className={`px-2 py-0.5 rounded-md transition ${
                      expenses.commission.type === 'fixed'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    فکسڈ رقم
                  </button>
                </div>

                {expenses.commission.type === 'percentage' ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      disabled={!expenses.commission.enabled}
                      value={expenses.commission.rate || ''}
                      onChange={(e) => {
                        const rate = parseNumber(e.target.value);
                        updateExpenseField('commission', (prev) => {
                          const computed = (liveSummary.grossSales * rate) / 100;
                          return {
                            ...prev,
                            rate,
                            amount: Math.round(computed),
                          };
                        });
                      }}
                      className="w-16 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-center focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-stone-500 font-bold">%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      disabled={!expenses.commission.enabled}
                      value={expenses.commission.amount || ''}
                      onChange={(e) => {
                        const amt = parseNumber(e.target.value);
                        updateExpenseField('commission', (prev) => ({
                          ...prev,
                          amount: amt,
                        }));
                      }}
                      className="w-24 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-end focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div className="text-end min-w-[90px] font-numbers font-black text-amber-900 text-xs sm:text-sm">
                  {formatPKR(expenses.commission.amount, settings.currencySymbol, settings.language)}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Mazdoori (مزدوری اترائی و چنائی) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            expenses.mazdoori.enabled ? 'bg-stone-50 border-stone-300' : 'bg-stone-50/70 border-stone-200 opacity-70'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-mazdoori"
                  checked={expenses.mazdoori.enabled}
                  onChange={(e) =>
                    updateExpenseField('mazdoori', (prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                />
                <label htmlFor="chk-mazdoori" className="text-xs sm:text-sm font-bold text-stone-900 font-urdu-sans cursor-pointer">
                  {t.mazdoori} (مزدوری و پلے داری)
                </label>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-stone-500 font-urdu-sans">شرح فی {unitLabel}:</span>
                <input
                  type="number"
                  min="0"
                  disabled={!expenses.mazdoori.enabled}
                  value={expenses.mazdoori.ratePerUnit || ''}
                  onChange={(e) => {
                    const rate = parseNumber(e.target.value);
                    const qty = liveSummary.totalSoldQuantity || lot.totalQuantity || 0;
                    updateExpenseField('mazdoori', (prev) => ({
                      ...prev,
                      ratePerUnit: rate,
                      amount: Math.round(rate * qty),
                    }));
                  }}
                  className="w-16 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-center focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-stone-400 font-urdu-sans">کل رقم:</span>
                <input
                  type="number"
                  min="0"
                  disabled={!expenses.mazdoori.enabled}
                  value={expenses.mazdoori.amount || ''}
                  onChange={(e) => {
                    const amt = parseNumber(e.target.value);
                    updateExpenseField('mazdoori', (prev) => ({
                      ...prev,
                      amount: amt,
                    }));
                  }}
                  className="w-24 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-end focus:ring-2 focus:ring-emerald-500"
                />
                <div className="text-end min-w-[90px] font-numbers font-black text-stone-900 text-xs sm:text-sm">
                  {formatPKR(expenses.mazdoori.amount, settings.currencySymbol, settings.language)}
                </div>
              </div>
            </div>

            {expenses.mazdoori.enabled && (
              <div className="mt-2 pt-2 border-t border-stone-200/60 flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="text-[10px] text-stone-500 font-urdu-sans flex-shrink-0">
                  {isUrdu ? 'تیز رفتار ریٹ انتخاب:' : 'Quick Pick:'}
                </span>
                <div className="flex gap-1 flex-wrap">
                  {getMazdooriItems(settings).map((it) => {
                    const isSelected = expenses.mazdoori.ratePerUnit === it.rate;
                    return (
                      <button
                        type="button"
                        key={it.id}
                        onClick={() => {
                          sound.playTick();
                          const qty = liveSummary.totalSoldQuantity || lot.totalQuantity || 0;
                          updateExpenseField('mazdoori', (prev) => ({
                            ...prev,
                            ratePerUnit: it.rate,
                            title: it.title,
                            amount: Math.round(it.rate * qty),
                          }));
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-urdu-sans transition ${
                          isSelected
                            ? 'bg-emerald-700 text-white font-bold shadow-2xs'
                            : 'bg-white border border-stone-300 text-stone-700 hover:bg-emerald-50'
                        }`}
                      >
                        <span>{it.title.split(' ')[0]}</span>
                        <span className="font-numbers ml-1">₨{it.rate}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Kiraya / Carriage Freight (کرایہ گاڑی) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            expenses.kiraya.enabled ? 'bg-stone-50 border-stone-300' : 'bg-stone-50/70 border-stone-200 opacity-70'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-kiraya"
                  checked={expenses.kiraya.enabled}
                  onChange={(e) =>
                    updateExpenseField('kiraya', (prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                />
                <label htmlFor="chk-kiraya" className="text-xs sm:text-sm font-bold text-stone-900 font-urdu-sans cursor-pointer flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-stone-500" />
                  <span>{t.kiraya} (کرایہ گاڑی / ٹرانسپورٹ)</span>
                </label>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="گاڑی نمبر / ڈرائیور"
                  disabled={!expenses.kiraya.enabled}
                  value={expenses.kiraya.note || ''}
                  onChange={(e) => {
                    const note = e.target.value;
                    updateExpenseField('kiraya', (prev) => ({
                      ...prev,
                      note,
                    }));
                  }}
                  className="w-32 sm:w-40 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="رقم"
                  disabled={!expenses.kiraya.enabled}
                  value={expenses.kiraya.amount || ''}
                  onChange={(e) => {
                    const amt = parseNumber(e.target.value);
                    updateExpenseField('kiraya', (prev) => ({
                      ...prev,
                      amount: amt,
                    }));
                  }}
                  className="w-24 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-end focus:ring-2 focus:ring-emerald-500"
                />
                <div className="text-end min-w-[90px] font-numbers font-black text-stone-900 text-xs sm:text-sm">
                  {formatPKR(expenses.kiraya.amount, settings.currencySymbol, settings.language)}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Munshiana (منشیانہ) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            expenses.munshiana.enabled ? 'bg-stone-50 border-stone-300' : 'bg-stone-50/70 border-stone-200 opacity-70'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-munshiana"
                  checked={expenses.munshiana.enabled}
                  onChange={(e) =>
                    updateExpenseField('munshiana', (prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                />
                <label htmlFor="chk-munshiana" className="text-xs sm:text-sm font-bold text-stone-900 font-urdu-sans cursor-pointer">
                  {t.munshiana} (منشیانہ پرچی فیس)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  disabled={!expenses.munshiana.enabled}
                  value={expenses.munshiana.amount || ''}
                  onChange={(e) => {
                    const amt = parseNumber(e.target.value);
                    updateExpenseField('munshiana', (prev) => ({
                      ...prev,
                      amount: amt,
                    }));
                  }}
                  className="w-24 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-end focus:ring-2 focus:ring-emerald-500"
                />
                <div className="text-end min-w-[90px] font-numbers font-black text-stone-900 text-xs sm:text-sm">
                  {formatPKR(expenses.munshiana.amount, settings.currencySymbol, settings.language)}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Naqd / Advance (نقد پیشگی کٹوتی) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            expenses.naqdAdvance.enabled ? 'bg-stone-50 border-stone-300' : 'bg-stone-50/70 border-stone-200 opacity-70'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-naqdAdvance"
                  checked={expenses.naqdAdvance.enabled}
                  onChange={(e) =>
                    updateExpenseField('naqdAdvance', (prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                />
                <label htmlFor="chk-naqdAdvance" className="text-xs sm:text-sm font-bold text-stone-900 font-urdu-sans cursor-pointer">
                  {t.naqdAdvance} (زمیندار کو نقد پیشگی دی گئی رقم)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  disabled={!expenses.naqdAdvance.enabled}
                  value={expenses.naqdAdvance.amount || ''}
                  onChange={(e) => {
                    const amt = parseNumber(e.target.value);
                    updateExpenseField('naqdAdvance', (prev) => ({
                      ...prev,
                      amount: amt,
                    }));
                  }}
                  className="w-24 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-end focus:ring-2 focus:ring-emerald-500"
                />
                <div className="text-end min-w-[90px] font-numbers font-black text-stone-900 text-xs sm:text-sm">
                  {formatPKR(expenses.naqdAdvance.amount, settings.currencySymbol, settings.language)}
                </div>
              </div>
            </div>
          </div>

          {/* 6. Market Fee (مارکیٹ کمیٹی فیس) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            expenses.marketFee.enabled ? 'bg-stone-50 border-stone-300' : 'bg-stone-50/70 border-stone-200 opacity-70'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-marketFee"
                  checked={expenses.marketFee.enabled}
                  onChange={(e) =>
                    updateExpenseField('marketFee', (prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                />
                <label htmlFor="chk-marketFee" className="text-xs sm:text-sm font-bold text-stone-900 font-urdu-sans cursor-pointer">
                  {t.marketFee} (مارکیٹ کمیٹی کٹوتی)
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  disabled={!expenses.marketFee.enabled}
                  value={expenses.marketFee.amount || ''}
                  onChange={(e) => {
                    const amt = parseNumber(e.target.value);
                    updateExpenseField('marketFee', (prev) => ({
                      ...prev,
                      amount: amt,
                    }));
                  }}
                  className="w-24 px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-end focus:ring-2 focus:ring-emerald-500"
                />
                <div className="text-end min-w-[90px] font-numbers font-black text-stone-900 text-xs sm:text-sm">
                  {formatPKR(expenses.marketFee.amount, settings.currencySymbol, settings.language)}
                </div>
              </div>
            </div>
          </div>

          {/* 7. Custom Expenses List */}
          {expenses.customExpenses && expenses.customExpenses.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-600 font-urdu-sans block">
                اضافی کٹوتیاں:
              </span>
              {expenses.customExpenses.map((ce) => (
                <div
                  key={ce.id}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-800 font-urdu-sans">{ce.nameUrdu}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-numbers font-black text-stone-900 text-xs sm:text-sm">
                      {formatPKR(ce.amount, settings.currencySymbol, settings.language)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomExpense(ce.id)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                      title="ڈیلیٹ کریں"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Custom Expense Input */}
          <div className="p-3 bg-stone-50 rounded-xl border border-dashed border-stone-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder={isUrdu ? 'نئی کٹوتی کا نام (مثلاً بوری سلائی، کاٹ)' : 'Custom deduction title'}
                value={newCustomName}
                onChange={(e) => setNewCustomName(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder={isUrdu ? 'رقم' : 'Amount'}
                value={newCustomAmount}
                onChange={(e) => setNewCustomAmount(e.target.value ? Number(e.target.value) : '')}
                className="w-24 px-2 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-end focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddCustomExpense}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 active:scale-95 text-white rounded-lg text-xs font-bold font-urdu-sans flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'شامل کریں' : 'Add'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Save Banner */}
        <div className="pt-3 border-t border-stone-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-stone-500 font-urdu-sans">
            {hasChanges ? (
              <span className="text-amber-600 font-bold">⚠️ تبدیلیاں غیر محفوظ شدہ ہیں۔ نیچے بٹن دبائیں:</span>
            ) : (
              <span className="text-emerald-700 font-bold">✅ تمام کٹوتیاں محفوظ شدہ ہیں۔</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveChanges}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-black font-urdu-sans flex items-center gap-2 shadow-sm transition active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isUrdu ? 'محفوظ کریں و میزان نکالیں' : 'Save & Calculate Meezan'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* FINAL MEEZAN SETTLEMENT CARD (صافی میزان زمیندار) */}
      <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[11px] text-amber-400 font-urdu-sans block">میزان حساب کتاب</span>
            <h3 className="text-base sm:text-lg font-black font-urdu-nastaliq text-white">
              صافی میزان برائے زمیندار ({lot.vendorName})
            </h3>
          </div>

          <div className="text-end">
            <span className="text-xs text-slate-400 font-urdu-sans block">صافی واجب الادا رقم:</span>
            <span className="text-xl sm:text-2xl font-black font-numbers text-amber-300">
              {formatPKR(liveSummary.netPayableToVendor, settings.currencySymbol, settings.language)}
            </span>
          </div>
        </div>

        {/* Breakdown Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-numbers">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="font-urdu-sans text-slate-400">ٹوٹل مال فروخت:</span>
            <strong className="text-white font-black">
              {formatPKR(liveSummary.grossSales, settings.currencySymbol, settings.language)}
            </strong>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="font-urdu-sans text-rose-400">منہا کل اخراجات:</span>
            <strong className="text-rose-400 font-black">
              - {formatPKR(liveSummary.totalExpenses, settings.currencySymbol, settings.language)}
            </strong>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="font-urdu-sans text-amber-300">آڑھتی کا منافع (کمیشن):</span>
            <strong className="text-amber-300 font-black">
              {formatPKR(liveSummary.arhtiProfitCommission, settings.currencySymbol, settings.language)}
            </strong>
          </div>
        </div>

        {/* Vendor Payment Toggle Strip */}
        <div
          onClick={() => onToggleVendorPaymentStatus && onToggleVendorPaymentStatus(lot.id)}
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
            isPaid
              ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-200 hover:bg-emerald-950/80'
              : 'bg-amber-950/60 border-amber-600/50 text-amber-200 hover:bg-amber-950/80'
          }`}
          title="کلک کر کے کیفیت تبدیل کریں"
        >
          <div className="flex items-center gap-2.5">
            {isPaid ? (
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 stroke-[2.5]" />
              </div>
            )}
            <div>
              <span className="text-xs font-black font-urdu-sans block">
                {isPaid ? 'ادائیگی کی کیفیت: ادا شدہ (PAID IN FULL)' : 'ادائیگی کی کیفیت: ادائیگی بقایا (PENDING)'}
              </span>
              <span className="text-[11px] opacity-75 font-urdu-sans block">
                {isPaid
                  ? `زمیندار کو مکمل ادائیگی ہو چکی ہے ${lot.vendorPaymentDate ? `بتاریخ ${lot.vendorPaymentDate}` : ''}`
                  : 'زمیندار کو رقم کی ادائیگی ابھی باقی ہے (کلک کر کے ادا شدہ کریں)'}
              </span>
            </div>
          </div>

          <span className="text-xs px-3 py-1 rounded-lg bg-white/10 border border-white/20 font-bold font-urdu-sans">
            {isPaid ? 'ادا شدہ ✅' : 'بقایا ⏳'}
          </span>
        </div>
      </div>

      {/* Share Modal */}
      {shareModalItem && (
        <UniversalShareModal
          isOpen={true}
          onClose={() => setShareModalItem(null)}
          item={shareModalItem}
          settings={settings}
        />
      )}
    </div>
  );
};
