import React, { useState, useMemo } from 'react';
import { VendorLot, AppSettings } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import {
  Search,
  X,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  CircleDashed,
  Gavel,
  Receipt,
  FileText,
  Trash2,
} from 'lucide-react';

interface AllLotsModalProps {
  lots: VendorLot[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
  onOpenNewLot?: () => void;
  onOpenExpenseSlip: (lotId: string) => void;
  onOpenReceipt: (lotId: string) => void;
  onDeleteLot?: (lotId: string) => void;
  onClose: () => void;
  settings: AppSettings;
}

type SaleStatusFilter = 'all' | 'not_sold' | 'partially_sold' | 'fully_sold';
type DateFilter = 'all' | 'today' | 'yesterday' | 'this_week' | 'custom';

export const AllLotsModal: React.FC<AllLotsModalProps> = ({
  lots,
  selectedLotId,
  onSelectLot,
  onOpenExpenseSlip,
  onOpenReceipt,
  onDeleteLot,
  onClose,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDate, setCustomDate] = useState('');

  // Helper date calculations
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const weekAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  // Filtered lots
  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = lot.vendorName.toLowerCase().includes(q);
        const matchesLotNum = lot.lotNumber.toLowerCase().includes(q);
        const matchesProductUrdu = lot.productUrdu.toLowerCase().includes(q);
        const matchesProductName = lot.productName.toLowerCase().includes(q);
        const matchesCity = lot.vendorCity ? lot.vendorCity.toLowerCase().includes(q) : false;
        const matchesVehicle = lot.vehicleNumber ? lot.vehicleNumber.toLowerCase().includes(q) : false;

        if (!matchesName && !matchesLotNum && !matchesProductUrdu && !matchesProductName && !matchesCity && !matchesVehicle) {
          return false;
        }
      }

      // 2. Sales Status Filter
      const soldQty = lot.summary.soldQuantity;
      const remainingQty = lot.summary.remainingQuantity;

      if (statusFilter === 'not_sold') {
        if (soldQty > 0) return false;
      } else if (statusFilter === 'partially_sold') {
        if (soldQty === 0 || remainingQty === 0) return false;
      } else if (statusFilter === 'fully_sold') {
        if (remainingQty > 0 && lot.status !== 'completed') return false;
      }

      // 3. Date Filter
      if (dateFilter === 'today') {
        if (!lot.arrivalDate.startsWith(todayStr)) return false;
      } else if (dateFilter === 'yesterday') {
        if (!lot.arrivalDate.startsWith(yesterdayStr)) return false;
      } else if (dateFilter === 'this_week') {
        if (lot.arrivalDate < weekAgoStr) return false;
      } else if (dateFilter === 'custom' && customDate) {
        if (!lot.arrivalDate.startsWith(customDate)) return false;
      }

      return true;
    });
  }, [lots, searchQuery, statusFilter, dateFilter, customDate, todayStr, yesterdayStr, weekAgoStr]);

  // Counts for tabs
  const notSoldCount = useMemo(() => lots.filter((l) => l.summary.soldQuantity === 0).length, [lots]);
  const partiallySoldCount = useMemo(
    () => lots.filter((l) => l.summary.soldQuantity > 0 && l.summary.remainingQuantity > 0).length,
    [lots]
  );
  const fullySoldCount = useMemo(
    () => lots.filter((l) => l.summary.remainingQuantity === 0 || l.status === 'completed').length,
    [lots]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-5 duration-200">
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden"></div>

        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-lg shadow-xs">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold font-urdu-nastaliq text-white">
                  {t.allLotsDirectory}
                </h3>
                <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold font-numbers border border-emerald-500/30">
                  {filteredLots.length} / {lots.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-urdu-sans">
                {isUrdu ? 'تمام زرعی مال کی تلاش اور فلٹر' : 'Search and filter all produce lots'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Search Controls */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchLotsPlaceholder}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-urdu-sans transition pr-10 rtl:pr-3.5 rtl:pl-10 shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 rtl:right-auto rtl:left-3 top-2.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-9 rtl:right-auto rtl:left-9 top-2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status and Date Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
            {/* Sales Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setStatusFilter('all');
                }}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.filterAll} ({lots.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setStatusFilter('not_sold');
                }}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex items-center gap-1 ${
                  statusFilter === 'not_sold'
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'bg-white border border-slate-200 text-amber-800 hover:bg-amber-50'
                }`}
              >
                <CircleDashed className="w-3 h-3" />
                <span>{t.filterNotSold}</span>
                <span className="text-[10px] font-numbers opacity-80">({notSoldCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setStatusFilter('partially_sold');
                }}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex items-center gap-1 ${
                  statusFilter === 'partially_sold'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'bg-white border border-slate-200 text-blue-800 hover:bg-blue-50'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{t.filterPartiallySold}</span>
                <span className="text-[10px] font-numbers opacity-80">({partiallySoldCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setStatusFilter('fully_sold');
                }}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex items-center gap-1 ${
                  statusFilter === 'fully_sold'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>{t.filterFullySold}</span>
                <span className="text-[10px] font-numbers opacity-80">({fullySoldCount})</span>
              </button>
            </div>

            {/* Date Filter Selection */}
            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <select
                value={dateFilter}
                onChange={(e) => {
                  sound.playTick();
                  setDateFilter(e.target.value as DateFilter);
                }}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">{t.filterAllDates}</option>
                <option value="today">{t.filterToday}</option>
                <option value="yesterday">{t.filterYesterday}</option>
                <option value="this_week">{t.filterThisWeek}</option>
                <option value="custom">{isUrdu ? 'مخصوص تاریخ...' : 'Custom Date...'}</option>
              </select>

              {dateFilter === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-numbers text-slate-700"
                />
              )}
            </div>
          </div>
        </div>

        {/* Lots Grid / Cards List */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3 bg-slate-100/60 scrollbar-none no-scrollbar">
          {filteredLots.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-xl">
                🔍
              </div>
              <h4 className="text-sm font-bold text-slate-700 font-urdu-nastaliq">{t.noLotsFound}</h4>
              <p className="text-xs text-slate-400 font-urdu-sans mt-1">
                {isUrdu ? 'تلاش یا فلٹر تبدیل کریں' : 'Try adjusting your search query or filters'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredLots.map((lot) => {
                const isSelected = selectedLotId === lot.id;
                const unitLabel = unitLabels[lot.unitType][settings.language];
                const soldQty = lot.summary.soldQuantity;
                const remainingQty = lot.summary.remainingQuantity;
                const isCompleted = remainingQty === 0 || lot.status === 'completed';
                const isFresh = soldQty === 0;

                return (
                  <div
                    key={lot.id}
                    className={`bg-white rounded-2xl p-3 sm:p-3.5 border transition flex flex-col justify-between shadow-2xs relative ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Top Row: Product, Lot #, and Status Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl p-1 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0">
                            {lot.productEmoji}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-bold text-slate-900 font-urdu-nastaliq truncate">
                                {lot.vendorName}
                              </h4>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-numbers flex-shrink-0">
                                {lot.lotNumber}
                              </span>
                            </div>
                            <p className="text-xs text-emerald-800 font-semibold font-urdu-sans">
                              {lot.productUrdu} ({lot.totalQuantity} {unitLabel})
                            </p>
                          </div>
                        </div>

                        {/* Status Pill */}
                        <div className="text-end flex-shrink-0">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-urdu-sans ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isFresh
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-blue-100 text-blue-900 border border-blue-300'
                            }`}
                          >
                            {isCompleted
                              ? isUrdu
                                ? 'مکمل فروخت'
                                : 'Completed'
                              : isFresh
                              ? isUrdu
                                ? 'تازہ مال'
                                : 'Fresh'
                              : `${remainingQty} ${unitLabel} باقی`}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-numbers mt-0.5">
                            {lot.arrivalDate}
                          </span>
                        </div>
                      </div>

                      {/* City, Vehicle, Sales Info Row */}
                      <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-urdu-sans flex-wrap py-1 border-t border-slate-100">
                        {lot.vendorCity && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {lot.vendorCity}
                          </span>
                        )}
                        {lot.vehicleNumber && (
                          <span className="flex items-center gap-0.5">
                            <Truck className="w-3 h-3 text-slate-400" />
                            {lot.vehicleNumber}
                          </span>
                        )}
                        {lot.sales.length > 0 && (
                          <span className="flex items-center gap-0.5 text-slate-600 font-numbers">
                            <Gavel className="w-3 h-3 text-emerald-600" />
                            {lot.sales.length} {isUrdu ? 'بولیاں' : 'bids'}
                          </span>
                        )}
                      </div>

                      {/* Progress and Numbers Bar */}
                      <div className="mt-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1 font-urdu-sans">
                          <span className="text-slate-600 text-[11px]">
                            {isUrdu ? 'فروخت شدہ:' : 'Sold:'}{' '}
                            <strong className="text-slate-900 font-numbers">
                              {soldQty} / {lot.totalQuantity} {unitLabel}
                            </strong>
                          </span>
                          <span className="text-emerald-700 font-bold font-numbers text-[11px]">
                            {lot.summary.percentSold}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              isCompleted ? 'bg-emerald-600' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${lot.summary.percentSold}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200/60 text-xs">
                          <span className="text-slate-500 font-urdu-sans text-[11px]">{t.grossTotal}:</span>
                          <span className="font-bold text-slate-900 font-numbers text-xs">
                            {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          sound.playTick();
                          onSelectLot(lot.id);
                          onClose();
                        }}
                        className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 font-urdu-sans shadow-2xs active:scale-95 ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <Gavel className="w-3.5 h-3.5" />
                        <span>{isSelected ? (isUrdu ? 'منتخب شدہ' : 'Selected') : t.selectLot}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playTick();
                          onClose();
                          onOpenExpenseSlip(lot.id);
                        }}
                        title={t.tabExpenses}
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 font-urdu-sans border border-slate-200 active:scale-95"
                      >
                        <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">{t.tabExpenses}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playTick();
                          onClose();
                          onOpenReceipt(lot.id);
                        }}
                        title={t.tabReceipt}
                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 font-urdu-sans border border-slate-200 active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">{t.tabReceipt}</span>
                      </button>

                      {/* Delete option if no bids are placed on this entry */}
                      {lot.sales.length === 0 && onDeleteLot && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                isUrdu
                                  ? `کیا آپ واقعی اس لاٹ (${lot.lotNumber} - ${lot.vendorName}) کو حذف کرنا چاہتے ہیں؟`
                                  : `Delete lot ${lot.lotNumber} (${lot.vendorName})?`
                              )
                            ) {
                              sound.playTick();
                              onDeleteLot(lot.id);
                            }
                          }}
                          title={isUrdu ? 'لاٹ حذف کریں (کوئی بولی نہیں)' : 'Delete lot (no bids)'}
                          className="py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1 font-urdu-sans border border-rose-200 active:scale-95 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span className="hidden sm:inline">{isUrdu ? 'حذف کریں' : 'Delete'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-urdu-sans">
          <span>
            {isUrdu ? 'کل لاٹس:' : 'Total lots:'}{' '}
            <strong className="text-slate-900 font-numbers">{lots.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition active:scale-95 font-urdu-sans"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

