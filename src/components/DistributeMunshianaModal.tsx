import React, { useState, useMemo } from 'react';
import { VendorLot, AppSettings } from '../types';
import { formatPKR, parseNumber } from '../utils/currency';
import { calculateLotSummary, distributeMunshianaToLots } from '../utils/calculations';
import { sound } from '../utils/sound';
import { X, Check, Calculator, AlertCircle, Coins, Layers } from 'lucide-react';

interface DistributeMunshianaModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
  lots: VendorLot[];
  settings: AppSettings;
  onApply: (updatedLots: VendorLot[]) => void;
}

export const DistributeMunshianaModal: React.FC<DistributeMunshianaModalProps> = ({
  isOpen,
  onClose,
  vendorName,
  lots,
  settings,
  onApply,
}) => {
  const isUrdu = settings.language === 'ur';

  // Calculate existing total munshiana across these lots as initial hint (rounded to prevent floating errors)
  const currentTotalMunshiana = useMemo(() => {
    const raw = lots.reduce((sum, l) => {
      return sum + (l.expenses?.munshiana?.enabled ? Number(l.expenses.munshiana.amount) || 0 : 0);
    }, 0);
    return Math.round(raw);
  }, [lots]);

  const [totalMunshianaInput, setTotalMunshianaInput] = useState<string>(() =>
    currentTotalMunshiana > 0 ? String(currentTotalMunshiana) : '150'
  );

  if (!isOpen || lots.length === 0) return null;

  const lotCount = lots.length;
  const totalAmount = Math.max(0, Math.round(parseNumber(totalMunshianaInput) || 0));

  // Exact whole-rupee distribution to prevent IEEE 754 floating point errors
  const distributedAmounts = distributeMunshianaToLots(totalAmount, lotCount);

  const handleConfirm = () => {
    if (totalAmount <= 0) return;
    sound.playCashChime();

    const updatedLots: VendorLot[] = lots.map((lot, idx) => {
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

    onApply(updatedLots);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-800 to-indigo-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shadow-inner">
              <Coins className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg font-urdu-nastaliq">
                {isUrdu ? 'تمام لاٹس پر منشیانہ کی مساوی تقسیم' : 'Distribute Munshiana to All Lots'}
              </h3>
              <p className="text-xs text-purple-200 font-urdu-sans mt-0.5">
                {isUrdu ? `زمیندار: ${vendorName} (${lotCount} نتائج لاٹس)` : `Vendor: ${vendorName} (${lotCount} lots)`}
              </p>
            </div>
          </div>

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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Explanation Banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3.5 flex items-start gap-3">
            <Calculator className="w-5 h-5 text-purple-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-purple-950 font-urdu-sans space-y-1">
              <p className="font-bold">
                {isUrdu
                  ? `مجموعی منشیانہ رقم کو اس زمیندار کی تمام ${lotCount} لاٹس میں برابر تقسیم کیا جائے گا۔`
                  : `Total munshiana amount will be spread equally among all ${lotCount} lots of this vendor.`}
              </p>
              <p className="text-purple-800">
                {isUrdu
                  ? `کل منشیانہ ${formatPKR(totalAmount || 150, settings.currencySymbol, settings.language)} کو بغیر کسی اعشاریہ کے ${lotCount} لاٹس میں تقسیم کیا جائے گا۔`
                  : `Total ${formatPKR(totalAmount || 150, settings.currencySymbol, settings.language)} distributed across ${lotCount} lots cleanly without floating point errors.`}
              </p>
            </div>
          </div>

          {/* Amount Input */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 font-urdu-sans mb-1.5">
                {isUrdu ? 'کل منشیانہ رقم درج کریں (روپے):' : 'Enter Total Munshiana Amount (PKR):'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={totalMunshianaInput}
                  onChange={(e) => setTotalMunshianaInput(e.target.value)}
                  placeholder="مثلاً 150"
                  autoFocus
                  className="w-full px-4 py-2.5 bg-white border-2 border-purple-300 focus:border-purple-600 rounded-xl text-base sm:text-lg font-bold font-numbers text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-200 shadow-2xs"
                />
                <span className="absolute right-3 rtl:left-3 rtl:right-auto top-3 text-xs font-bold text-slate-400 font-urdu-sans">
                  {settings.currencySymbol}
                </span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-slate-500 font-urdu-sans">{isUrdu ? 'فوری رقم:' : 'Quick:'}</span>
              {[50, 100, 150, 200, 250, 300, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setTotalMunshianaInput(String(preset));
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold font-numbers transition border ${
                    totalAmount === preset
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-purple-50'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Live Calculation Result Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-indigo-900 font-urdu-sans block">
                {isUrdu ? 'لاٹس پر مساوی تقسیم:' : 'Distributed to Lots:'}
              </span>
              <span className="text-xl sm:text-2xl font-black text-purple-950 font-numbers block mt-0.5">
                {formatPKR(totalAmount, settings.currencySymbol, settings.language)}
              </span>
              <span className="text-[10px] text-slate-500 font-urdu-sans">
                ({lotCount} لاٹس میں بغیر اعشاریہ تقسیم)
              </span>
            </div>

            <div className="text-end">
              <span className="text-[11px] text-slate-500 font-urdu-sans block">{isUrdu ? 'کل اثر:' : 'Total Effect:'}</span>
              <span className="text-sm font-bold text-indigo-900 font-numbers block mt-0.5">
                {formatPKR(totalAmount, settings.currencySymbol, settings.language)}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold font-urdu-sans">
                {lotCount} لاٹس اپڈیٹ ہوں گی
              </span>
            </div>
          </div>

          {/* Lots preview list */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 font-urdu-sans block">
              {isUrdu ? `منسلک لاٹس کی فہرست (${lotCount}):` : `Target Lots (${lotCount}):`}
            </span>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-2xs">
              {lots.map((lot, idx) => {
                const currentMun = lot.expenses?.munshiana?.enabled ? Math.round(Number(lot.expenses.munshiana.amount) || 0) : 0;
                const lotAmt = distributedAmounts[idx] ?? 0;
                return (
                  <div key={lot.id} className="p-2 sm:p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-900 font-mono text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-base">{lot.productEmoji}</span>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 font-urdu-sans truncate block">
                          {lot.productUrdu} ({lot.lotNumber})
                        </span>
                        <span className="text-[10px] text-slate-400 font-numbers">
                          {lot.arrivalDate} • {lot.totalQuantity} کل تعداد
                        </span>
                      </div>
                    </div>

                    <div className="text-end flex-shrink-0">
                      <span className="text-[10px] text-slate-400 line-through font-numbers block">
                        {isUrdu ? 'موجودہ: ' : 'Old: '} {formatPKR(currentMun, settings.currencySymbol, settings.language)}
                      </span>
                      <span className="text-xs font-bold text-purple-900 font-numbers block">
                        {isUrdu ? 'نیا: ' : 'New: '} {formatPKR(lotAmt, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playTick();
              onClose();
            }}
            className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold font-urdu-sans transition shadow-2xs"
          >
            {isUrdu ? 'منسوخ کریں' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={totalAmount <= 0}
            onClick={handleConfirm}
            className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-urdu-sans shadow-md flex items-center gap-2 transition active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>
              {isUrdu
                ? `تمام ${lotCount} لاٹس پر لاگو کریں (کل ${formatPKR(totalAmount, settings.currencySymbol, settings.language)})`
                : `Apply to All ${lotCount} Lots (Total ${formatPKR(totalAmount, settings.currencySymbol, settings.language)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
