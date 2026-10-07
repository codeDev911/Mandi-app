import React, { useState, useMemo, useEffect } from 'react';
import { VendorLot, AppSettings } from '../types';
import { translations, unitLabels, getUnitDisplayLabel } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { AllLotsModal } from './AllLotsModal';
import { PaginationControls } from './PaginationControls';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Date Filter state - defaults to today
  type DailyDateFilter = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all' | 'custom';
  const [dateFilter, setDateFilter] = useState<DailyDateFilter>('today');
  const [customFromDate, setCustomFromDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customToDate, setCustomToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const weekAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const thisMonthPrefix = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const isDateStrInRange = (dateStr?: string) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.slice(0, 10);
    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return cleanDate === todayStr;
    if (dateFilter === 'yesterday') return cleanDate === yesterdayStr;
    if (dateFilter === 'this_week') return cleanDate >= weekAgoStr && cleanDate <= todayStr;
    if (dateFilter === 'this_month') return cleanDate.startsWith(thisMonthPrefix);
    if (dateFilter === 'custom') {
      return (!customFromDate || cleanDate >= customFromDate) && (!customToDate || cleanDate <= customToDate);
    }
    return true;
  };

  const getSaleDateStr = (sale: any, lot?: VendorLot): string => {
    if (sale.date && typeof sale.date === 'string') return sale.date.slice(0, 10);
    if (sale.timestamp && typeof sale.timestamp === 'string') return sale.timestamp.slice(0, 10);
    if (lot?.arrivalDate) return lot.arrivalDate.slice(0, 10);
    if (lot?.createdAt) return lot.createdAt.slice(0, 10);
    return todayStr;
  };

  const isLotInDateRange = (lot: VendorLot) => {
    if (dateFilter === 'all') return true;
    const lotArrDate = lot.arrivalDate?.slice(0, 10);
    const lotCreateDate = lot.createdAt?.slice(0, 10);
    if (isDateStrInRange(lotArrDate) || isDateStrInRange(lotCreateDate)) return true;
    if (lot.sales.some((s) => isDateStrInRange(getSaleDateStr(s, lot)))) return true;
    if (lot.vendorPaymentDate && isDateStrInRange(lot.vendorPaymentDate)) return true;
    return false;
  };

  const lotsByDate = useMemo(() => {
    return lots.filter(isLotInDateRange);
  }, [lots, dateFilter, customFromDate, customToDate, todayStr, yesterdayStr, weekAgoStr, thisMonthPrefix]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, customFromDate, customToDate]);

  const { totalGrossSales, totalCommissionProfit, totalCratesHandled, totalCratesSold } = useMemo(() => {
    let gross = 0;
    let comm = 0;
    let handled = 0;
    let sold = 0;
    for (let i = 0; i < lotsByDate.length; i++) {
      const l = lotsByDate[i];
      if (dateFilter === 'all') {
        gross += l.summary.grossSales || 0;
        comm += l.summary.arhtiProfitCommission || 0;
        handled += l.totalQuantity || 0;
        sold += l.summary.totalSoldQuantity || 0;
      } else {
        const salesInRange = l.sales.filter((s) => isDateStrInRange(getSaleDateStr(s, l)));
        const lotGross = salesInRange.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);
        const lotSold = salesInRange.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
        gross += lotGross;
        sold += lotSold;

        const isArrival = isDateStrInRange(l.arrivalDate);
        if (isArrival) {
          handled += l.totalQuantity || 0;
        } else {
          handled += lotSold;
        }

        if (l.expenses?.commission?.enabled) {
          if (l.expenses.commission.type === 'percentage') {
            comm += Math.round((lotGross * (Number(l.expenses.commission.rate) || 0)) / 100);
          } else if (isArrival) {
            comm += Number(l.expenses.commission.amount) || 0;
          } else if (l.totalQuantity > 0 && lotSold > 0) {
            comm += Math.round(((Number(l.expenses.commission.amount) || 0) * lotSold) / l.totalQuantity);
          }
        }
      }
    }
    return {
      totalGrossSales: gross,
      totalCommissionProfit: comm,
      totalCratesHandled: handled,
      totalCratesSold: sold,
    };
  }, [lotsByDate, dateFilter, customFromDate, customToDate, todayStr, yesterdayStr, weekAgoStr, thisMonthPrefix]);

  const filteredLots = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return lotsByDate;
    return lotsByDate.filter((l) => {
      return (
        l.vendorName.toLowerCase().includes(term) ||
        l.productUrdu.toLowerCase().includes(term) ||
        l.lotNumber.toLowerCase().includes(term) ||
        (l.vendorCity && l.vendorCity.toLowerCase().includes(term))
      );
    });
  }, [lotsByDate, searchTerm]);

  const totalPages = Math.ceil(filteredLots.length / pageSize) || 1;
  const paginatedLots = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLots.slice(start, start + pageSize);
  }, [filteredLots, currentPage, pageSize]);

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

      {/* Search Bar & Date Filter Controls */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
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

        {/* Date Filter Chips (Default: Today) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-100">
          <span className="text-xs font-bold text-stone-500 font-urdu-sans pl-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            {isUrdu ? 'تاریخ فلٹر:' : 'Date Filter:'}
          </span>
          {[
            { id: 'today', label: isUrdu ? 'آج' : 'Today' },
            { id: 'yesterday', label: isUrdu ? 'گزشتہ کل' : 'Yesterday' },
            { id: 'this_week', label: isUrdu ? 'گزشتہ ۷ دن' : 'Last 7 Days' },
            { id: 'this_month', label: isUrdu ? 'رواں ماہ' : 'This Month' },
            { id: 'all', label: isUrdu ? 'تمام تاریخیں' : 'All Time' },
            { id: 'custom', label: isUrdu ? 'اپنی مرضی' : 'Custom' },
          ].map((df) => (
            <button
              key={df.id}
              type="button"
              onClick={() => setDateFilter(df.id as any)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold font-urdu-sans transition ${
                dateFilter === df.id
                  ? 'bg-emerald-900 text-white shadow-xs font-bold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {df.label}
            </button>
          ))}

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="px-2 py-1 bg-stone-50 border border-stone-300 rounded-lg text-xs font-numbers"
              />
              <span className="text-xs text-stone-400 font-urdu-sans">تا</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="px-2 py-1 bg-stone-50 border border-stone-300 rounded-lg text-xs font-numbers"
              />
            </div>
          )}
        </div>
      </div>

      {/* Lots Detailed History Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-bold text-xs sm:text-sm text-stone-800 font-urdu-sans flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-700" />
            <span>{t.dailySummary} (روزنامچہ اندراج)</span>
          </h3>

          <span className="text-xs font-bold font-numbers text-stone-600">
            {filteredLots.length} / {lotsByDate.length}
          </span>
        </div>

        {paginatedLots.length === 0 ? (
          <div className="p-8 text-center bg-white">
            <p className="text-sm font-bold text-stone-700 font-urdu-sans">
              {dateFilter === 'today'
                ? (isUrdu ? 'آج کی کوئی لاٹ درج نہیں ہے۔' : 'No lots recorded for today.')
                : (isUrdu ? 'منتخب کردہ تاریخ کی کوئی لاٹ نہیں ملی۔' : 'No lots found for the selected date.')}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-800 font-urdu-sans transition"
              >
                {isUrdu ? 'تمام لاٹس دیکھیں' : 'View All Lots'}
              </button>
              {onOpenNewLot && (
                <button
                  type="button"
                  onClick={onOpenNewLot}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white font-urdu-sans transition"
                >
                  {isUrdu ? 'نئی لاٹ شامل کریں' : 'Add New Lot'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {paginatedLots.map((lot) => {
            const unitLabel = getUnitDisplayLabel(lot.unitType, settings.language);
            const isCompleted = lot.status === 'completed' || lot.summary.remainingQuantity === 0;

            const salesInRange = lot.sales.filter((s) => isDateStrInRange(getSaleDateStr(s, lot)));
            const isArrival = isDateStrInRange(lot.arrivalDate);
            const lotGrossOnDate = dateFilter === 'all'
              ? lot.summary.grossSales
              : salesInRange.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
            const lotSoldOnDate = dateFilter === 'all'
              ? lot.summary.totalSoldQuantity
              : salesInRange.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

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
                className="p-3 sm:p-4 hover:bg-stone-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Lot info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-stone-900 flex items-center justify-center text-xl flex-shrink-0">
                    {lot.productEmoji}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {dateFilter !== 'all' && !isArrival && salesInRange.length > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold font-urdu-sans">
                          {isUrdu ? 'اس تاریخ کی بولی' : 'Bid on date'}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-stone-500 font-urdu-sans mt-0.5 font-numbers">
                      {lot.productUrdu} • {lot.totalQuantity} {unitLabel} (
                      <span className="text-emerald-700 font-semibold">
                        {dateFilter === 'all' ? `${lot.summary.totalSoldQuantity} فروخت` : `${lotSoldOnDate} اس تاریخ پر فروخت (کل: ${lot.summary.totalSoldQuantity})`}
                      </span>
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
                        {formatPKR(lotGrossOnDate, settings.currencySymbol, settings.language)}
                      </strong>
                    </span>
                    <span className="text-xs font-bold text-emerald-800 font-numbers block">
                      کمیشن منافع: {formatPKR(commOnDate, settings.currencySymbol, settings.language)}
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
                      title="زمیندار کی اخراجات پرچی و کٹوتیاں"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>{isUrdu ? 'اخراجات پرچی' : 'Slip Expenses'}</span>
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
        )}

        {filteredLots.length > 0 && (
          <div className="p-3 border-t border-stone-200">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredLots.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              isUrdu={isUrdu}
              itemName={isUrdu ? 'لاٹس' : 'lots'}
            />
          </div>
        )}
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
