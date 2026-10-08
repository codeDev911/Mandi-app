import React, { useState, useMemo } from 'react';
import { VendorLot, BolliSale, AppSettings, PaymentStatus, CustomerBuyer } from '../types';
import { translations, unitLabels, getUnitDisplayLabel } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import { getLotReceiptNumber } from '../utils/calculations';
import confetti from 'canvas-confetti';
import { AddBidSaleModal } from './AddBidSaleModal';
import { AllLotsModal } from './AllLotsModal';
import { PinPromptModal } from './PinPromptModal';
import {
  Gavel,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Truck,
  MapPin,
  Calendar,
  Banknote,
  Receipt,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  LayoutGrid,
  Layers,
} from 'lucide-react';

interface BolliRoomViewProps {
  lots: VendorLot[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
  onAddSaleToLot: (
    lotId: string,
    saleData: {
      buyerName: string;
      buyerPhone?: string;
      quantity: number;
      ratePerUnit: number;
      paymentStatus: PaymentStatus;
      notes?: string;
    }
  ) => void;
  onDeleteSale: (lotId: string, saleId: string) => void;
  onDeleteLot?: (lotId: string) => void;
  onMarkLotCompleted: (lotId: string) => void;
  onReopenLot: (lotId: string) => void;
  onOpenExpenseSlip: (lotId: string) => void;
  onOpenReceipt: (lotId: string) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onOpenNewLot: () => void;
  settings: AppSettings;
  customers?: CustomerBuyer[];
  onSaveCustomer?: (cust: CustomerBuyer) => void;
}

export const BolliRoomView: React.FC<BolliRoomViewProps> = ({
  lots,
  selectedLotId,
  onSelectLot,
  onAddSaleToLot,
  onDeleteSale,
  onDeleteLot,
  onMarkLotCompleted,
  onReopenLot,
  onOpenExpenseSlip,
  onOpenReceipt,
  onToggleVendorPaymentStatus,
  onOpenNewLot,
  settings,
  customers = [],
  onSaveCustomer,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [isAddBidOpen, setIsAddBidOpen] = useState(false);
  const [isAllLotsOpen, setIsAllLotsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'active' | 'completed' | 'all'>('active');
  const [pendingDeleteSale, setPendingDeleteSale] = useState<{ lotId: string; saleId: string; description: string } | null>(null);
  const [pendingDeleteLot, setPendingDeleteLot] = useState<{ lotId: string; description: string } | null>(null);

  const selectedLot = lots.find((l) => l.id === selectedLotId) || lots[0];

  const filteredLots = lots.filter((lot) => {
    if (filterTab === 'active') return lot.status === 'active';
    if (filterTab === 'completed') return lot.status === 'completed';
    return true;
  });

  // Display top 4 lots in the quick switcher row
  const displayedLots = useMemo(() => {
    if (filteredLots.length <= 4) return filteredLots;
    const top4 = filteredLots.slice(0, 4);
    if (
      selectedLot &&
      filteredLots.some((l) => l.id === selectedLot.id) &&
      !top4.some((l) => l.id === selectedLot.id)
    ) {
      return [selectedLot, ...top4.slice(0, 3)];
    }
    return top4;
  }, [filteredLots, selectedLot]);

  const recentBuyers = Array.from(
    new Set(
      lots
        .flatMap((l) => l.sales)
        .map((s) => s.buyerName)
        .filter(Boolean)
    )
  );

  const handleSaleAdded = (saleData: {
    buyerName: string;
    buyerPhone?: string;
    quantity: number;
    ratePerUnit: number;
    paymentStatus: PaymentStatus;
    notes?: string;
  }) => {
    if (!selectedLot) return;
    onAddSaleToLot(selectedLot.id, saleData);

    // If this sale completely finishes the lot, trigger confetti!
    if (selectedLot.summary.remainingQuantity - saleData.quantity <= 0) {
      sound.playCashChime();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  if (lots.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center bg-white rounded-2xl border border-slate-200 shadow-xs mt-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3 text-3xl">
          📦
        </div>
        <h3 className="text-lg font-bold text-slate-800 font-urdu-nastaliq mb-1">
          {isUrdu ? 'ابھی کوئی مال درج نہیں ہے' : 'No lots recorded yet'}
        </h3>
        <p className="text-xs text-slate-500 font-urdu-sans mb-4">
          {isUrdu
            ? 'زمیندار سے آنے والے مال (کریٹ، بوری، تھیلی) کا اندراج کریں اور بولی شروع کریں۔'
            : 'Record incoming vendor crates/bags and start the live auction.'}
        </p>
        <button
          onClick={onOpenNewLot}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition flex items-center gap-2 mx-auto font-urdu-sans shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t.newLot}</span>
        </button>
      </div>
    );
  }

  const unitLabel = selectedLot ? getUnitDisplayLabel(selectedLot.unitType, settings.language) : '';

  return (
    <div className="space-y-4 pb-16 sm:pb-6">
      {/* Full-Width New Lot Entry Button at Top of Bolli Page */}
      <button
        type="button"
        onClick={() => {
          sound.playTick();
          onOpenNewLot();
        }}
        className="w-full py-3 sm:py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 font-urdu-sans border border-emerald-500/80 group"
      >
        <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-white group-hover:rotate-90 transition-transform duration-300">
          <Plus className="w-4 h-4 stroke-[3]" />
        </div>
        <span className="text-sm sm:text-base font-extrabold tracking-wide">
          {t.newLot} ({isUrdu ? 'نئی گاڑی / مال آمد اندراج' : 'New Vendor Lot Entry'})
        </span>
      </button>

      {/* Lots Selection Carousel / Horizontal Pills */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar">
            <button
              onClick={() => {
                sound.playTick();
                setFilterTab('active');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
                filterTab === 'active'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.activeLots} ({lots.filter((l) => l.status === 'active').length})
            </button>
            <button
              onClick={() => {
                sound.playTick();
                setFilterTab('completed');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition ${
                filterTab === 'completed'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.completedLots} ({lots.filter((l) => l.status === 'completed').length})
            </button>
          </div>
        </div>

        {/* Scrollable Lot Cards */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar items-stretch">
          {displayedLots.map((lot) => {
            const isSelected = selectedLot && selectedLot.id === lot.id;
            const isCompleted = lot.status === 'completed' || lot.summary.remainingQuantity === 0;

            return (
              <button
                key={lot.id}
                onClick={() => {
                  sound.playTick();
                  onSelectLot(lot.id);
                }}
                className={`flex-shrink-0 text-start p-3 rounded-xl border transition min-w-[200px] max-w-[240px] relative ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{lot.productEmoji}</span>
                    <span
                      className="text-[10px] font-mono px-1 py-0.2 rounded bg-white text-slate-700 border border-slate-200 font-numbers font-bold"
                      title={`لاٹ ID: ${lot.lotNumber}`}
                    >
                      #{getLotReceiptNumber(lot.lotNumber)}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-numbers ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {isCompleted ? (isUrdu ? 'مکمل' : 'Done') : `${lot.summary.remainingQuantity} باقی`}
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-900 truncate font-urdu-nastaliq">
                  {lot.vendorName}
                </div>
                <div className="text-[11px] text-slate-600 truncate font-urdu-sans">
                  {lot.productUrdu} ({lot.totalQuantity} {getUnitDisplayLabel(lot.unitType, settings.language)})
                </div>

                {/* Micro progress bar */}
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${lot.summary.percentSold}%` }}
                  />
                </div>
              </button>
            );
          })}

          {/* "View All" Button Card after showing 4 lots */}
          {lots.length > 4 && (
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setIsAllLotsOpen(true);
              }}
              className="flex-shrink-0 min-w-[150px] max-w-[180px] p-3 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-900 transition flex flex-col items-center justify-center gap-1.5 text-center group active:scale-95 cursor-pointer shadow-2xs"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div className="font-bold text-xs font-urdu-nastaliq text-emerald-950">
                {isUrdu ? 'تمام لاٹس دیکھیں' : 'View All Lots'}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-bold font-numbers">
                {lots.length} {isUrdu ? 'کل مال' : 'Total'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Selected Lot Bolli Auction Canvas */}
      {selectedLot && (
        <div className="space-y-3">
          {/* Vendor & Product Banner Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 flex items-center justify-center text-2xl flex-shrink-0">
                  {selectedLot.productEmoji}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 font-urdu-nastaliq">
                      {selectedLot.vendorName}
                    </h2>
                    <span
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-numbers"
                      title={`لاٹ ID: ${selectedLot.lotNumber}`}
                    >
                      رسید #{getLotReceiptNumber(selectedLot.lotNumber)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-urdu-sans flex items-center flex-wrap gap-2 mt-0.5">
                    <span className="font-semibold text-emerald-800">{selectedLot.productUrdu}</span>
                    {selectedLot.vendorCity && (
                      <span className="flex items-center gap-0.5 text-slate-500">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {selectedLot.vendorCity}
                      </span>
                    )}
                    {selectedLot.vehicleNumber && (
                      <span className="flex items-center gap-0.5 text-slate-500">
                        <Truck className="w-3 h-3 text-slate-400" />
                        {selectedLot.vehicleNumber}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Status Badge & Direct Fast Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {onToggleVendorPaymentStatus && (
                  <button
                    onClick={() => {
                      sound.playTick();
                      onToggleVendorPaymentStatus(selectedLot.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
                      selectedLot.vendorPaymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                        : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                    }`}
                    title={
                      selectedLot.vendorPaymentStatus === 'paid'
                        ? 'ادائیگی ہو چکی ہے - کلک کر کے بقایا کریں'
                        : 'ادائیگی بقایا ہے - کلک کر کے ادا شدہ کریں'
                    }
                  >
                    {selectedLot.vendorPaymentStatus === 'paid' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                    )}
                    <span>
                      {selectedLot.vendorPaymentStatus === 'paid'
                        ? (isUrdu ? 'ادا شدہ (Paid)' : 'Paid')
                        : (isUrdu ? 'ادائیگی بقایا (Pending)' : 'Pending')}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => onOpenExpenseSlip(selectedLot.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 font-urdu-sans"
                  title="زمیندار کی اخراجات پرچی و کٹوتیاں"
                >
                  <Receipt className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isUrdu ? 'اخراجات پرچی' : 'Slip Expenses'}</span>
                </button>

                <button
                  onClick={() => onOpenReceipt(selectedLot.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 font-urdu-sans"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t.tabReceipt}</span>
                </button>

                {onDeleteLot && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playTick();
                      setPendingDeleteLot({
                        lotId: selectedLot.id,
                        description: isUrdu
                          ? `لاٹ ریکارڈ حذف کریں: #${getLotReceiptNumber(selectedLot.lotNumber)} - ${selectedLot.vendorName} (${selectedLot.productUrdu})`
                          : `Delete Lot Record: #${getLotReceiptNumber(selectedLot.lotNumber)} - ${selectedLot.vendorName}`,
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 border border-rose-200 font-urdu-sans active:scale-95 cursor-pointer"
                    title={isUrdu ? 'لاٹ حذف کریں' : 'Delete Lot'}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>{isUrdu ? 'لاٹ حذف' : 'Delete Lot'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Auction Statistics Grid (Geometric Balance Style Metric Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-urdu-sans block mb-0.5">{t.totalQuantity}</span>
                <span className="text-lg font-bold text-slate-900 font-numbers">
                  {selectedLot.totalQuantity} <span className="text-xs font-normal font-urdu-sans">{unitLabel}</span>
                </span>
              </div>

              <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider font-urdu-sans block mb-0.5">{t.soldQuantity}</span>
                <span className="text-lg font-bold text-blue-900 font-numbers">
                  {selectedLot.summary.totalSoldQuantity} <span className="text-xs font-normal font-urdu-sans">{unitLabel}</span>
                </span>
              </div>

              <div
                className={`p-3 rounded-2xl border ${
                  selectedLot.summary.remainingQuantity > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-slate-100 border-slate-200'
                }`}
              >
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider font-urdu-sans block mb-0.5">{t.remainingQuantity}</span>
                <span className="text-lg font-bold text-amber-900 font-numbers">
                  {selectedLot.summary.remainingQuantity} <span className="text-xs font-normal font-urdu-sans">{unitLabel}</span>
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 ring-2 ring-emerald-500/80 ring-offset-1 p-3 rounded-2xl">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-urdu-sans block mb-0.5">{t.grossTotal}</span>
                <span className="text-lg font-bold text-emerald-950 font-numbers">
                  {formatPKR(selectedLot.summary.grossSales, settings.currencySymbol, settings.language)}
                </span>
              </div>
            </div>

            {/* Auction Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-urdu-sans">
                <span className="font-semibold">{t.bolliProgress}</span>
                <span className="font-numbers font-semibold">
                  {selectedLot.summary.percentSold}% ({selectedLot.summary.totalSoldQuantity}/{selectedLot.totalQuantity} {unitLabel})
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${selectedLot.summary.percentSold}%` }}
                />
              </div>
            </div>
          </div>

          {/* Auction Bidding CTA Banner */}
          <div className="bg-slate-900 rounded-2xl text-white p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-800">
            <div className="flex items-center gap-3.5 text-center sm:text-start">
              <div className="w-11 h-11 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xl shadow-xs">
                <Gavel className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base font-urdu-nastaliq text-white">
                  {selectedLot.summary.remainingQuantity > 0
                    ? isUrdu
                      ? 'بولی جاری ہے! اگلا خریدار درج کریں'
                      : 'Auction in progress! Record buyer bid'
                    : isUrdu
                    ? 'ماشاءاللہ! تمام مال نیلام ہو گیا ہے'
                    : '100% Sold Out! All bids completed'}
                </h3>
                <p className="text-xs text-slate-300 font-urdu-sans">
                  {selectedLot.summary.remainingQuantity > 0
                    ? isUrdu
                      ? `باقی ${selectedLot.summary.remainingQuantity} ${unitLabel} کے لیے خریدار کی تعداد اور ریٹ درج کریں۔`
                      : `Enter buyer name, quantity and rate for remaining ${selectedLot.summary.remainingQuantity} ${unitLabel}.`
                    : isUrdu
                    ? 'اب اخراجات پرچی چیک کریں اور پکی رسید پرنٹ کریں۔'
                    : 'Review Mandi expense slip and print receipt.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {selectedLot.summary.remainingQuantity > 0 ? (
                <button
                  onClick={() => setIsAddBidOpen(true)}
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm active:scale-95 font-urdu-sans"
                >
                  <Gavel className="w-4 h-4" />
                  <span>{t.addBidSale}</span>
                </button>
              ) : (
                <button
                  onClick={() => onOpenExpenseSlip(selectedLot.id)}
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm active:scale-95 font-urdu-sans"
                  title="مکمل مال فروخت ہو گیا - اخراجات پرچی و میزان دیکھیں"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{isUrdu ? 'اخراجات پرچی و میزان' : 'Slip Expenses & Meezan'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sales Breakdown / Split Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm text-slate-800 font-urdu-sans flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>{t.salesList} ({selectedLot.sales.length} {isUrdu ? 'خریداریاں' : 'Bids'})</span>
              </h3>
              {selectedLot.sales.length > 0 && (
                <span className="text-xs font-bold text-emerald-800 font-numbers bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  {t.grossTotal}: {formatPKR(selectedLot.summary.grossSales, settings.currencySymbol, settings.language)}
                </span>
              )}
            </div>

            {selectedLot.sales.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Gavel className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-urdu-sans">{t.noSalesYet}</p>
                <button
                  onClick={() => setIsAddBidOpen(true)}
                  className="mt-3 text-xs text-emerald-700 font-bold underline font-urdu-sans"
                >
                  + {t.addBidSale}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedLot.sales.map((sale, index) => {
                  const isCash = sale.paymentStatus === 'cash';
                  return (
                    <div
                      key={sale.id}
                      className="p-3 sm:p-4 hover:bg-slate-50/70 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center font-numbers flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq truncate">
                              {sale.buyerName}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-urdu-sans font-bold ${
                                isCash
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {isCash ? t.paymentCash : t.paymentCredit}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-urdu-sans font-numbers flex items-center gap-2 mt-0.5">
                            <span>
                              <strong>{sale.quantity}</strong> {unitLabel} @{' '}
                              <strong>{formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)}</strong>
                            </span>
                            {sale.notes && <span className="text-[11px] text-slate-400 truncate">({sale.notes})</span>}
                          </p>
                        </div>
                      </div>

                      {/* Sale Subtotal & Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-end">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 font-numbers block">
                            {formatPKR(sale.totalAmount, settings.currencySymbol, settings.language)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            sound.playTick();
                            setPendingDeleteSale({
                              lotId: selectedLot.id,
                              saleId: sale.id,
                              description: isUrdu
                                ? `بولی حذف کریں: ${sale.buyerName} (${sale.quantity} ${unitLabel} @ ${formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)})`
                                : `Delete bid: ${sale.buyerName} (${sale.quantity} ${unitLabel})`,
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title={t.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Bid Sale Modal */}
      {selectedLot && (
        <AddBidSaleModal
          lot={selectedLot}
          settings={settings}
          isOpen={isAddBidOpen}
          onClose={() => setIsAddBidOpen(false)}
          onAddSale={handleSaleAdded}
          recentBuyers={recentBuyers}
          customers={customers}
          onSaveCustomer={onSaveCustomer}
        />
      )}

      {/* All Lots Directory Modal */}
      {isAllLotsOpen && (
        <AllLotsModal
          lots={lots}
          selectedLotId={selectedLot ? selectedLot.id : ''}
          onSelectLot={onSelectLot}
          onOpenNewLot={onOpenNewLot}
          onOpenExpenseSlip={onOpenExpenseSlip}
          onOpenReceipt={onOpenReceipt}
          onDeleteLot={onDeleteLot}
          onClose={() => setIsAllLotsOpen(false)}
          settings={settings}
        />
      )}

      {/* PinPromptModal for Deleting a Bid / Sale */}
      <PinPromptModal
        isOpen={!!pendingDeleteSale}
        onClose={() => setPendingDeleteSale(null)}
        onSuccess={() => {
          if (pendingDeleteSale) {
            sound.playTrash();
            onDeleteSale(pendingDeleteSale.lotId, pendingDeleteSale.saleId);
            setPendingDeleteSale(null);
          }
        }}
        correctPin={settings.securityPin || '1234'}
        isUrdu={isUrdu}
        title={isUrdu ? 'بولی ریکارڈ حذف کرنے کی تصدیق' : 'Confirm Bid Deletion'}
        itemDescription={pendingDeleteSale?.description}
      />

      {/* PinPromptModal for Deleting a Lot Record */}
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
