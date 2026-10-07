import React, { useState, useMemo, useEffect } from 'react';
import { VendorLot, AppSettings } from '../types';
import { translations, formatFullRealDate, getUnitDisplayLabel } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import { printBatchVendorBillsA4, printVendorBillSlipA4 } from '../utils/printHelper';
import { InsafMandiBillView } from './InsafMandiBillView';
import {
  Printer,
  X,
  Search,
  CheckSquare,
  Square,
  Layers,
  FileText,
  Filter,
  Eye,
  Check,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Download,
} from 'lucide-react';

interface AllVendorBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lots: VendorLot[];
  settings: AppSettings;
  dateLabel?: string;
}

interface VendorGroupedData {
  vendorName: string;
  vendorPhone?: string;
  vendorCity?: string;
  lots: VendorLot[];
  totalQuantity: number;
  grossSales: number;
  totalExpenses: number;
  netPayable: number;
  totalPaid: number;
  isPaid: boolean;
}

export const AllVendorBillsModal: React.FC<AllVendorBillsModalProps> = ({
  isOpen,
  onClose,
  lots,
  settings,
  dateLabel,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'slips' | 'list'>('slips');
  const [isAveraged, setIsAveraged] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [activeVendorSlip, setActiveVendorSlip] = useState<string | null>(null);

  // Group lots by vendor
  const vendorGroups = useMemo<VendorGroupedData[]>(() => {
    const map = new Map<string, VendorGroupedData>();

    lots.forEach((lot) => {
      const vName = (lot.vendorName || 'عام زمیندار').trim();
      if (!map.has(vName)) {
        map.set(vName, {
          vendorName: vName,
          vendorPhone: lot.vendorPhone,
          vendorCity: lot.vendorCity,
          lots: [],
          totalQuantity: 0,
          grossSales: 0,
          totalExpenses: 0,
          netPayable: 0,
          totalPaid: 0,
          isPaid: true,
        });
      }

      const group = map.get(vName)!;
      group.lots.push(lot);
      group.totalQuantity += lot.totalQuantity;
      group.grossSales += lot.summary.grossSales;
      group.totalExpenses += lot.summary.totalExpenses;
      group.netPayable += lot.summary.netPayableToVendor;

      const lotPaid =
        lot.vendorPaymentAmount !== undefined
          ? lot.vendorPaymentAmount
          : lot.vendorPaymentStatus === 'paid'
          ? lot.summary.netPayableToVendor
          : 0;
      group.totalPaid += lotPaid;

      if (lot.vendorPaymentStatus !== 'paid') {
        group.isPaid = false;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.grossSales - a.grossSales);
  }, [lots]);

  // Initially select all vendors on open or when lots change
  useEffect(() => {
    if (isOpen && vendorGroups.length > 0) {
      setSelectedVendors(new Set(vendorGroups.map((vg) => vg.vendorName)));
    }
  }, [isOpen, vendorGroups]);

  // Filtered vendors based on search and status
  const filteredVendors = useMemo(() => {
    return vendorGroups.filter((vg) => {
      if (statusFilter === 'unpaid' && vg.isPaid) return false;
      if (statusFilter === 'paid' && !vg.isPaid) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        vg.vendorName.toLowerCase().includes(term) ||
        (vg.vendorCity && vg.vendorCity.toLowerCase().includes(term)) ||
        (vg.vendorPhone && vg.vendorPhone.includes(term))
      );
    });
  }, [vendorGroups, searchTerm, statusFilter]);

  // Selection helpers
  const handleToggleVendor = (vName: string) => {
    sound.playTick();
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vName)) {
        next.delete(vName);
      } else {
        next.add(vName);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    sound.playTick();
    if (selectedVendors.size === filteredVendors.length) {
      setSelectedVendors(new Set());
    } else {
      setSelectedVendors(new Set(filteredVendors.map((v) => v.vendorName)));
    }
  };

  const handleSelectOnlyUnpaid = () => {
    sound.playTick();
    const unpaid = vendorGroups.filter((v) => !v.isPaid).map((v) => v.vendorName);
    setSelectedVendors(new Set(unpaid));
  };

  // Batch Print Action
  const handlePrintBatch = (onlySelected: boolean = true) => {
    sound.playCashChime();
    const targetVendors = vendorGroups.filter((vg) =>
      onlySelected ? selectedVendors.has(vg.vendorName) : true
    );

    if (targetVendors.length === 0) return;

    printBatchVendorBillsA4(
      targetVendors.map((vg, idx) => ({
        vendorName: vg.vendorName,
        vendorPhone: vg.vendorPhone,
        vendorCity: vg.vendorCity,
        lots: vg.lots,
        billNumber: `${101 + idx}`,
      })),
      settings,
      dateLabel,
      isAveraged
    );
  };

  // Single Bill Print Action
  const handlePrintSingle = (vGroup: VendorGroupedData) => {
    sound.playCashChime();
    printVendorBillSlipA4(
      vGroup.vendorName,
      vGroup.vendorPhone,
      vGroup.vendorCity,
      vGroup.lots,
      settings,
      dateLabel,
      isAveraged
    );
  };

  if (!isOpen) return null;

  const selectedCount = selectedVendors.size;
  const allSelected = filteredVendors.length > 0 && selectedCount === filteredVendors.length;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-7xl h-full sm:h-[95vh] rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* 1. TOP HEADER & METRICS BAR */}
        <div className="bg-slate-950 px-3 sm:px-6 py-3 border-b border-slate-800 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => {
                sound.playTick();
                onClose();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition active:scale-95 flex-shrink-0"
              title="واپس جائیں"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            </button>

            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0 hidden sm:flex">
              <Layers className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white font-urdu-nastaliq truncate">
                  تمام زمینداروں کے پکے بل (بل بک)
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/40 font-bold font-numbers flex-shrink-0">
                  {vendorGroups.length} زمیندار
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-urdu-sans truncate">
                {dateLabel || 'آج کی تاریخ'} • منتخب بل ایک ساتھ یا الگ الگ پرنٹ کریں
              </p>
            </div>
          </div>

          {/* Action Buttons in Header */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Averaged Bill Toggle */}
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setIsAveraged(!isAveraged);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 ${
                isAveraged
                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="اجناس وار اوسط بل کا موڈ فعال کریں"
            >
              <span>{isAveraged ? 'اوسط بل ✓' : 'اوسط ریٹ بل'}</span>
            </button>

            {/* Print Selected Bills Primary Button */}
            <button
              type="button"
              onClick={() => handlePrintBatch(true)}
              disabled={selectedCount === 0}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm font-urdu-sans flex items-center gap-1.5 shadow-lg active:scale-95 transition"
            >
              <Printer className="w-4 h-4 stroke-[2.2]" />
              <span>
                منتخب بل پرنٹ کریں ({selectedCount})
              </span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                onClose();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition active:scale-90"
              title="بند کریں"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* 2. FILTER & SELECTION TOOLBAR */}
        <div className="bg-slate-900/90 border-b border-slate-800 p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="زمیندار کا نام تلاش کریں..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 font-urdu-sans focus:outline-hidden focus:border-emerald-500 pr-8 rtl:pl-8 rtl:pr-3"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 rtl:left-2.5 rtl:right-auto top-2.5 pointer-events-none" />
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-2.5 py-1 rounded-xl border text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 ${
                allSelected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5" />}
              <span>{allSelected ? 'سب خارج کریں' : 'سب منتخب کریں'}</span>
            </button>

            <button
              type="button"
              onClick={handleSelectOnlyUnpaid}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold font-urdu-sans transition active:scale-95"
            >
              غیر ادا شدہ منتخب کریں
            </button>

            {/* Status Tabs */}
            <div className="bg-slate-950 p-0.5 rounded-xl border border-slate-800 flex items-center">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold font-urdu-sans transition ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                تمام ({vendorGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unpaid')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold font-urdu-sans transition ${
                  statusFilter === 'unpaid' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                باقی ({vendorGroups.filter((v) => !v.isPaid).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('paid')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold font-urdu-sans transition ${
                  statusFilter === 'paid' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ادا شدہ ({vendorGroups.filter((v) => v.isPaid).length})
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="bg-slate-950 p-0.5 rounded-xl border border-slate-800 flex items-center">
              <button
                type="button"
                onClick={() => setViewMode('slips')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold font-urdu-sans flex items-center gap-1 transition ${
                  viewMode === 'slips' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>پرچی پیش نظارہ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold font-urdu-sans flex items-center gap-1 transition ${
                  viewMode === 'list' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>فہرست کارڈز</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/70">
          {filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center space-y-2">
              <AlertCircle className="w-10 h-10 text-slate-500" />
              <p className="text-sm font-bold font-urdu-sans">کوئی زمیندار نہیں ملا</p>
              <p className="text-xs text-slate-500">براہ کرم فلٹر یا تلاش کا لفظ تبدیل کریں</p>
            </div>
          ) : viewMode === 'slips' ? (
            /* SLIPS PREVIEW MODE: Stacks authentic bill previews with selection checkboxes */
            <div className="space-y-8 max-w-4xl mx-auto">
              {filteredVendors.map((vg, idx) => {
                const isSelected = selectedVendors.has(vg.vendorName);
                return (
                  <div
                    key={vg.vendorName}
                    className={`rounded-3xl border transition overflow-hidden shadow-2xl ${
                      isSelected
                        ? 'border-emerald-500/60 ring-2 ring-emerald-500/30 bg-slate-900'
                        : 'border-slate-800 opacity-60 hover:opacity-100 bg-slate-900/60'
                    }`}
                  >
                    {/* Bill Header Selection Strip */}
                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleVendor(vg.vendorName)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition border ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white font-urdu-nastaliq">
                              {vg.vendorName}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold font-numbers">
                              {vg.lots.length} لاٹ
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-urdu-sans">
                            صافی رقم: <strong className="text-emerald-400 font-numbers">{formatPKR(vg.netPayable, settings.currencySymbol, settings.language)}</strong>
                            {vg.isPaid ? ' • ادا شدہ ✓' : ' • ادھار باقی'}
                          </p>
                        </div>
                      </div>

                      {/* Single Bill Print Button */}
                      <button
                        type="button"
                        onClick={() => handlePrintSingle(vg)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-bold text-xs font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>پرنٹ کریں</span>
                      </button>
                    </div>

                    {/* Exact Authentic Bill Component */}
                    <div className="p-2 sm:p-6 bg-slate-950 flex justify-center overflow-x-auto">
                      <InsafMandiBillView
                        vendorName={vg.vendorName}
                        vendorPhone={vg.vendorPhone}
                        vendorCity={vg.vendorCity}
                        lots={vg.lots}
                        settings={settings}
                        dateLabel={dateLabel}
                        isAveraged={isAveraged}
                        billNumber={`${101 + idx}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST / CARDS VIEW MODE: Compact overview for rapid selection */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredVendors.map((vg, idx) => {
                const isSelected = selectedVendors.has(vg.vendorName);
                return (
                  <div
                    key={vg.vendorName}
                    onClick={() => handleToggleVendor(vg.vendorName)}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-3 shadow-md ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/80 ring-2 ring-emerald-500/30'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition border ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <span className="font-bold text-sm text-white font-urdu-nastaliq">
                            {vg.vendorName}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-urdu-sans ${
                            vg.isPaid
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {vg.isPaid ? 'ادا شدہ' : 'ادھار باقی'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span className="font-urdu-sans">کل لاٹس / تعداد:</span>
                          <span className="font-bold text-white font-numbers">
                            {vg.lots.length} لاٹ • {vg.totalQuantity} {getUnitDisplayLabel(vg.lots[0]?.unitType, settings.language)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span className="font-urdu-sans">خام بکری:</span>
                          <span className="font-bold text-white font-numbers">
                            {formatPKR(vg.grossSales, settings.currencySymbol, settings.language)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span className="font-urdu-sans">کل اخراجات:</span>
                          <span className="font-bold text-rose-400 font-numbers">
                            - {formatPKR(vg.totalExpenses, settings.currencySymbol, settings.language)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-200 border-t border-slate-800 pt-1 mt-1 font-bold">
                          <span className="font-urdu-sans">صافی رقم (پختہ بکری):</span>
                          <span className="text-amber-300 font-numbers">
                            {formatPKR(vg.netPayable, settings.currencySymbol, settings.language)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-numbers">
                        بل نمبر #{101 + idx}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintSingle(vg);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold font-urdu-sans flex items-center gap-1 active:scale-95 transition"
                      >
                        <Printer className="w-3 h-3" />
                        <span>پرنٹ</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. FOOTER SUMMARY BAR */}
        <div className="bg-slate-950 border-t border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-300 font-urdu-sans">
            <span>منتخب: </span>
            <strong className="text-emerald-400 font-numbers font-bold">{selectedCount}</strong>
            <span className="text-slate-500"> / {vendorGroups.length} زمیندار</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrintBatch(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-urdu-sans transition active:scale-95"
            >
              سب پرنٹ کریں ({vendorGroups.length})
            </button>

            <button
              type="button"
              onClick={() => handlePrintBatch(true)}
              disabled={selectedCount === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm font-urdu-sans flex items-center gap-1.5 shadow-md active:scale-95 transition"
            >
              <Printer className="w-4 h-4 stroke-[2.2]" />
              <span>منتخب پرنٹ کریں ({selectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
