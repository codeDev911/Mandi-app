import React, { useState } from 'react';
import { VendorLot, AppSettings, CustomExpense } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { getUnitMazdooriRate } from '../utils/calculations';
import {
  Receipt,
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  Check,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface ExpenseSlipViewProps {
  lot: VendorLot;
  onUpdateLotExpenses: (lotId: string, updatedExpenses: VendorLot['expenses']) => void;
  onOpenReceipt: (lotId: string) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onBackToBolli?: () => void;
  settings: AppSettings;
}

export const ExpenseSlipView: React.FC<ExpenseSlipViewProps> = ({
  lot,
  onUpdateLotExpenses,
  onOpenReceipt,
  onToggleVendorPaymentStatus,
  onBackToBolli,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';
  const unitLabel = unitLabels[lot.unitType][settings.language];

  // Local state for editable fields
  const [expenses, setExpenses] = useState<VendorLot['expenses']>(lot.expenses);
  const [customNameUrdu, setCustomNameUrdu] = useState('');
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  // Sync state if lot changes
  React.useEffect(() => {
    setExpenses(lot.expenses);
  }, [lot.expenses]);

  const handleFieldChange = (updater: (prev: VendorLot['expenses']) => VendorLot['expenses']) => {
    const updated = updater({ ...expenses });
    setExpenses(updated);
    onUpdateLotExpenses(lot.id, updated);
  };

  const handleCommissionRateChange = (rate: number) => {
    handleFieldChange((prev) => {
      const computed = Math.round((lot.summary.grossSales * rate) / 100);
      return {
        ...prev,
        commission: {
          ...prev.commission,
          rate,
          amount: computed,
          type: 'percentage',
        },
      };
    });
  };

  const handleCommissionAmountManualChange = (amount: number) => {
    handleFieldChange((prev) => {
      return {
        ...prev,
        commission: {
          ...prev.commission,
          amount,
          type: 'fixed',
        },
      };
    });
  };

  const handleMazdooriManualChange = (amount: number) => {
    handleFieldChange((prev) => {
      return {
        ...prev,
        mazdoori: {
          ...prev.mazdoori,
          amount,
        },
      };
    });
  };

  const handleKirayaChange = (amount: number) => {
    handleFieldChange((prev) => ({
      ...prev,
      kiraya: {
        ...prev.kiraya,
        amount,
        enabled: amount > 0,
      },
    }));
  };

  const handleMunshianaChange = (amount: number) => {
    handleFieldChange((prev) => ({
      ...prev,
      munshiana: {
        ...prev.munshiana,
        amount,
        enabled: amount > 0,
      },
    }));
  };

  const handleNaqdAdvanceChange = (amount: number) => {
    handleFieldChange((prev) => ({
      ...prev,
      naqdAdvance: {
        ...prev.naqdAdvance,
        amount,
        enabled: amount > 0,
      },
    }));
  };

  const handleMarketFeeChange = (amount: number) => {
    handleFieldChange((prev) => ({
      ...prev,
      marketFee: {
        ...prev.marketFee,
        amount,
        enabled: amount > 0,
      },
    }));
  };

  const handleAddCustomExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNameUrdu.trim() || customAmount <= 0) return;

    sound.playTick();
    const newCustom: CustomExpense = {
      id: `ce-${Date.now()}`,
      nameUrdu: customNameUrdu.trim(),
      nameEn: customNameUrdu.trim(),
      amount: customAmount,
    };

    handleFieldChange((prev) => ({
      ...prev,
      customExpenses: [...(prev.customExpenses || []), newCustom],
    }));

    setCustomNameUrdu('');
    setCustomAmount(0);
    setIsAddingCustom(false);
  };

  const handleRemoveCustomExpense = (id: string) => {
    sound.playTick();
    handleFieldChange((prev) => ({
      ...prev,
      customExpenses: (prev.customExpenses || []).filter((item) => item.id !== id),
    }));
  };

  const handleResetToDefaults = () => {
    sound.playTick();
    const defaultComm = Math.round((lot.summary.grossSales * settings.defaultCommissionPercent) / 100);
    const unitMazRate = getUnitMazdooriRate(lot.unitType, settings);
    const defaultMaz = unitMazRate * lot.totalQuantity;
    const defaultMkt = settings.defaultMarketFeePerUnit * lot.totalQuantity;

    const resetExpenses: VendorLot['expenses'] = {
      commission: {
        type: 'percentage',
        rate: settings.defaultCommissionPercent,
        amount: defaultComm,
        enabled: true,
      },
      kiraya: {
        amount: 0,
        enabled: false,
      },
      mazdoori: {
        ratePerUnit: unitMazRate,
        amount: defaultMaz,
        enabled: true,
      },
      munshiana: {
        amount: settings.defaultMunshiana,
        enabled: true,
      },
      naqdAdvance: {
        amount: 0,
        enabled: false,
      },
      marketFee: {
        ratePerUnit: settings.defaultMarketFeePerUnit,
        amount: defaultMkt,
        enabled: true,
      },
      customExpenses: [],
    };

    setExpenses(resetExpenses);
    onUpdateLotExpenses(lot.id, resetExpenses);
  };

  return (
    <div className="space-y-4 pb-16 sm:pb-6">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 flex items-center justify-center text-2xl flex-shrink-0">
              {lot.productEmoji}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 font-urdu-nastaliq">
                {lot.vendorName} • {t.expenseSlipTitle}
              </h2>
              <p className="text-xs text-slate-500 font-urdu-sans">
                {lot.productUrdu} ({lot.totalQuantity} {unitLabel}) • {t.lotNumber}: <span className="font-mono">{lot.lotNumber}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onToggleVendorPaymentStatus && (
            <button
              onClick={() => {
                sound.playTick();
                onToggleVendorPaymentStatus(lot.id);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
                lot.vendorPaymentStatus === 'paid'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                  : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
              }`}
              title={
                lot.vendorPaymentStatus === 'paid'
                  ? 'ادائیگی ہو چکی ہے - کلک کر کے بقایا کریں'
                  : 'ادائیگی بقایا ہے - کلک کر کے ادا شدہ کریں'
              }
            >
              {lot.vendorPaymentStatus === 'paid' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-700" />
              )}
              <span>
                {lot.vendorPaymentStatus === 'paid'
                  ? (isUrdu ? 'ادا شدہ (Paid)' : 'Paid')
                  : (isUrdu ? 'ادائیگی بقایا (Pending)' : 'Pending')}
              </span>
            </button>
          )}

          {onBackToBolli && (
            <button
              onClick={onBackToBolli}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 font-urdu-sans border border-slate-300"
            >
              {isUrdu ? <ArrowRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowLeft className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{t.backToBolli}</span>
            </button>
          )}

          <button
            onClick={handleResetToDefaults}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 font-urdu-sans border border-slate-200"
            title={t.resetDefault}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetDefault}</span>
          </button>

          <button
            onClick={() => onOpenReceipt(lot.id)}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans shadow-xs active:scale-95 border border-slate-800"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>{t.tabReceipt}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Mandi Parchi Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT / CENTER: Mandi Receipt Slip */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Slip Header with Pakistani Mandi Theme */}
          <div className="bg-slate-50 border-b border-slate-200 p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-urdu-sans">
                {isUrdu ? 'آڑھت حساب کتاب و اخراجات پرچی' : 'Mandi Expense & Deductions Ledger'}
              </span>
              <h3 className="font-bold text-sm sm:text-base text-slate-800 font-urdu-nastaliq">
                {settings.shopNameUrdu}
              </h3>
            </div>
            <div className="text-end">
              <span className="text-[11px] text-slate-500 font-urdu-sans block">{t.date}: {lot.arrivalDate}</span>
              <span className="text-xs font-mono font-bold text-slate-700">{lot.lotNumber}</span>
            </div>
          </div>

          {/* 2-Column Table Structure */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:rtl:divide-x-reverse divide-slate-200">
            {/* COLUMN 1: اخراجات (Deductions & Expenses) */}
            <div className="p-3.5 sm:p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-extrabold text-sm text-slate-800 font-urdu-nastaliq flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>{t.expensesSection} (کٹوتیاں)</span>
                </h4>
                <span className="text-[11px] text-slate-500 font-urdu-sans">
                  {isUrdu ? 'دستی ترمیم ممکن ہے' : 'Manual adjustment enabled'}
                </span>
              </div>

              {/* 1. کمیشن (Commission) */}
              <div className="bg-white p-2.5 rounded-xl border border-blue-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-blue-900 font-urdu-nastaliq">
                      {t.commission}
                    </span>
                    <span className="text-[11px] text-slate-500 font-urdu-sans font-numbers">
                      ({expenses.commission.rate}% یا فکسڈ)
                    </span>
                  </div>
                  <label className="text-xs flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenses.commission.enabled}
                      onChange={(e) =>
                        handleFieldChange((prev) => ({
                          ...prev,
                          commission: { ...prev.commission, enabled: e.target.checked },
                        }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-500 font-urdu-sans block">{t.commission} %</label>
                    <input
                      type="number"
                      step="0.5"
                      value={expenses.commission.rate}
                      onChange={(e) => handleCommissionRateChange(parseNumber(e.target.value))}
                      disabled={!expenses.commission.enabled}
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-numbers text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-urdu-sans block">رقم (روپے)</label>
                    <input
                      type="number"
                      value={expenses.commission.amount}
                      onChange={(e) => handleCommissionAmountManualChange(parseNumber(e.target.value))}
                      disabled={!expenses.commission.enabled}
                      className="w-full px-2 py-1 bg-blue-50 border border-blue-300 rounded-lg text-xs font-bold text-blue-900 font-numbers text-center"
                    />
                  </div>
                </div>
              </div>

              {/* 2. کرایہ (Kiraya / Freight) */}
              <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-emerald-900 font-urdu-nastaliq">
                      {t.kiraya}
                    </span>
                    <span className="text-[11px] text-slate-500 font-urdu-sans">
                      {isUrdu ? '(گاڑی / شہزور کرایہ)' : '(Freight)'}
                    </span>
                  </div>
                  <label className="text-xs flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenses.kiraya.enabled}
                      onChange={(e) =>
                        handleFieldChange((prev) => ({
                          ...prev,
                          kiraya: { ...prev.kiraya, enabled: e.target.checked },
                        }))
                      }
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="pt-1">
                  <input
                    type="number"
                    value={expenses.kiraya.amount}
                    onChange={(e) => handleKirayaChange(parseNumber(e.target.value))}
                    disabled={!expenses.kiraya.enabled}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-emerald-50/60 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-950 font-numbers text-center"
                  />
                </div>
              </div>

              {/* 3. مزدوری (Mazdoori / Labor) */}
              <div className="bg-white p-2.5 rounded-xl border border-fuchsia-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-fuchsia-950 font-urdu-nastaliq">
                      {t.mazdoori}
                    </span>
                    <span className="text-[11px] text-slate-500 font-urdu-sans">
                      {isUrdu ? '(اترائی و چنائی)' : '(Unloading)'}
                    </span>
                  </div>
                  <label className="text-xs flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenses.mazdoori.enabled}
                      onChange={(e) =>
                        handleFieldChange((prev) => ({
                          ...prev,
                          mazdoori: { ...prev.mazdoori, enabled: e.target.checked },
                        }))
                      }
                      className="rounded text-fuchsia-600 focus:ring-fuchsia-500 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="pt-1">
                  <input
                    type="number"
                    value={expenses.mazdoori.amount}
                    onChange={(e) => handleMazdooriManualChange(parseNumber(e.target.value))}
                    disabled={!expenses.mazdoori.enabled}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-fuchsia-50/60 border border-fuchsia-300 rounded-lg text-xs font-bold text-fuchsia-950 font-numbers text-center"
                  />
                </div>
              </div>

              {/* 4. منشیانہ (Munshiana) */}
              <div className="bg-white p-2.5 rounded-xl border border-sky-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-sky-900 font-urdu-nastaliq">
                      {t.munshiana}
                    </span>
                    <span className="text-[11px] text-slate-500 font-urdu-sans">
                      {isUrdu ? '(منشی خرچ)' : '(Clerk Fee)'}
                    </span>
                  </div>
                  <label className="text-xs flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenses.munshiana.enabled}
                      onChange={(e) =>
                        handleFieldChange((prev) => ({
                          ...prev,
                          munshiana: { ...prev.munshiana, enabled: e.target.checked },
                        }))
                      }
                      className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="pt-1">
                  <input
                    type="number"
                    value={expenses.munshiana.amount}
                    onChange={(e) => handleMunshianaChange(parseNumber(e.target.value))}
                    disabled={!expenses.munshiana.enabled}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-sky-50/60 border border-sky-300 rounded-lg text-xs font-bold text-sky-950 font-numbers text-center"
                  />
                </div>
              </div>

              {/* 5. نقد / پیشگی (Naqd Advance) */}
              <div className="bg-white p-2.5 rounded-xl border border-rose-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-rose-900 font-urdu-nastaliq">
                      {t.naqdAdvance}
                    </span>
                    <span className="text-[11px] text-slate-500 font-urdu-sans">
                      {isUrdu ? '(پیشگی نقد / قرض)' : '(Advance)'}
                    </span>
                  </div>
                  <label className="text-xs flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenses.naqdAdvance.enabled}
                      onChange={(e) =>
                        handleFieldChange((prev) => ({
                          ...prev,
                          naqdAdvance: { ...prev.naqdAdvance, enabled: e.target.checked },
                        }))
                      }
                      className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="pt-1">
                  <input
                    type="number"
                    value={expenses.naqdAdvance.amount}
                    onChange={(e) => handleNaqdAdvanceChange(parseNumber(e.target.value))}
                    disabled={!expenses.naqdAdvance.enabled}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-rose-50/60 border border-rose-300 rounded-lg text-xs font-bold text-rose-950 font-numbers text-center"
                  />
                </div>
              </div>

              {/* 6. مارکیٹ فیس (Market Fee) */}
              <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-amber-900 font-urdu-nastaliq">
                      {t.marketFee}
                    </span>
                    <span className="text-[11px] text-slate-500 font-urdu-sans">
                      {isUrdu ? '(مارکیٹ کمیٹی فیس)' : '(Mandi Fee)'}
                    </span>
                  </div>
                  <label className="text-xs flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenses.marketFee.enabled}
                      onChange={(e) =>
                        handleFieldChange((prev) => ({
                          ...prev,
                          marketFee: { ...prev.marketFee, enabled: e.target.checked },
                        }))
                      }
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                  </label>
                </div>

                <div className="pt-1">
                  <input
                    type="number"
                    value={expenses.marketFee.amount}
                    onChange={(e) => handleMarketFeeChange(parseNumber(e.target.value))}
                    disabled={!expenses.marketFee.enabled}
                    placeholder="0"
                    className="w-full px-3 py-1.5 bg-amber-50/60 border border-amber-300 rounded-lg text-xs font-bold text-amber-950 font-numbers text-center"
                  />
                </div>
              </div>

              {/* Custom Expenses List */}
              {expenses.customExpenses && expenses.customExpenses.length > 0 && (
                <div className="space-y-1.5">
                  {expenses.customExpenses.map((ce) => (
                    <div
                      key={ce.id}
                      className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <span className="px-2 py-0.5 rounded bg-slate-700 text-white text-xs font-urdu-nastaliq">
                        {ce.nameUrdu}
                      </span>
                      <span className="font-bold text-xs font-numbers text-slate-800">
                        {formatPKR(ce.amount, settings.currencySymbol, settings.language)}
                      </span>
                      <button
                        onClick={() => handleRemoveCustomExpense(ce.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Custom Expense Button & Inline Form */}
              {isAddingCustom ? (
                <form onSubmit={handleAddCustomExpense} className="p-2.5 bg-slate-100 rounded-xl space-y-2 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 font-urdu-sans">{t.addCustomExpense}</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustom(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      placeholder={isUrdu ? 'نام مثلاً برف یا باردانہ' : 'Name e.g. Ice / Bags'}
                      value={customNameUrdu}
                      onChange={(e) => setCustomNameUrdu(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans"
                      required
                    />
                    <input
                      type="number"
                      placeholder="رقم (روپے)"
                      value={customAmount || ''}
                      onChange={(e) => setCustomAmount(parseNumber(e.target.value))}
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-numbers"
                      required
                    />
                  </div>
                  <div className="flex gap-1">
                    {['برف', 'باردانہ', 'لیبل و پیکنگ', 'چھانٹی'].map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        onClick={() => setCustomNameUrdu(preset)}
                        className="px-1.5 py-0.5 bg-white border border-slate-200 text-[10px] rounded text-slate-600 font-urdu-sans"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold font-urdu-sans hover:bg-emerald-700"
                  >
                    + {t.save}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingCustom(true)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-dashed border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition font-urdu-sans"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addCustomExpense}</span>
                </button>
              )}
            </div>

            {/* COLUMN 2: ٹوٹل (Total Sales / Split Transactions Rows) */}
            <div className="p-3.5 sm:p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-extrabold text-sm text-slate-800 font-urdu-nastaliq flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>{t.grossTotal} (بولی فروخت لاٹس)</span>
                </h4>
                <span className="text-xs font-bold text-emerald-800 font-numbers bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  {lot.sales.length} {isUrdu ? 'اندراج' : 'bids'}
                </span>
              </div>

              {lot.sales.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  <p className="text-xs font-urdu-sans">{t.noSalesYet}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lot.sales.map((sale, idx) => (
                    <div
                      key={sale.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-800 font-urdu-nastaliq truncate block">
                          {idx + 1}. {sale.buyerName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-urdu-sans font-numbers">
                          {sale.quantity} {unitLabel} × {formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div className="text-end">
                        <span className="font-bold text-sm text-slate-900 font-numbers block">
                          {formatPKR(sale.totalAmount, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtotal of Sales */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 font-urdu-sans">
                  {t.grossTotal} ({t.soldQuantity}: {lot.summary.totalSoldQuantity} {unitLabel})
                </span>
                <span className="text-base font-bold text-blue-950 font-numbers">
                  {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                </span>
              </div>
            </div>
          </div>

          {/* FINAL BOTTOM SUMMARY: میزان (Meezan / Net Payable) */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 text-center sm:text-start">
                <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm sm:text-base font-urdu-nastaliq shadow-xs">
                  {t.meezan}
                </div>
                <div>
                  <span className="text-xs text-slate-200 font-urdu-sans block">
                    {isUrdu ? 'صافی رقم جو کسان/زمیندار کو ادا کرنی ہے' : 'Net amount payable to vendor/farmer'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-urdu-sans">
                    ({t.grossTotal} {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)} - {t.totalExpenses} {formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)})
                  </span>
                </div>
              </div>

              <div className="text-2xl sm:text-3xl font-black text-amber-300 font-numbers tracking-tight">
                {formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT / SIDEBAR: Profit Margin & Arhti Analytics */}
        <div className="lg:col-span-4 space-y-4">
          {/* Arhti Net Profit Margin Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 font-urdu-nastaliq">
                  {t.arhtiProfit}
                </h3>
                <span className="text-[11px] text-slate-500 font-urdu-sans">
                  {isUrdu ? 'آڑھت کمیشن سے خالص آمدن' : 'Net Arhti Commission'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 ring-2 ring-emerald-500/80 ring-offset-1 text-center">
              <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider font-urdu-sans block mb-0.5">
                {isUrdu ? 'اس مال سے کل کمیشن منافع' : 'Total Commission from this lot'}
              </span>
              <div className="text-2xl font-black text-emerald-950 font-numbers">
                {formatPKR(lot.summary.arhtiProfitCommission, settings.currencySymbol, settings.language)}
              </div>
            </div>

            {/* Profit Margin Breakdown List */}
            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 font-urdu-sans">{t.commission} ({expenses.commission.rate}%):</span>
                <span className="font-bold font-numbers text-slate-800">
                  {formatPKR(expenses.commission.amount, settings.currencySymbol, settings.language)}
                </span>
              </div>

              {expenses.munshiana.enabled && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-600 font-urdu-sans">{t.munshiana}:</span>
                  <span className="font-bold font-numbers text-slate-800">
                    {formatPKR(expenses.munshiana.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 font-urdu-sans">{t.totalExpenses} (کٹوتی):</span>
                <span className="font-bold font-numbers text-rose-600">
                  - {formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 text-sm font-bold text-slate-900 border-t border-slate-200">
                <span className="font-urdu-sans">{t.meezan}:</span>
                <span className="text-slate-900 font-numbers font-black">
                  {formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}
                </span>
              </div>
            </div>

            {/* Action button to generate Official Slip */}
            <button
              onClick={() => onOpenReceipt(lot.id)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm active:scale-95 font-urdu-sans border border-slate-800"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>{t.tabReceipt} ({t.printReceipt})</span>
            </button>
          </div>

          {/* Quick Guide on Mandi Accounting */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1.5 font-urdu-sans">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>{isUrdu ? 'آڑھت اخراجات کا طریقہ کار' : 'Mandi Ledger Guide'}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              {isUrdu
                ? 'فروخت شدہ مال کی کل رقم سے کمیشن، گاڑی کا کرایہ، مزدوری اور پیشگی نقد منہا کر کے صافی "میزان" زمیندار کو دیا جاتا ہے۔ آپ ہر فیلڈ میں اپنی مرضی کے مطابق دستی رقم درج کر سکتے ہیں۔'
                : 'From the gross sale, commission, freight, labor, and cash advances are deducted to arrive at the net Meezan payout.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
