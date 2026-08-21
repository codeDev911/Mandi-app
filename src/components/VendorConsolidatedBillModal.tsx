import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { VendorLot, AppSettings } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import { printConsolidatedThermalPOSReceipt, generateVendorConsolidatedInvoiceCanvas } from '../utils/receiptGenerator';
import {
  Printer,
  Copy,
  Check,
  Download,
  Loader2,
  MessageCircle,
  Eye,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';

interface VendorConsolidatedBillModalProps {
  vendorName: string;
  vendorPhone?: string;
  vendorCity?: string;
  lots: VendorLot[];
  dateLabel?: string;
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const VendorConsolidatedBillModal: React.FC<VendorConsolidatedBillModalProps> = ({
  vendorName,
  vendorPhone,
  vendorCity,
  lots,
  dateLabel,
  settings,
  isOpen,
  onClose,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [shareSuccessToast, setShareSuccessToast] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [copiedImageStatus, setCopiedImageStatus] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  if (!isOpen || lots.length === 0) return null;

  // Aggregate totals across all vendor lots
  const totals = lots.reduce(
    (acc, lot) => {
      acc.totalQuantity += lot.totalQuantity;
      acc.totalSoldQuantity += lot.summary.totalSoldQuantity;
      acc.grossSales += lot.summary.grossSales;
      acc.totalExpenses += lot.summary.totalExpenses;
      acc.commission += lot.summary.arhtiProfitCommission;
      acc.netPayable += lot.summary.netPayableToVendor;

      // Payments
      const lotPaid =
        lot.vendorPaymentAmount !== undefined
          ? lot.vendorPaymentAmount
          : lot.vendorPaymentStatus === 'paid'
          ? lot.summary.netPayableToVendor
          : 0;
      acc.totalPaid += lotPaid;

      // Group deductions
      acc.expenses.commission += lot.expenses.commission.enabled ? lot.expenses.commission.amount : 0;
      acc.expenses.kiraya += lot.expenses.kiraya.enabled ? lot.expenses.kiraya.amount : 0;
      acc.expenses.mazdoori += lot.expenses.mazdoori.enabled ? lot.expenses.mazdoori.amount : 0;
      acc.expenses.munshiana += lot.expenses.munshiana.enabled ? lot.expenses.munshiana.amount : 0;
      acc.expenses.naqdAdvance += lot.expenses.naqdAdvance.enabled ? lot.expenses.naqdAdvance.amount : 0;
      acc.expenses.marketFee += lot.expenses.marketFee.enabled ? lot.expenses.marketFee.amount : 0;

      lot.expenses.customExpenses?.forEach((ce) => {
        acc.expenses.customExpensesTotal += ce.amount;
      });

      return acc;
    },
    {
      totalQuantity: 0,
      totalSoldQuantity: 0,
      grossSales: 0,
      totalExpenses: 0,
      commission: 0,
      netPayable: 0,
      totalPaid: 0,
      expenses: {
        commission: 0,
        kiraya: 0,
        mazdoori: 0,
        munshiana: 0,
        naqdAdvance: 0,
        marketFee: 0,
        customExpensesTotal: 0,
      },
    }
  );

  const displayDate = dateLabel || lots[0]?.arrivalDate || new Date().toISOString().slice(0, 10);
  const isFullyPaid = totals.totalPaid >= totals.netPayable && totals.netPayable > 0;

  // Flatten all sales from all lots into single unified line items
  const allProductItems: Array<{
    lotNumber: string;
    productName: string;
    productUrdu: string;
    quantity: number;
    unitLabel: string;
    ratePerUnit: number;
    totalAmount: number;
    buyerName?: string;
  }> = [];

  lots.forEach((lot) => {
    const uLabel = unitLabels[lot.unitType][settings.language];
    if (lot.sales && lot.sales.length > 0) {
      lot.sales.forEach((s) => {
        allProductItems.push({
          lotNumber: lot.lotNumber,
          productName: lot.productName,
          productUrdu: lot.productUrdu,
          quantity: s.quantity,
          unitLabel: uLabel,
          ratePerUnit: s.ratePerUnit,
          totalAmount: s.totalAmount,
          buyerName: s.buyerName,
        });
      });
    } else {
      // If no separate sales rows yet, show the lot as single item
      allProductItems.push({
        lotNumber: lot.lotNumber,
        productName: lot.productName,
        productUrdu: lot.productUrdu,
        quantity: lot.totalQuantity,
        unitLabel: uLabel,
        ratePerUnit: lot.totalQuantity ? Math.round(lot.summary.grossSales / lot.totalQuantity) : 0,
        totalAmount: lot.summary.grossSales,
      });
    }
  });

  // Helper to safely generate PNG DataURL & Blob
  const getReceiptImage = async (): Promise<{ dataUrl: string; blob: Blob }> => {
    if (printableRef.current) {
      try {
        const canvas = await html2canvas(printableRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const dataUrl = canvas.toDataURL('image/png');
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png', 0.95)
        );

        if (blob && dataUrl && dataUrl.length > 500) {
          return { dataUrl, blob };
        }
      } catch (domErr) {
        console.warn('DOM html2canvas fallback to standalone canvas generator:', domErr);
      }
    }

    const directCanvas = generateVendorConsolidatedInvoiceCanvas(
      vendorName,
      vendorPhone,
      vendorCity,
      lots,
      settings,
      displayDate
    );
    const dataUrl = directCanvas.toDataURL('image/png');
    const blob = await new Promise<Blob | null>((resolve) =>
      directCanvas.toBlob((b) => resolve(b), 'image/png', 0.95)
    );

    if (!blob) throw new Error('Image creation failed');
    return { dataUrl, blob };
  };

  const triggerBrowserDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  };

  const handleSaveImage = async () => {
    sound.playCashChime();
    setIsGeneratingImage(true);
    try {
      const { blob } = await getReceiptImage();
      const sanitizedName = vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
      triggerBrowserDownload(blob, `Mandi_Vendor_Bill_${sanitizedName}_${displayDate}.png`);

      setShareSuccessToast(isUrdu ? 'بل کی تصویر محفوظ ہو گئی ہے!' : 'Bill image downloaded!');
      setTimeout(() => setShareSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error saving image:', err);
      setShareSuccessToast(isUrdu ? 'تصویر تیار کرنے میں خرابی ہوئی' : 'Failed to generate image');
      setTimeout(() => setShareSuccessToast(null), 3000);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleShareWhatsApp = async () => {
    sound.playCashChime();
    setIsGeneratingImage(true);

    const productListText = allProductItems
      .map((item, idx) => `${idx + 1}. ${item.productUrdu}: ${item.quantity} ${item.unitLabel} @ Rs.${item.ratePerUnit} = ${formatPKR(item.totalAmount, settings.currencySymbol, settings.language)}`)
      .join('\n');

    const messageText = `*${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}*
📋 *پکی پرچی رسید برائے زمیندار*
━━━━━━━━━━━━━━━━━
👤 *زمیندار:* ${vendorName} ${vendorCity ? `(${vendorCity})` : ''}
📅 *تاریخ:* ${displayDate}

📦 *تفصیلِ فروخت اجناس:*
${productListText}

━━━━━━━━━━━━━━━━━
💰 *مجموعی کل فروخت:* ${formatPKR(totals.grossSales, settings.currencySymbol, settings.language)}
📉 *منہا کٹوتیاں و اخراجات:* -${formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}
━━━━━━━━━━━━━━━━━
💵 *صافی میزان برائے ادائیگی:* *${formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}*
━━━━━━━━━━━━━━━━━
کیفیت: ${isFullyPaid ? '✅ ادا شدہ (PAID)' : '⏳ ادائیگی بقایا (PENDING)'}
📍 ${settings.shopAddressUrdu || settings.shopAddressEn} • 📞 ${settings.shopPhone}`;

    const rawPhone = (vendorPhone || '').replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.startsWith('0') ? '92' + rawPhone.slice(1) : rawPhone;
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    try {
      const { blob } = await getReceiptImage();
      const sanitizedName = vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
      const filename = `Mandi_Vendor_Bill_${sanitizedName}_${displayDate}.png`;

      try {
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          setCopiedImageStatus(true);
          setTimeout(() => setCopiedImageStatus(false), 4000);
        }
      } catch (clipErr) {
        console.warn('Clipboard write image not allowed, downloading fallback:', clipErr);
      }

      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `بل رسید - ${vendorName}`,
          text: messageText,
        });
        setShareSuccessToast(isUrdu ? 'واٹس ایپ پر بل بھیج دیا گیا!' : 'Bill shared successfully!');
        setTimeout(() => setShareSuccessToast(null), 4000);
        return;
      }

      triggerBrowserDownload(blob, filename);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      setShareSuccessToast(
        isUrdu
          ? 'بل تصویر محفوظ ہو گئی ہے اور واٹس ایپ کھل گیا ہے۔'
          : 'Bill downloaded & WhatsApp opened.'
      );
      setTimeout(() => setShareSuccessToast(null), 5000);
    } catch (err) {
      console.error('Share failed, opening text chat fallback:', err);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleOpenPreview = async () => {
    sound.playTick();
    setIsGeneratingImage(true);
    try {
      const { dataUrl } = await getReceiptImage();
      setPreviewImageUrl(dataUrl);
    } catch (err) {
      console.error('Error generating preview:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopyText = () => {
    sound.playTick();
    const text = `*${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}*
پکی پرچی رسید برائے زمیندار - ${vendorName}
تاریخ: ${displayDate}
کل فروخت: ${formatPKR(totals.grossSales, settings.currencySymbol, settings.language)}
کل کٹوتیاں: ${formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}
صافی واجب الادا: ${formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        
        {/* Modal Top Bar */}
        <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base font-urdu-nastaliq text-amber-200">
                {isUrdu ? 'بل پرچی برائے زمیندار' : 'Vendor Bill Slip'}
              </h3>
              <p className="text-[11px] text-slate-400 font-urdu-sans">
                {vendorName} {vendorCity ? `• ${vendorCity}` : ''} • {displayDate}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition active:scale-95"
            title="بند کریں"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="bg-slate-900 border-b border-slate-800 p-2 sm:p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 80mm POS Thermal Print */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                sound.playTick();
                printConsolidatedThermalPOSReceipt(vendorName, vendorPhone, vendorCity, lots, settings, displayDate);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-md border border-amber-400"
              title="80mm تھرمل پرنٹر پر پرچی پرنٹ کریں"
            >
              <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isUrdu ? '🖨️ POS پرنٹ' : '🖨️ POS Print'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPreview}
              disabled={isGeneratingImage}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 border border-slate-700 disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>{isUrdu ? 'پیش نظارہ' : 'Preview'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 border border-slate-700"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isCopied ? t.copied : t.copyText}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveImage}
              disabled={isGeneratingImage}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold font-urdu-sans flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isUrdu ? 'تصویر محفوظ' : 'Save Image'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isGeneratingImage}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs font-urdu-sans flex items-center gap-1.5 shadow-md transition active:scale-95 disabled:opacity-50"
            >
              {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 fill-current" />}
              <span>{isUrdu ? 'واٹس ایپ' : 'WhatsApp'}</span>
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {shareSuccessToast && (
          <div className="bg-emerald-950 border-b border-emerald-600/40 text-emerald-200 px-4 py-2 text-xs font-bold font-urdu-sans flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{shareSuccessToast}</span>
            </div>
            {copiedImageStatus && (
              <span className="text-[11px] px-2 py-0.5 bg-emerald-800 text-white rounded-md font-normal">
                📋 تصویر کاپی ہے
              </span>
            )}
          </div>
        )}

        {/* Scrollable View Area */}
        <div className="p-3 sm:p-5 overflow-y-auto bg-slate-950/40 space-y-4 flex justify-center">
          
          {/* THE SIMPLE VENDOR BILL (ALL PRODUCTS IN ONE TABLE, ALL EXPENSES DIRECTLY BELOW) */}
          <div
            ref={printableRef}
            id="consolidated-mandi-receipt"
            className="w-full max-w-lg bg-white text-slate-900 rounded-xl border border-slate-300 shadow-xl p-5 sm:p-6 space-y-4 font-urdu-sans print:border-none print:shadow-none print:m-0 print:p-2 print:max-w-none print:w-full"
            style={{
              fontFamily: "'Noto Nastaliq Urdu', 'Noto Sans Arabic', Tahoma, sans-serif",
            }}
          >
            {/* Header: Shop Details */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-slate-900">
              <div className="font-urdu-nastaliq text-sm font-bold text-slate-900">
                بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
              </div>

              <h1 className="text-2xl font-black font-urdu-nastaliq text-slate-950 leading-tight">
                {isUrdu ? settings.shopNameUrdu : settings.shopNameEn}
              </h1>

              <p className="text-xs font-semibold text-slate-800">
                پروپرائٹر: <span className="font-bold font-urdu-nastaliq">{isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn}</span>
              </p>

              <p className="text-xs text-slate-600">
                📍 {isUrdu ? settings.shopAddressUrdu : settings.shopAddressEn} • 📞 فون: {settings.shopPhone}
              </p>

              <div className="inline-block mt-2 px-3 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-bold text-slate-900">
                پکی پرچی بل برائے زمیندار (Vendor Bill Slip)
              </div>
            </div>

            {/* Bill Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="text-start">
                <span className="text-[10px] text-slate-500 font-bold block">زمیندار / کاشتکار:</span>
                <strong className="text-slate-950 font-bold font-urdu-nastaliq text-sm block truncate">
                  {vendorName} {vendorCity ? `(${vendorCity})` : ''}
                </strong>
              </div>

              <div className="text-start">
                <span className="text-[10px] text-slate-500 font-bold block">تاریخ حساب:</span>
                <strong className="text-slate-900 font-mono text-xs font-bold block">{displayDate}</strong>
              </div>

              <div className="text-start">
                <span className="text-[10px] text-slate-500 font-bold block">کل اجناس / لاٹس:</span>
                <strong className="text-slate-800 text-xs block">
                  {lots.length} لاٹ • {totals.totalQuantity} کل نگ
                </strong>
              </div>

              <div className="text-start">
                <span className="text-[10px] text-slate-500 font-bold block">رابطہ فون:</span>
                <strong className="text-slate-700 font-mono text-xs block">{vendorPhone || settings.shopPhone}</strong>
              </div>
            </div>

            {/* ONE SINGLE TABLE FOR ALL PRODUCTS */}
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold">
                    <th className="py-2 px-2 text-start w-6">#</th>
                    <th className="py-2 px-2 text-start">تفصیلِ جنس</th>
                    <th className="py-2 px-2 text-center">تعداد (یونٹ)</th>
                    <th className="py-2 px-2 text-end">ریٹ</th>
                    <th className="py-2 px-2.5 text-end">کل رقم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allProductItems.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="py-1.5 px-2 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-bold text-slate-900 font-urdu-nastaliq">
                        {item.productUrdu}
                        <span className="text-[10px] font-normal text-slate-500 block">لاٹ #{item.lotNumber}</span>
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-slate-900">
                        {item.quantity} {item.unitLabel}
                      </td>
                      <td className="py-1.5 px-2 text-end font-mono text-slate-700">
                        Rs.{item.ratePerUnit.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2.5 text-end font-bold text-slate-950 font-mono">
                        {formatPKR(item.totalAmount, '', 'en')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-950">
                    <td colSpan={3} className="py-2 px-2 text-start">
                      مجموعی کل فروخت (Gross Total Sales):
                    </td>
                    <td colSpan={2} className="py-2 px-2.5 text-end font-mono text-sm">
                      {formatPKR(totals.grossSales, settings.currencySymbol, settings.language)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ALL EXPENSES / KATOTE (کٹوتیاں) LISTED DIRECTLY BELOW THE TABLE */}
            <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 text-xs border-b border-rose-200/80 pb-1 flex justify-between items-center">
                <span>منہا کٹوتیاں و اخراجات (Katote):</span>
                <span className="text-rose-700 font-mono font-bold">
                  -{formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-700 text-[11px] pt-1">
                {totals.expenses.commission > 0 && (
                  <div className="flex justify-between">
                    <span>کمیشن (Commission):</span>
                    <span className="font-bold text-slate-900 font-mono">
                      -{formatPKR(totals.expenses.commission, '', 'en')}
                    </span>
                  </div>
                )}

                {totals.expenses.kiraya > 0 && (
                  <div className="flex justify-between">
                    <span>کرایہ گاڑی (Freight):</span>
                    <span className="font-bold text-slate-900 font-mono">
                      -{formatPKR(totals.expenses.kiraya, '', 'en')}
                    </span>
                  </div>
                )}

                {totals.expenses.mazdoori > 0 && (
                  <div className="flex justify-between">
                    <span>مزدوری (Labor):</span>
                    <span className="font-bold text-slate-900 font-mono">
                      -{formatPKR(totals.expenses.mazdoori, '', 'en')}
                    </span>
                  </div>
                )}

                {totals.expenses.munshiana > 0 && (
                  <div className="flex justify-between">
                    <span>منشیانہ (Munshiana):</span>
                    <span className="font-bold text-slate-900 font-mono">
                      -{formatPKR(totals.expenses.munshiana, '', 'en')}
                    </span>
                  </div>
                )}

                {totals.expenses.naqdAdvance > 0 && (
                  <div className="flex justify-between">
                    <span>نقد پیشگی (Advance):</span>
                    <span className="font-bold text-slate-900 font-mono">
                      -{formatPKR(totals.expenses.naqdAdvance, '', 'en')}
                    </span>
                  </div>
                )}

                {totals.expenses.marketFee > 0 && (
                  <div className="flex justify-between">
                    <span>مارکیٹ فیس (Market Fee):</span>
                    <span className="font-bold text-slate-900 font-mono">
                      -{formatPKR(totals.expenses.marketFee, '', 'en')}
                    </span>
                  </div>
                )}

                {totals.expenses.customExpensesTotal > 0 && (
                  <div className="flex justify-between">
                    <span>دیگر اخراجات (Other):</span>
                    <span className="font-bold text-slate-900 font-mono">
                      -{formatPKR(totals.expenses.customExpensesTotal, '', 'en')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* PROMINENT NET PAYABLE BOX (صافی میزان برائے ادائیگی) */}
            <div className="border-2 border-slate-900 rounded-lg p-3 text-center bg-slate-50 space-y-1">
              <div className="text-xs font-bold text-slate-700">
                صافی میزان برائے ادائیگی (Net Payable Amount):
              </div>
              <div className="text-2xl sm:text-3xl font-black font-numbers text-slate-950">
                {formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}
              </div>
            </div>

            {/* Payment Status Badge */}
            <div className="text-center">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                  isFullyPaid
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {isFullyPaid ? '✅ مکمل ادائیگی ہو چکی ہے (PAID)' : '⏳ رقم کی ادائیگی بقایا ہے (PAYMENT PENDING)'}
              </span>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t border-slate-300 flex justify-between items-center text-xs">
              <div className="text-center">
                <div className="w-32 border-b border-slate-400 mb-1"></div>
                <span className="font-bold text-slate-700">دستخط منشی / کیشیئر</span>
              </div>

              <div className="text-center">
                <div className="w-32 border-b border-slate-400 mb-1"></div>
                <span className="font-bold text-slate-700">دستخط و مہر آڑھتی</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-1 font-mono">
              Computerized Vendor Bill • Mandi Munshi POS
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-4 max-w-lg w-full flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-white">
              <h4 className="font-bold text-sm font-urdu-sans">تصویر کا پیش نظارہ</h4>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto my-3 flex justify-center bg-slate-950 p-2 rounded-xl">
              <img
                src={previewImageUrl}
                alt="Bill Preview"
                className="max-w-full h-auto rounded shadow-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleSaveImage}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-urdu-sans flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصویر محفوظ کریں</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
