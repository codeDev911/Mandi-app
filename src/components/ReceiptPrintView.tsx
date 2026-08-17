import React, { useState } from 'react';
import { VendorLot, AppSettings } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import {
  Printer,
  Share2,
  Copy,
  Check,
  Phone,
  FileText,
  Calendar,
  Truck,
  MapPin,
  User,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Receipt,
} from 'lucide-react';

interface ReceiptPrintViewProps {
  lot: VendorLot;
  lots: VendorLot[];
  onSelectLot: (lotId: string) => void;
  onBackToBolli?: () => void;
  onOpenExpenseSlip?: (lotId: string) => void;
  settings: AppSettings;
}

export const ReceiptPrintView: React.FC<ReceiptPrintViewProps> = ({
  lot,
  lots,
  onSelectLot,
  onBackToBolli,
  onOpenExpenseSlip,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';
  const unitLabel = unitLabels[lot.unitType][settings.language];

  const [isCopied, setIsCopied] = useState(false);

  const handlePrint = () => {
    sound.playTick();
    window.print();
  };

  // Generate WhatsApp message text in Urdu
  const generateWhatsAppMessage = (): string => {
    let msg = `*${settings.shopNameUrdu}*\n`;
    msg += `📍 ${settings.shopAddressUrdu}\n`;
    msg += `📞 فون: ${settings.shopPhone}\n`;
    msg += `--------------------------------\n`;
    msg += `*پکی پرچی آڑھت - بل نمبر:* ${lot.lotNumber}\n`;
    msg += `📅 تاریخ: ${lot.arrivalDate}\n`;
    msg += `👤 زمیندار: ${lot.vendorName} (${lot.vendorCity || ''})\n`;
    msg += `📦 جنس: ${lot.productUrdu} (${lot.totalQuantity} ${unitLabel})\n`;
    if (lot.vehicleNumber) msg += `🚚 گاڑی: ${lot.vehicleNumber}\n`;
    msg += `--------------------------------\n`;
    msg += `*نیلامی / فروخت تفصیل:*\n`;

    lot.sales.forEach((s, idx) => {
      msg += `${idx + 1}. ${s.buyerName}: ${s.quantity} ${unitLabel} @ ${s.ratePerUnit} = ${formatPKR(s.totalAmount, 'Rs.', 'en')}\n`;
    });

    msg += `--------------------------------\n`;
    msg += `*کل ٹوٹل فروخت:* ${formatPKR(lot.summary.grossSales, 'Rs.', 'en')}\n\n`;
    msg += `*اخراجات و کٹوتیاں:*\n`;

    if (lot.expenses.commission.enabled) {
      msg += `• کمیشن: ${formatPKR(lot.expenses.commission.amount, 'Rs.', 'en')}\n`;
    }
    if (lot.expenses.kiraya.enabled) {
      msg += `• کرایہ گاڑی: ${formatPKR(lot.expenses.kiraya.amount, 'Rs.', 'en')}\n`;
    }
    if (lot.expenses.mazdoori.enabled) {
      msg += `• مزدوری: ${formatPKR(lot.expenses.mazdoori.amount, 'Rs.', 'en')}\n`;
    }
    if (lot.expenses.munshiana.enabled) {
      msg += `• منشیانہ: ${formatPKR(lot.expenses.munshiana.amount, 'Rs.', 'en')}\n`;
    }
    if (lot.expenses.naqdAdvance.enabled) {
      msg += `• نقد پیشگی: ${formatPKR(lot.expenses.naqdAdvance.amount, 'Rs.', 'en')}\n`;
    }
    if (lot.expenses.marketFee.enabled) {
      msg += `• مارکیٹ فیس: ${formatPKR(lot.expenses.marketFee.amount, 'Rs.', 'en')}\n`;
    }
    if (lot.expenses.customExpenses) {
      lot.expenses.customExpenses.forEach((ce) => {
        msg += `• ${ce.nameUrdu}: ${formatPKR(ce.amount, 'Rs.', 'en')}\n`;
      });
    }

    msg += `*کل کٹوتی اخراجات:* ${formatPKR(lot.summary.totalExpenses, 'Rs.', 'en')}\n`;
    msg += `================================\n`;
    msg += `*میزان (صافی رقم برائے ادائیگی):* ${formatPKR(lot.summary.netPayableToVendor, 'Rs.', 'en')}\n`;
    msg += `================================\n`;
    msg += `آڑھتی: ${settings.arhtiNameUrdu}\n`;
    msg += `منجانب: ${settings.shopNameUrdu}`;

    return msg;
  };

  const handleShareWhatsApp = () => {
    sound.playTick();
    const text = generateWhatsAppMessage();
    const url = `https://wa.me/${lot.vendorPhone ? lot.vendorPhone.replace(/[^0-9]/g, '') : ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyText = async () => {
    sound.playTick();
    const text = generateWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-4 pb-16 sm:pb-6">
      {/* Top Action Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        {/* Lot Selector & Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          {onBackToBolli && (
            <button
              onClick={onBackToBolli}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 font-urdu-sans border border-slate-300"
            >
              {isUrdu ? <ArrowRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowLeft className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{t.backToBolli}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-700 font-urdu-sans">{t.lotNumber}:</label>
            <select
              value={lot.id}
              onChange={(e) => onSelectLot(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.vendorName} - {l.productUrdu} ({l.lotNumber})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Print / WhatsApp / Copy / Expense Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenExpenseSlip && (
            <button
              onClick={() => onOpenExpenseSlip(lot.id)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans border border-slate-200"
            >
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>{t.tabExpenses}</span>
            </button>
          )}

          <button
            onClick={handleCopyText}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans border border-slate-200"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? t.receiptCopied : t.copyReceipt}</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95 font-urdu-sans"
          >
            <Share2 className="w-4 h-4" />
            <span>{t.shareWhatsApp}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 font-urdu-sans"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>{t.printReceipt}</span>
          </button>
        </div>
      </div>

      {/* Official Mandi Printable Receipt Paper Card */}
      <div className="max-w-2xl mx-auto bg-white rounded-2xl sm:rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden print:border print:shadow-none print:m-0 print:max-w-none print:w-full">
        {/* Receipt Header */}
        <div className="bg-slate-900 text-white p-5 text-center relative overflow-hidden border-b-2 border-slate-950">
          <div className="absolute top-2 right-2 rtl:left-2 rtl:right-auto opacity-15 text-5xl">
            🌾
          </div>
          <div className="inline-block px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[11px] mb-1.5 font-urdu-sans">
            {isUrdu ? 'پکی پرچی آڑھت - سبزی و فروٹ منڈی' : 'Official Mandi Receipt'}
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-urdu-nastaliq tracking-wide text-white">
            {isUrdu ? settings.shopNameUrdu : settings.shopNameEn}
          </h1>
          <p className="text-xs text-slate-300 font-urdu-sans mt-0.5">
            {isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn} • {isUrdu ? settings.shopAddressUrdu : settings.shopAddressEn}
          </p>
          <p className="text-[11px] text-emerald-400 font-numbers mt-0.5">
            فون: {settings.shopPhone}
          </p>
        </div>

        {/* Bill Metadata Grid */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-urdu-sans">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 block">{t.lotNumber}:</span>
              <strong className="font-mono text-slate-900">{lot.lotNumber}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">{t.date}:</span>
              <strong className="font-numbers text-slate-900">{lot.arrivalDate}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">{t.vendor}:</span>
              <strong className="text-slate-900">{lot.vendorName}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">{t.product}:</span>
              <strong className="text-emerald-800">
                {lot.productUrdu} ({lot.totalQuantity} {unitLabel})
              </strong>
            </div>
          </div>

          {(lot.vendorCity || lot.vehicleNumber) && (
            <div className="flex gap-4 mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
              {lot.vendorCity && (
                <span>
                  {t.vendorCity}: <strong>{lot.vendorCity}</strong>
                </span>
              )}
              {lot.vehicleNumber && (
                <span>
                  {t.vehicleNumber}: <strong>{lot.vehicleNumber}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sales Table (Split Bids Breakdown) */}
        <div className="p-4 sm:p-5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 font-urdu-sans border-b border-slate-200 pb-1">
            {isUrdu ? 'تفصیل بولی و فروخت (ٹوٹل)' : 'Auction Split Breakdown (Total)'}
          </h3>

          <table className="w-full text-xs font-urdu-sans border-collapse mb-4">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                <th className="py-2 px-2 text-start">#</th>
                <th className="py-2 px-2 text-start">{t.buyerName}</th>
                <th className="py-2 px-2 text-center">{t.qty}</th>
                <th className="py-2 px-2 text-end">{t.rate}</th>
                <th className="py-2 px-2 text-end">{t.totalAmount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lot.sales.map((sale, idx) => (
                <tr key={sale.id} className="hover:bg-slate-50">
                  <td className="py-2 px-2 font-numbers text-slate-600">{idx + 1}</td>
                  <td className="py-2 px-2 font-bold text-slate-800 font-urdu-nastaliq">{sale.buyerName}</td>
                  <td className="py-2 px-2 text-center font-numbers text-slate-700">{sale.quantity}</td>
                  <td className="py-2 px-2 text-end font-numbers text-slate-700">
                    {formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)}
                  </td>
                  <td className="py-2 px-2 text-end font-bold text-slate-900 font-numbers">
                    {formatPKR(sale.totalAmount, settings.currencySymbol, settings.language)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-600 font-bold">
                <td colSpan={2} className="py-2 px-2 font-urdu-sans text-emerald-950">
                  {t.grossTotal} ({lot.summary.totalSoldQuantity} {unitLabel}):
                </td>
                <td className="py-2 px-2 text-center font-numbers text-emerald-950">
                  {lot.summary.totalSoldQuantity}
                </td>
                <td className="py-2 px-2 text-end"></td>
                <td className="py-2 px-2 text-end text-sm font-black text-emerald-950 font-numbers">
                  {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* 2-Column Deductions and Meezan Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 space-y-2 mb-4">
            <h4 className="text-xs font-bold text-slate-800 font-urdu-sans border-b border-slate-200 pb-1">
              {t.expensesSection} (زمیندار کے اخراجات کی کٹوتی)
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* کمیشن */}
              {lot.expenses.commission.enabled && (
                <div className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-blue-200">
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold text-[11px] font-urdu-nastaliq">
                    {t.commission}
                  </span>
                  <span className="font-bold text-slate-900 font-numbers">
                    {formatPKR(lot.expenses.commission.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {/* کرایہ */}
              {lot.expenses.kiraya.enabled && (
                <div className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-emerald-200">
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[11px] font-urdu-nastaliq">
                    {t.kiraya}
                  </span>
                  <span className="font-bold text-slate-900 font-numbers">
                    {formatPKR(lot.expenses.kiraya.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {/* مزدوری */}
              {lot.expenses.mazdoori.enabled && (
                <div className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-indigo-200">
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[11px] font-urdu-nastaliq">
                    {t.mazdoori}
                  </span>
                  <span className="font-bold text-slate-900 font-numbers">
                    {formatPKR(lot.expenses.mazdoori.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {/* منشیانہ */}
              {lot.expenses.munshiana.enabled && (
                <div className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-sky-200">
                  <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-bold text-[11px] font-urdu-nastaliq">
                    {t.munshiana}
                  </span>
                  <span className="font-bold text-slate-900 font-numbers">
                    {formatPKR(lot.expenses.munshiana.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {/* نقد */}
              {lot.expenses.naqdAdvance.enabled && (
                <div className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-rose-200">
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[11px] font-urdu-nastaliq">
                    {t.naqdAdvance}
                  </span>
                  <span className="font-bold text-slate-900 font-numbers">
                    {formatPKR(lot.expenses.naqdAdvance.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {/* مارکیٹ فیس */}
              {lot.expenses.marketFee.enabled && (
                <div className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-amber-200">
                  <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[11px] font-urdu-nastaliq">
                    {t.marketFee}
                  </span>
                  <span className="font-bold text-slate-900 font-numbers">
                    {formatPKR(lot.expenses.marketFee.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {/* Custom items */}
              {lot.expenses.customExpenses?.map((ce) => (
                <div key={ce.id} className="flex items-center justify-between p-1.5 bg-white rounded-xl border border-slate-200">
                  <span className="px-2 py-0.5 rounded bg-slate-700 text-white font-bold text-[11px] font-urdu-nastaliq">
                    {ce.nameUrdu}
                  </span>
                  <span className="font-bold text-slate-900 font-numbers">
                    {formatPKR(ce.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Deductions Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs font-bold text-slate-800">
              <span className="font-urdu-sans">{t.totalExpenses}:</span>
              <span className="text-rose-600 font-numbers">
                - {formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)}
              </span>
            </div>
          </div>

          {/* FINAL MEEZAN BOX */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-xs mb-6 border border-slate-800">
            <div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-sm font-urdu-nastaliq inline-block mb-1">
                {t.meezan} (صافی رقم)
              </span>
              <span className="text-xs text-slate-300 block font-urdu-sans">
                {isUrdu ? 'زمیندار کو قابلِ ادا رقم' : 'Net payable to vendor'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-300 font-numbers tracking-tight">
              {formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}
            </div>
          </div>

          {/* Signatures & Stamp Box */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-dashed border-slate-300 text-center text-xs font-urdu-sans">
            <div>
              <div className="h-10 border-b border-slate-400 mb-1"></div>
              <span className="text-slate-600">{isUrdu ? 'دستخط منشی / کیشیئر' : "Munshi's Signature"}</span>
            </div>
            <div>
              <div className="h-10 border-b border-slate-400 mb-1"></div>
              <span className="text-slate-600">{isUrdu ? 'دستخط آڑھتی / مہر' : "Arhti's Stamp & Signature"}</span>
            </div>
          </div>
        </div>

        {/* Bottom Footer Note */}
        <div className="bg-slate-100 p-2.5 text-center text-[10px] text-slate-500 border-t border-slate-200 font-urdu-sans">
          {isUrdu
            ? 'کسی بھی قسم کے تنازعے کی صورت میں منڈی کمیٹی کا فیصلہ حتمی ہوگا۔ شکریہ!'
            : 'Generated by Mandi Bolli & Commission Manager. Thank you!'}
        </div>
      </div>
    </div>
  );
};
