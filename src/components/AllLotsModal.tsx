import React, { useState, useMemo, useEffect } from 'react';
import { VendorLot, AppSettings } from '../types';
import { translations, getUnitDisplayLabel } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import { getLotReceiptNumber } from '../utils/calculations';
import { PaginationControls } from './PaginationControls';
import { PinPromptModal } from './PinPromptModal';
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
  ArrowLeft,
  Layers,
  Phone,
  User,
  Boxes,
  Eye,
  Calendar,
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
type ModalViewTab = 'vendors' | 'all_lots';

interface VendorGroup {
  vendorKey: string;
  vendorName: string;
  vendorPhone?: string;
  vendorCity?: string;
  lots: VendorLot[];
  products: { emoji: string; urdu: string; name: string }[];
  totalQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  grossSales: number;
  totalLotsCount: number;
  isFullySold: boolean;
  isFresh: boolean;
  latestArrivalDate: string;
}

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

  // Navigation & View Mode state
  const [viewTab, setViewTab] = useState<ModalViewTab>('vendors');
  const [selectedVendorKey, setSelectedVendorKey] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [pendingDeleteLot, setPendingDeleteLot] = useState<{ lotId: string; description: string } | null>(null);

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

  // Filtered lots based on search, status, and date
  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = lot.vendorName.toLowerCase().includes(q);
        const matchesPhone = lot.vendorPhone ? lot.vendorPhone.includes(q) : false;
        const receiptNo = getLotReceiptNumber(lot.lotNumber);
        const matchesLotNum = lot.lotNumber.toLowerCase().includes(q) || receiptNo.includes(q);
        const matchesProductUrdu = lot.productUrdu.toLowerCase().includes(q);
        const matchesProductName = lot.productName.toLowerCase().includes(q);
        const matchesCity = lot.vendorCity ? lot.vendorCity.toLowerCase().includes(q) : false;
        const matchesVehicle = lot.vehicleNumber ? lot.vehicleNumber.toLowerCase().includes(q) : false;

        if (
          !matchesName &&
          !matchesPhone &&
          !matchesLotNum &&
          !matchesProductUrdu &&
          !matchesProductName &&
          !matchesCity &&
          !matchesVehicle
        ) {
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

  // Group filtered lots by Vendor
  const vendorGroups = useMemo(() => {
    const map = new Map<string, VendorGroup>();

    filteredLots.forEach((lot) => {
      const key = lot.vendorName.trim().toLowerCase();
      let group = map.get(key);
      if (!group) {
        group = {
          vendorKey: key,
          vendorName: lot.vendorName.trim(),
          vendorPhone: lot.vendorPhone?.trim() || undefined,
          vendorCity: lot.vendorCity?.trim() || undefined,
          lots: [],
          products: [],
          totalQuantity: 0,
          soldQuantity: 0,
          remainingQuantity: 0,
          grossSales: 0,
          totalLotsCount: 0,
          isFullySold: true,
          isFresh: true,
          latestArrivalDate: lot.arrivalDate,
        };
        map.set(key, group);
      }

      group.lots.push(lot);
      group.totalQuantity += lot.totalQuantity || 0;
      group.soldQuantity += lot.summary.soldQuantity || 0;
      group.remainingQuantity += lot.summary.remainingQuantity || 0;
      group.grossSales += lot.summary.grossSales || 0;
      group.totalLotsCount += 1;

      if (!group.vendorPhone && lot.vendorPhone) {
        group.vendorPhone = lot.vendorPhone.trim();
      }
      if (!group.vendorCity && lot.vendorCity) {
        group.vendorCity = lot.vendorCity.trim();
      }

      const hasProd = group.products.some(
        (p) => p.urdu.toLowerCase() === lot.productUrdu.toLowerCase()
      );
      if (!hasProd) {
        group.products.push({
          emoji: lot.productEmoji || '📦',
          urdu: lot.productUrdu,
          name: lot.productName,
        });
      }

      if (lot.arrivalDate > group.latestArrivalDate) {
        group.latestArrivalDate = lot.arrivalDate;
      }
    });

    return Array.from(map.values()).map((g) => {
      const isFullySold = g.remainingQuantity === 0;
      const isFresh = g.soldQuantity === 0;
      return {
        ...g,
        isFullySold,
        isFresh,
      };
    });
  }, [filteredLots]);

  // Selected vendor object if a vendor is currently selected
  const activeSelectedVendor = useMemo(() => {
    if (!selectedVendorKey) return null;
    return vendorGroups.find((g) => g.vendorKey === selectedVendorKey) || null;
  }, [selectedVendorKey, vendorGroups]);

  // Pagination for Vendors
  const [vendorPage, setVendorPage] = useState(1);
  const [vendorPageSize, setVendorPageSize] = useState(15);
  const totalVendorPages = Math.ceil(vendorGroups.length / vendorPageSize) || 1;
  const paginatedVendors = useMemo(() => {
    const start = (vendorPage - 1) * vendorPageSize;
    return vendorGroups.slice(start, start + vendorPageSize);
  }, [vendorGroups, vendorPage, vendorPageSize]);

  // Pagination for All Lots (when in flat lots view)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const totalPages = Math.ceil(filteredLots.length / pageSize) || 1;
  const paginatedLots = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLots.slice(start, start + pageSize);
  }, [filteredLots, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setVendorPage(1);
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter, customDate]);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-2 md:p-4 lg:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-[98vw] xl:max-w-7xl 2xl:max-w-[1580px] rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] h-full sm:h-auto animate-in slide-in-from-bottom-5 duration-200">
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden"></div>

        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-lg shadow-xs flex-shrink-0">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold font-urdu-nastaliq text-white">
                  {isUrdu ? 'لاٹس ڈائرکٹری و زمیندار' : 'Produce Lots & Vendors Directory'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold font-numbers border border-emerald-500/30">
                  {vendorGroups.length} {isUrdu ? 'زمیندار' : 'vendors'} / {filteredLots.length} {isUrdu ? 'لاٹس' : 'lots'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-urdu-sans">
                {activeSelectedVendor
                  ? isUrdu
                    ? `${activeSelectedVendor.vendorName} کی تمام لاٹس دیکھیں`
                    : `Viewing lots of ${activeSelectedVendor.vendorName}`
                  : isUrdu
                  ? 'زمیندار منتخب کر کے ان کی لاٹس دیکھیں یا براہ راست تلاش کریں'
                  : 'Select a vendor to inspect their produce lots or search directly'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Tabs (Vendors Table vs All Lots Grid) */}
        <div className="bg-slate-800/90 text-slate-200 px-3.5 py-1.5 flex items-center justify-between gap-2 border-b border-slate-700/60 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setViewTab('vendors');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 cursor-pointer ${
                viewTab === 'vendors' && !selectedVendorKey
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'زمیندار وار جدول' : 'Vendors Table'}</span>
              <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-numbers">
                {vendorGroups.length}
              </span>
            </button>

            {selectedVendorKey && activeSelectedVendor && (
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setViewTab('vendors');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 bg-emerald-700 text-white shadow-xs border border-emerald-500/50 cursor-pointer`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="font-urdu-nastaliq">{activeSelectedVendor.vendorName} کی لاٹس</span>
                <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-numbers">
                  {activeSelectedVendor.lots.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setViewTab('all_lots');
                setSelectedVendorKey(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 cursor-pointer ${
                viewTab === 'all_lots'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'تمام لاٹس گرڈ' : 'All Lots Grid'}</span>
              <span className="px-1.5 py-0.2 rounded-md bg-black/20 text-[10px] font-numbers">
                {filteredLots.length}
              </span>
            </button>
          </div>

          {selectedVendorKey && (
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setSelectedVendorKey(null);
                setViewTab('vendors');
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans text-emerald-300 hover:text-white hover:bg-slate-700/80 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{isUrdu ? 'واپس تمام زمیندار' : 'Back to Vendors'}</span>
            </button>
          )}
        </div>

        {/* Filters & Search Controls */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isUrdu
                  ? 'زمیندار کا نام، فون، شہر، جنس (پروڈکٹ)، یا لاٹ نمبر تلاش کریں...'
                  : 'Search by vendor name, phone, city, product, or lot number...'
              }
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-urdu-sans transition pr-10 rtl:pr-3.5 rtl:pl-10 shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 rtl:right-auto rtl:left-3 top-2.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-9 rtl:right-auto rtl:left-9 top-2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
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
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition cursor-pointer ${
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
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex items-center gap-1 cursor-pointer ${
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
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex items-center gap-1 cursor-pointer ${
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
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex items-center gap-1 cursor-pointer ${
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
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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

        {/* Modal Body Container */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 bg-slate-100/60 scrollbar-none no-scrollbar">
          {/* ============================================================== */}
          {/* VIEW 1: SELECTED VENDOR'S LOTS (Drill-Down View)              */}
          {/* ============================================================== */}
          {viewTab === 'vendors' && activeSelectedVendor ? (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Selected Vendor Banner */}
              <div className="bg-white rounded-2xl p-4 border border-emerald-300/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl flex-shrink-0 border border-emerald-200 shadow-2xs">
                    👨‍🌾
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold font-urdu-nastaliq text-slate-900">
                        {activeSelectedVendor.vendorName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold font-numbers">
                        {activeSelectedVendor.lots.length} {isUrdu ? 'لاٹس' : 'Lots'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 font-urdu-sans mt-1 flex-wrap">
                      {activeSelectedVendor.vendorPhone ? (
                        <span className="flex items-center gap-1 font-numbers text-slate-700 font-semibold">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          {activeSelectedVendor.vendorPhone}
                        </span>
                      ) : (
                        <span className="text-slate-400">{isUrdu ? 'فون درج نہیں' : 'No Phone'}</span>
                      )}

                      {activeSelectedVendor.vendorCity && (
                        <span className="flex items-center gap-1 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-amber-500" />
                          {activeSelectedVendor.vendorCity}
                        </span>
                      )}

                      <span className="text-slate-600">
                        {isUrdu ? 'کل پیٹیاں / تعداد:' : 'Total Qty:'}{' '}
                        <strong className="text-slate-900 font-numbers">
                          {activeSelectedVendor.totalQuantity}
                        </strong>
                      </span>

                      <span className="text-slate-600">
                        {isUrdu ? 'فروخت شدہ:' : 'Sold:'}{' '}
                        <strong className="text-emerald-700 font-numbers">
                          {activeSelectedVendor.soldQuantity} / {activeSelectedVendor.totalQuantity}
                        </strong>
                      </span>

                      <span className="text-slate-600">
                        {isUrdu ? 'کل مالیت:' : 'Gross Value:'}{' '}
                        <strong className="text-slate-900 font-numbers font-bold">
                          {formatPKR(activeSelectedVendor.grossSales, settings.currencySymbol, settings.language)}
                        </strong>
                      </span>
                    </div>

                    {/* Products Tags */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {activeSelectedVendor.products.map((prod, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold"
                        >
                          <span>{prod.emoji}</span>
                          <span className="font-urdu-sans">{prod.urdu}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Back to Vendors button */}
                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setSelectedVendorKey(null);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 font-urdu-sans shadow-xs cursor-pointer flex-shrink-0 w-full md:w-auto justify-center"
                >
                  <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                  <span>{isUrdu ? '← تمام زمینداروں کا جدول' : '← All Vendors Table'}</span>
                </button>
              </div>

              {/* Lots of this selected vendor */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4">
                {activeSelectedVendor.lots.map((lot) => {
                  const isSelected = selectedLotId === lot.id;
                  const unitLabel = getUnitDisplayLabel(lot.unitType, settings.language);
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
                                  {lot.productUrdu}
                                </h4>
                                <span
                                  className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-numbers font-bold flex-shrink-0"
                                  title={`لاٹ ID: ${lot.lotNumber}`}
                                >
                                  #{getLotReceiptNumber(lot.lotNumber)}
                                </span>
                              </div>
                              <p className="text-xs text-emerald-800 font-semibold font-urdu-sans">
                                {lot.totalQuantity} {unitLabel}
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
                          className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 font-urdu-sans shadow-2xs active:scale-95 cursor-pointer ${
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
                          title={isUrdu ? 'اخراجات پرچی و کٹوتیاں' : 'Slip Expenses'}
                          className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 font-urdu-sans border border-slate-200 active:scale-95 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">{isUrdu ? 'اخراجات پرچی' : 'Slip Expenses'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            sound.playTick();
                            onClose();
                            onOpenReceipt(lot.id);
                          }}
                          title={t.tabReceipt}
                          className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 font-urdu-sans border border-slate-200 active:scale-95 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span className="hidden sm:inline">{t.tabReceipt}</span>
                        </button>

                        {onDeleteLot && (
                          <button
                            type="button"
                            onClick={() => {
                              sound.playTick();
                              setPendingDeleteLot({
                                lotId: lot.id,
                                description: isUrdu
                                  ? `لاٹ ریکارڈ حذف کریں: #${lot.lotNumber} - ${lot.vendorName} (${lot.productUrdu})`
                                  : `Delete lot: #${lot.lotNumber} - ${lot.vendorName}`,
                              });
                            }}
                            title={isUrdu ? 'لاٹ حذف کریں' : 'Delete lot'}
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
            </div>
          ) : viewTab === 'vendors' ? (
            /* ============================================================== */
            /* VIEW 2: VENDORS TABLE (DEFAULT PRIMARY VIEW)                   */
            /* ============================================================== */
            <div className="space-y-3 animate-in fade-in duration-150">
              {vendorGroups.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-xl">
                    🔍
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 font-urdu-nastaliq">
                    {isUrdu ? 'کوئی زمیندار یا لاٹس نہیں ملیں' : 'No vendors or lots found'}
                  </h4>
                  <p className="text-xs text-slate-400 font-urdu-sans mt-1">
                    {isUrdu ? 'تلاش یا تاریخ کا فلٹر تبدیل کریں' : 'Try adjusting your search query or date filter'}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white font-urdu-sans border-b border-slate-800 text-[11px] sm:text-xs">
                          <th className="py-3 px-3 sm:px-4 text-start font-bold">
                            {isUrdu ? 'زمیندار کا نام' : 'Vendor Name'}
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-start font-bold">
                            {isUrdu ? 'فون نمبر' : 'Phone'}
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-start font-bold">
                            {isUrdu ? 'اجناس / پروڈکٹس' : 'Products'}
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-center font-bold">
                            {isUrdu ? 'کل لاٹس' : 'Total Lots'}
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-center font-bold">
                            {isUrdu ? 'کل پیٹیاں / تعداد' : 'Total Quantity'}
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-start font-bold">
                            {isUrdu ? 'کل فروخت / مالیت' : 'Gross Value'}
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-start font-bold">
                            {isUrdu ? 'مال کی فروخت' : 'Sale Progress'}
                          </th>
                          <th className="py-3 px-3 sm:px-4 text-center font-bold">
                            {isUrdu ? 'لاٹس دیکھیں' : 'Action (Lots)'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-urdu-sans">
                        {paginatedVendors.map((group) => {
                          const percentSold =
                            group.totalQuantity > 0
                              ? Math.round((group.soldQuantity / group.totalQuantity) * 100)
                              : 0;

                          return (
                            <tr
                              key={group.vendorKey}
                              onClick={() => {
                                sound.playTick();
                                setSelectedVendorKey(group.vendorKey);
                              }}
                              className="hover:bg-emerald-50/50 transition cursor-pointer group"
                            >
                              {/* 1. Vendor Name and City */}
                              <td className="py-3 px-3 sm:px-4 text-start">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                                    👨‍🌾
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 font-urdu-nastaliq text-sm group-hover:text-emerald-700 transition-colors">
                                      {group.vendorName}
                                    </div>
                                    {group.vendorCity && (
                                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-amber-500" />
                                        <span>{group.vendorCity}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* 2. Phone */}
                              <td className="py-3 px-2 sm:px-3 text-start">
                                {group.vendorPhone ? (
                                  <span className="font-numbers text-slate-700 font-medium inline-flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    {group.vendorPhone}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* 3. Products list pills */}
                              <td className="py-3 px-2 sm:px-3 text-start">
                                <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                  {group.products.map((p, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                                    >
                                      <span>{p.emoji}</span>
                                      <span>{p.urdu}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>

                              {/* 4. Total Lots count */}
                              <td className="py-3 px-2 sm:px-3 text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-bold font-numbers text-xs border border-slate-200">
                                  {group.totalLotsCount} {isUrdu ? 'لاٹس' : 'Lots'}
                                </span>
                              </td>

                              {/* 5. Total Quantity */}
                              <td className="py-3 px-2 sm:px-3 text-center">
                                <div className="font-bold font-numbers text-slate-900 text-xs">
                                  {group.totalQuantity}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {isUrdu ? 'کل پیٹیاں / تعداد' : 'Total Items'}
                                </div>
                              </td>

                              {/* 6. Gross Value */}
                              <td className="py-3 px-2 sm:px-3 text-start whitespace-nowrap">
                                <div className="font-bold font-numbers text-slate-900 text-xs">
                                  {formatPKR(group.grossSales, settings.currencySymbol, settings.language)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {isUrdu ? 'مجموعی مالیت' : 'Gross Value'}
                                </div>
                              </td>

                              {/* 7. Sale Progress / Status */}
                              <td className="py-3 px-2 sm:px-3 text-start min-w-[130px]">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span
                                      className={`font-semibold ${
                                        group.isFullySold
                                          ? 'text-emerald-700'
                                          : group.isFresh
                                          ? 'text-amber-700'
                                          : 'text-blue-700'
                                      }`}
                                    >
                                      {group.isFullySold
                                        ? isUrdu
                                          ? 'مکمل فروخت'
                                          : 'Completed'
                                        : group.isFresh
                                        ? isUrdu
                                          ? 'تازہ مال'
                                          : 'Fresh'
                                        : `${group.soldQuantity}/${group.totalQuantity}`}
                                    </span>
                                    <span className="font-numbers font-bold text-slate-700 text-[10px]">
                                      {percentSold}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 rounded-full ${
                                        group.isFullySold ? 'bg-emerald-600' : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${percentSold}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* 7. Action Button: Lots Button */}
                              <td className="py-3 px-3 sm:px-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    sound.playTick();
                                    setSelectedVendorKey(group.vendorKey);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition font-urdu-sans cursor-pointer group-hover:bg-emerald-700"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                  <span>{isUrdu ? 'لاٹس دیکھیں' : 'Lots'}</span>
                                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-800 text-[10px] font-numbers font-bold">
                                    {group.totalLotsCount}
                                  </span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {vendorGroups.length > 0 && (
                <div className="pt-1">
                  <PaginationControls
                    currentPage={vendorPage}
                    totalPages={totalVendorPages}
                    totalItems={vendorGroups.length}
                    pageSize={vendorPageSize}
                    onPageChange={setVendorPage}
                    onPageSizeChange={setVendorPageSize}
                    isUrdu={isUrdu}
                    itemName={isUrdu ? 'زمیندار' : 'vendors'}
                  />
                </div>
              )}
            </div>
          ) : (
            /* ============================================================== */
            /* VIEW 3: ALL LOTS GRID VIEW (Direct flat lots display)          */
            /* ============================================================== */
            <div className="space-y-3 animate-in fade-in duration-150">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4">
                  {paginatedLots.map((lot) => {
                    const isSelected = selectedLotId === lot.id;
                    const unitLabel = getUnitDisplayLabel(lot.unitType, settings.language);
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
                                  <span
                                    className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-numbers font-bold flex-shrink-0"
                                    title={`لاٹ ID: ${lot.lotNumber}`}
                                  >
                                    #{getLotReceiptNumber(lot.lotNumber)}
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
                            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 font-urdu-sans shadow-2xs active:scale-95 cursor-pointer ${
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
                            title={isUrdu ? 'اخراجات پرچی و کٹوتیاں' : 'Slip Expenses'}
                            className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 font-urdu-sans border border-slate-200 active:scale-95 cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden sm:inline">{isUrdu ? 'اخراجات پرچی' : 'Slip Expenses'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              sound.playTick();
                              onClose();
                              onOpenReceipt(lot.id);
                            }}
                            title={t.tabReceipt}
                            className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1 font-urdu-sans border border-slate-200 active:scale-95 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span className="hidden sm:inline">{t.tabReceipt}</span>
                          </button>

                          {onDeleteLot && (
                            <button
                              type="button"
                              onClick={() => {
                                sound.playTick();
                                setPendingDeleteLot({
                                  lotId: lot.id,
                                  description: isUrdu
                                    ? `لاٹ ریکارڈ حذف کریں: #${lot.lotNumber} - ${lot.vendorName} (${lot.productUrdu})`
                                    : `Delete lot: #${lot.lotNumber} - ${lot.vendorName}`,
                                });
                              }}
                              title={isUrdu ? 'لاٹ حذف کریں' : 'Delete lot'}
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

              {filteredLots.length > 0 && (
                <div className="pt-2">
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
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-urdu-sans">
          <div className="flex items-center gap-3">
            {activeSelectedVendor ? (
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setSelectedVendorKey(null);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{isUrdu ? '← تمام زمیندار' : '← All Vendors'}</span>
              </button>
            ) : (
              <span>
                {isUrdu ? 'کل زمیندار:' : 'Total vendors:'}{' '}
                <strong className="text-slate-900 font-numbers">{vendorGroups.length}</strong>
                {' | '}
                {isUrdu ? 'کل لاٹس:' : 'Total lots:'}{' '}
                <strong className="text-slate-900 font-numbers">{lots.length}</strong>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition active:scale-95 font-urdu-sans cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>

      {/* PinPromptModal for Lot Deletion */}
      <PinPromptModal
        isOpen={!!pendingDeleteLot}
        onClose={() => setPendingDeleteLot(null)}
        onSuccess={() => {
          if (pendingDeleteLot && onDeleteLot) {
            sound.playTrash();
            onDeleteLot(pendingDeleteLot.lotId);
            setPendingDeleteLot(null);
          }
        }}
        correctPin={settings.securityPin || '1234'}
        isUrdu={isUrdu}
        title={isUrdu ? 'لاٹ ریکارڈ حذف کرنے کی تصدیق' : 'Confirm Lot Deletion'}
        itemDescription={pendingDeleteLot?.description}
      />
    </div>
  );
};
