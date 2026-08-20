import React, { useState } from 'react';
import { VendorLot, AppSettings } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { AllLotsModal } from './AllLotsModal';
import {
  History,
  TrendingUp,
  Package,
  Calendar,
  Layers,
  ChevronRight,
  Receipt,
  FileText,
  Search,
  DollarSign,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface DailyHistoryViewProps {
  lots: VendorLot[];
  onOpenExpenseSlip: (lotId: string) => void;
  onOpenReceipt: (lotId: string) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onSelectLot?: (lotId: string) => void;
  onOpenNewLot?: () => void;
  settings: AppSettings;
}

export const DailyHistoryView: React.FC<DailyHistoryViewProps> = ({
  lots,
  onOpenExpenseSlip,
  onOpenReceipt,
  onToggleVendorPaymentStatus,
  onSelectLot,
  onOpenNewLot,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [searchTerm, setSearchTerm] = useState('');
  const [isAllLotsOpen, setIsAllLotsOpen] = useState(false);

  const totalGrossSales = lots.reduce((acc, l) => acc + l.summary.grossSales, 0);
  const totalCommissionProfit = lots.reduce((acc, l) => acc + l.summary.arhtiProfitCommission, 0);
  const totalCratesHandled = lots.reduce((acc, l) => acc + l.totalQuantity, 0);
  const totalCratesSold = lots.reduce((acc, l) => acc + l.summary.totalSoldQuantity, 0);
  const totalNetToVendors = lots.reduce((acc, l) => acc + l.summary.netPayableToVendor, 0);

  const filteredLots = lots.filter((l) => {
    return (
      l.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.productUrdu.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.vendorCity && l.vendorCity.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="space-y-4 pb-16 sm:pb-6">
      {/* Mandi Executive Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Turnover */}
        <div className="bg-emerald-900 text-white p-4 rounded-2xl shadow-sm">
          <span className="text-xs text-emerald-200 font-urdu-sans block mb-1">
            {t.todayTurnover} (کل مال فروخت)
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-300 font-numbers tracking-tight">
            {formatPKR(totalGrossSales, settings.currencySymbol, settings.language)}
          </div>
        </div>

        {/* Commission Profit */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-emerald-700 font-bold font-urdu-sans block mb-1">
            {t.todayCommission} (خالص بچت)
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 font-numbers tracking-tight">
            {formatPKR(totalCommissionProfit, settings.currencySymbol, settings.language)}
          </div>
        </div>

        {/* Total Crates / Bags */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-500 font-urdu-sans block mb-1">
            {t.todayCrates} (پیکنگ تعداد)
          </span>
          <div className="text-xl sm:text-2xl font-black text-stone-800 font-numbers">
            {totalCratesSold} / {totalCratesHandled}
          </div>
        </div>

        {/* Total Lots */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-500 font-urdu-sans block mb-1">
            {t.todayLots} (کل لاٹس)
          </span>
          <div className="text-xl sm:text-2xl font-black text-blue-900 font-numbers">
            {lots.length} <span className="text-xs font-normal font-urdu-sans">گاڑیاں / لاٹس</span>
          </div>
        </div>
      </div>

      {/* Search Bar & View All Lots Button */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-urdu-sans focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 rtl:right-3 rtl:left-auto top-2.5" />
        </div>

        <button
          type="button"
          onClick={() => setIsAllLotsOpen(true)}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 font-urdu-sans transition shadow-xs"
        >
          <Layers className="w-4 h-4" />
          <span>{isUrdu ? 'تمام لاٹس ڈائرکٹری دیکھیں' : 'View All Lots Modal'}</span>
        </button>
      </div>

      {/* Lots Detailed History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm text-stone-800 font-urdu-sans flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-700" />
            <span>{t.dailySummary} (روزنامچہ اندراج)</span>
          </h3>

          <span className="text-xs font-bold font-numbers text-stone-600">
            {filteredLots.length} / {lots.length}
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {filteredLots.map((lot) => {
            const unitLabel = unitLabels[lot.unitType][settings.language];
            const isCompleted = lot.status === 'completed' || lot.summary.remainingQuantity === 0;

            return (
              <div
                key={lot.id}
                className="p-3 sm:p-4 hover:bg-stone-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Lot info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-stone-900 flex items-center justify-center text-xl flex-shrink-0">
                    {lot.productEmoji}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-stone-900 font-urdu-nastaliq truncate">
                        {lot.vendorName}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                        {lot.lotNumber}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-urdu-sans ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isCompleted ? t.statusCompleted : t.statusActive}
                      </span>
                    </div>

                    <p className="text-xs text-stone-500 font-urdu-sans mt-0.5 font-numbers">
                      {lot.productUrdu} • {lot.totalQuantity} {unitLabel} (
                      <span className="text-emerald-700 font-semibold">{lot.summary.totalSoldQuantity} فروخت</span>
                      {lot.summary.remainingQuantity > 0 && (
                        <span className="text-amber-700 font-semibold">, {lot.summary.remainingQuantity} باقی</span>
                      )}
                      ) • {lot.arrivalDate}
                    </p>
                  </div>
                </div>

                {/* Financial Summary & Direct Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  <div className="text-start sm:text-end">
                    <span className="text-[11px] text-stone-500 font-urdu-sans block">
                      {t.grossTotal}:{' '}
                      <strong className="text-stone-900 font-numbers">
                        {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                      </strong>
                    </span>
                    <span className="text-xs font-bold text-emerald-800 font-numbers block">
                      کمیشن منافع: {formatPKR(lot.summary.arhtiProfitCommission, settings.currencySymbol, settings.language)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onToggleVendorPaymentStatus && (
                      <button
                        onClick={() => onToggleVendorPaymentStatus(lot.id)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold font-urdu-sans transition flex items-center gap-1 border active:scale-95 ${
                          lot.vendorPaymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        }`}
                        title={
                          lot.vendorPaymentStatus === 'paid'
                            ? 'ادائیگی ہو چکی ہے - کلک کر کے بقایا کریں'
                            : 'ادائیگی بقایا ہے - کلک کر کے ادا شدہ کریں'
                        }
                      >
                        {lot.vendorPaymentStatus === 'paid' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600" />
                        )}
                        <span>{lot.vendorPaymentStatus === 'paid' ? 'ادا شدہ' : 'بقایا'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => onOpenExpenseSlip(lot.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition flex items-center gap-1 font-urdu-sans"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>{t.tabExpenses}</span>
                    </button>

                    <button
                      onClick={() => onOpenReceipt(lot.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1 font-urdu-sans"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{t.tabReceipt}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All Lots Modal for Lots/History page */}
      {isAllLotsOpen && (
        <AllLotsModal
          lots={lots}
          selectedLotId={lots[0]?.id || ''}
          onSelectLot={(id) => {
            if (onSelectLot) onSelectLot(id);
            setIsAllLotsOpen(false);
          }}
          onOpenNewLot={onOpenNewLot}
          onOpenExpenseSlip={onOpenExpenseSlip}
          onOpenReceipt={onOpenReceipt}
          onClose={() => setIsAllLotsOpen(false)}
          settings={settings}
        />
      )}
    </div>
  );
};
