import React, { useState } from 'react';
import { VendorLot, PaymentStatus, AppSettings, CustomerBuyer } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { Gavel, Check, X, Plus, Minus, CreditCard, Banknote, User, Phone, BookmarkCheck } from 'lucide-react';

interface AddBidSaleModalProps {
  lot: VendorLot;
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onAddSale: (saleData: {
    buyerName: string;
    buyerPhone?: string;
    quantity: number;
    ratePerUnit: number;
    paymentStatus: PaymentStatus;
    notes?: string;
  }) => void;
  recentBuyers: string[];
  customers?: CustomerBuyer[];
  onSaveCustomer?: (cust: CustomerBuyer) => void;
}

export const AddBidSaleModal: React.FC<AddBidSaleModalProps> = ({
  lot,
  settings,
  isOpen,
  onClose,
  onAddSale,
  recentBuyers,
  customers = [],
  onSaveCustomer,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';
  const unitLabel = unitLabels[lot.unitType][settings.language];

  const maxAvailable = lot.summary.remainingQuantity;

  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [saveCustomerToDb, setSaveCustomerToDb] = useState(true);
  const [quantity, setQuantity] = useState<number>(Math.min(maxAvailable, 1));
  const [ratePerUnit, setRatePerUnit] = useState<number>(
    lot.sales.length > 0 ? lot.sales[lot.sales.length - 1].ratePerUnit : 2500
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalAmount = quantity * ratePerUnit;

  const handleAdjustQuantity = (delta: number) => {
    sound.playTick();
    const newQty = Math.max(1, Math.min(maxAvailable, quantity + delta));
    setQuantity(newQty);
  };

  const handleAdjustRate = (delta: number) => {
    sound.playTick();
    const newRate = Math.max(0, ratePerUnit + delta);
    setRatePerUnit(newRate);
  };

  const defaultWalkIn = isUrdu ? 'عام گاہک (Walk-in)' : 'Walk-in Customer';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawName = buyerName.trim();
    const finalBuyerName = rawName || defaultWalkIn;

    if (quantity <= 0 || quantity > maxAvailable) {
      setError(
        isUrdu
          ? `تعداد ۱ سے ${maxAvailable} کے درمیان ہونی چاہیے`
          : `Quantity must be between 1 and ${maxAvailable}`
      );
      return;
    }
    if (ratePerUnit <= 0) {
      setError(isUrdu ? 'براہ کرم بولی کا ریٹ درج کریں' : 'Please enter valid rate');
      return;
    }

    // Save customer to directory if checkbox is checked and name is not walk-in
    if (saveCustomerToDb && onSaveCustomer && rawName && rawName !== defaultWalkIn) {
      onSaveCustomer({
        id: `cust-${Date.now()}`,
        name: rawName,
        phone: buyerPhone.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    }

    sound.playBidSound();
    onAddSale({
      buyerName: finalBuyerName,
      buyerPhone: buyerPhone.trim() || undefined,
      quantity,
      ratePerUnit,
      paymentStatus,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const handleSelectCustomer = (cust: CustomerBuyer | { name: string; phone?: string }) => {
    sound.playTick();
    setBuyerName(cust.name);
    if (cust.phone) setBuyerPhone(cust.phone);
    setError(null);
  };

  const customerNames = customers.map((c) => c.name);
  const frequentBuyers = [
    ...new Set([
      ...customerNames,
      ...recentBuyers,
      'طارق سبزی فروش',
      'ملک انور ہوتھول سیلر',
      'بلال سبزی فروش',
      'عمران ہوٹل سپلائر',
      'شاہد برادران',
    ]),
  ].slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-5 duration-200">
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden"></div>

        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Gavel className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base font-urdu-nastaliq text-white">{t.addBidSale}</h3>
              <p className="text-[11px] sm:text-xs text-slate-300 font-urdu-sans">
                {lot.productUrdu} • {maxAvailable} {unitLabel} {t.remainingQuantity}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-urdu-sans">
              {error}
            </div>
          )}

          {/* Buyer Name & Frequent Chips */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 font-urdu-sans">
                {t.buyerName} <span className="text-slate-400 font-normal">({isUrdu ? 'اختیاری - ڈیفالٹ: عام گاہک' : 'Optional - Default: Walk-in'})</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setBuyerName(defaultWalkIn);
                  setError(null);
                }}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold font-urdu-sans"
              >
                +{t.walkInCustomer}
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={buyerName}
                onChange={(e) => {
                  setBuyerName(e.target.value);
                  setError(null);
                }}
                placeholder={isUrdu ? 'عام گاہک (Walk-in) یا نام درج کریں...' : 'Walk-in Customer or enter name...'}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-urdu-sans transition"
                autoFocus
              />
              <User className="w-4 h-4 text-slate-400 absolute right-3 rtl:left-3 rtl:right-auto top-3" />
            </div>

            {/* Optional Phone Number if named buyer */}
            {buyerName && buyerName !== defaultWalkIn && (
              <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                <div className="relative flex-1">
                  <input
                    type="tel"
                    inputMode="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder={isUrdu ? 'گاہک کا فون نمبر (اختیاری)' : 'Buyer phone (optional)'}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-numbers"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 rtl:left-2.5 rtl:right-auto top-2.5" />
                </div>

                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-urdu-sans select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={saveCustomerToDb}
                    onChange={(e) => setSaveCustomerToDb(e.target.checked)}
                    className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-medium">{t.saveCustomerToDb}</span>
                </label>
              </div>
            )}

            {/* Quick Buyer Chips */}
            <div>
              <span className="text-[10px] text-slate-500 font-urdu-sans block mb-1">
                {isUrdu ? 'مستقل گاہک منتخب کریں:' : 'Quick Select Buyer:'}
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => {
                    setBuyerName(defaultWalkIn);
                    setBuyerPhone('');
                    setError(null);
                  }}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] transition font-urdu-sans border flex-shrink-0 ${
                    buyerName === defaultWalkIn || !buyerName
                      ? 'bg-slate-900 text-white font-bold border-slate-900 shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  🛒 {isUrdu ? 'عام گاہک (نقد)' : 'Walk-in'}
                </button>
                {frequentBuyers.map((name) => {
                  const matchingCust = customers.find((c) => c.name === name);
                  const isSelected = buyerName === name;
                  return (
                    <button
                      type="button"
                      key={name}
                      onClick={() => handleSelectCustomer(matchingCust || { name })}
                      className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] transition font-urdu-sans border flex-shrink-0 ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs'
                          : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      +{name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quantity Selector with Steppers & Quick Max */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 font-urdu-sans">
                {t.buyQuantity} ({unitLabel})
              </label>
              <span className="text-xs text-slate-500 font-urdu-sans">
                {t.remainingQuantity}: <strong className="text-emerald-700 font-numbers">{maxAvailable}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustQuantity(-1)}
                disabled={quantity <= 1}
                className="w-11 h-11 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 font-bold flex items-center justify-center text-lg active:scale-95 transition flex-shrink-0"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="number"
                inputMode="numeric"
                min="1"
                max={maxAvailable}
                value={quantity}
                onChange={(e) => {
                  const val = parseNumber(e.target.value);
                  setQuantity(Math.max(1, Math.min(maxAvailable, val)));
                }}
                className="flex-1 text-center py-2 bg-white border border-slate-300 rounded-xl font-bold text-lg text-slate-900 font-numbers focus:ring-2 focus:ring-emerald-500"
              />

              <button
                type="button"
                onClick={() => handleAdjustQuantity(1)}
                disabled={quantity >= maxAvailable}
                className="w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold flex items-center justify-center text-lg active:scale-95 transition flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Quantity Buttons */}
            <div className="flex gap-1.5 mt-2">
              {[1, 2, 3, 5, 10].filter((q) => q <= maxAvailable).map((q) => (
                <button
                  type="button"
                  key={q}
                  onClick={() => setQuantity(q)}
                  className={`flex-1 py-1 rounded-lg text-xs font-semibold font-numbers transition ${
                    quantity === q
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {q}
                </button>
              ))}
              {maxAvailable > 1 && (
                <button
                  type="button"
                  onClick={() => setQuantity(maxAvailable)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 font-urdu-sans transition flex-shrink-0"
                >
                  {isUrdu ? 'سب باقی' : 'All'} ({maxAvailable})
                </button>
              )}
            </div>
          </div>

          {/* Rate Per Unit with Quick +/- Adjustments */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 font-urdu-sans">
                {t.bidRate} (فی {unitLabel})
              </label>
              <span className="text-xs text-emerald-800 font-semibold font-numbers">
                {formatPKR(ratePerUnit, settings.currencySymbol, settings.language)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleAdjustRate(-50)}
                className="px-2 sm:px-2.5 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs active:scale-95 font-numbers transition"
              >
                -50
              </button>
              <button
                type="button"
                onClick={() => handleAdjustRate(-100)}
                className="px-2 sm:px-2.5 h-10 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs active:scale-95 font-numbers transition"
              >
                -100
              </button>

              <input
                type="number"
                inputMode="decimal"
                step="50"
                value={ratePerUnit}
                onChange={(e) => setRatePerUnit(parseNumber(e.target.value))}
                className="flex-1 min-w-[70px] text-center py-2 bg-white border border-slate-300 rounded-xl font-bold text-base sm:text-lg text-slate-900 font-numbers focus:ring-2 focus:ring-emerald-500"
              />

              <button
                type="button"
                onClick={() => handleAdjustRate(100)}
                className="px-2 sm:px-2.5 h-10 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold text-xs active:scale-95 font-numbers transition"
              >
                +100
              </button>
              <button
                type="button"
                onClick={() => handleAdjustRate(500)}
                className="px-2 sm:px-2.5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs active:scale-95 font-numbers transition"
              >
                +500
              </button>
            </div>
          </div>

          {/* Payment Status (Cash vs Udhaar/Credit) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 font-urdu-sans">
              {t.paymentType}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentStatus('cash')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition active:scale-95 ${
                  paymentStatus === 'cash'
                    ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span className="text-xs font-urdu-sans">{t.paymentCash}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatus('credit')}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition active:scale-95 ${
                  paymentStatus === 'credit'
                    ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-xs font-urdu-sans">{t.paymentCredit}</span>
              </button>
            </div>
          </div>

          {/* Calculated Subtotal Card */}
          <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl flex items-center justify-between border border-slate-800 shadow-xs">
            <div>
              <span className="text-xs text-slate-300 font-urdu-sans">{t.totalAmount}:</span>
              <p className="text-[11px] sm:text-xs text-slate-400 font-urdu-sans font-numbers">
                {quantity} {unitLabel} × {formatPKR(ratePerUnit, settings.currencySymbol, settings.language)}
              </p>
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-300 font-numbers">
              {formatPKR(totalAmount, settings.currencySymbol, settings.language)}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex gap-2 sm:gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold text-xs sm:text-sm hover:bg-slate-100 transition font-urdu-sans"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 font-urdu-sans"
          >
            <Check className="w-4 h-4" />
            <span>{t.confirmSale}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
