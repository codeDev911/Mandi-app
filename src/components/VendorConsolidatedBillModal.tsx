import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { VendorLot, AppSettings } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import { generateVendorConsolidatedInvoiceCanvas, printConsolidatedThermalPOSReceipt } from '../utils/receiptGenerator';
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
  Receipt,
  Download,
  Image as ImageIcon,
  Loader2,
  Send,
  MessageCircle,
  Eye,
  X,
  Package,
  Layers,
  Clock,
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
      const lotPaid = lot.vendorPaymentAmount !== undefined ? lot.vendorPaymentAmount : (lot.vendorPaymentStatus === 'paid' ? lot.summary.netPayableToVendor : 0);
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

  const pendingBalance = Math.max(0, totals.netPayable - totals.totalPaid);
  const isFullyPaid = totals.totalPaid >= totals.netPayable && totals.netPayable > 0;
  const isPartialPaid = totals.totalPaid > 0 && totals.totalPaid < totals.netPayable;

  const displayDate = dateLabel || lots[0]?.arrivalDate || new Date().toISOString().slice(0, 10);

  // Helper to safely generate PNG DataURL & Blob
  const getReceiptImage = async (): Promise<{ dataUrl: string; blob: Blob }> => {
    if (printableRef.current) {
      try {
        const canvas = await html2canvas(printableRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#faf8f2',
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

    // Direct standalone canvas renderer fallback
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

  // 1. Save Image
  const handleSaveImage = async () => {
    sound.playCashChime();
    setIsGeneratingImage(true);
    try {
      const { blob } = await getReceiptImage();
      const sanitizedName = vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
      triggerBrowserDownload(blob, `Mandi_Consolidated_Bill_${sanitizedName}_${displayDate}.png`);

      setShareSuccessToast(isUrdu ? 'کل بل کی تصویر محفوظ ہو گئی ہے!' : 'Consolidated bill image downloaded!');
      setTimeout(() => setShareSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error saving image:', err);
      setShareSuccessToast(isUrdu ? 'تصویر تیار کرنے میں خرابی ہوئی' : 'Failed to generate image');
      setTimeout(() => setShareSuccessToast(null), 3000);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 2. WhatsApp Share
  const handleShareWhatsApp = async () => {
    sound.playCashChime();
    setIsGeneratingImage(true);

    const lotProductsSummary = lots.map((l) => `${l.productEmoji} ${l.productUrdu} (${l.totalQuantity} ${unitLabels[l.unitType][settings.language]} - فروخت ${formatPKR(l.summary.grossSales, settings.currencySymbol, settings.language)})`).join('\n• ');

    const messageText = `*${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}*
📋 *${isUrdu ? 'پکی پرچی کل مال (مشترکہ بل)' : 'Consolidated Mandi Invoice'}*
━━━━━━━━━━━━━━━━━
👤 *زمیندار:* ${vendorName} ${vendorCity ? `(${vendorCity})` : ''}
📅 *تاریخ:* ${displayDate}
📦 *کل لاٹس / اجناس (${lots.length}):*
• ${lotProductsSummary}

💰 *کل فروخت رقم:* ${formatPKR(totals.grossSales, settings.currencySymbol, settings.language)}
📉 *منہا کل کٹوتی اخراجات:* -${formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}
━━━━━━━━━━━━━━━━━
💵 *صافی میزان واجب الادا:* *${formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}*
━━━━━━━━━━━━━━━━━
📍 ${settings.shopAddressUrdu || settings.shopAddressEn}
📞 ${settings.shopPhone}`;

    const rawPhone = (vendorPhone || '').replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.startsWith('0') ? '92' + rawPhone.slice(1) : rawPhone;
    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    try {
      const { blob } = await getReceiptImage();
      const sanitizedName = vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
      const filename = `Mandi_Consolidated_Bill_${sanitizedName}_${displayDate}.png`;

      // Copy image to clipboard if supported
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

      // If Web Share API available on Mobile
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `مجموعی بل - ${vendorName}`,
          text: messageText,
        });
        setShareSuccessToast(isUrdu ? 'واٹس ایپ پر بل شیئر کر دیا گیا!' : 'Consolidated bill shared successfully!');
        setTimeout(() => setShareSuccessToast(null), 4000);
        return;
      }

      // Desktop flow: Download file + open WhatsApp
      triggerBrowserDownload(blob, filename);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      setShareSuccessToast(
        isUrdu
          ? 'بل تصویر محفوظ اور کاپی ہو گئی ہے! واٹس ایپ چیٹ میں تصویر پیسٹ (Ctrl+V) کر سکتے ہیں۔'
          : 'Invoice downloaded & copied to clipboard! Paste directly in WhatsApp chat.'
      );
      setTimeout(() => setShareSuccessToast(null), 6000);
    } catch (err) {
      console.error('Share failed, opening text chat fallback:', err);
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 3. Preview Image Modal
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
پکی پرچی کل مال (مشترکہ بل) - ${vendorName}
تاریخ: ${displayDate}
کل اجناس: ${lots.map((l) => `${l.productUrdu} (${l.totalQuantity})`).join(', ')}
کل فروخت: ${formatPKR(totals.grossSales, settings.currencySymbol, settings.language)}
کل کٹوتی: ${formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}
صافی رقم: ${formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        
        {/* Modal Top Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base font-urdu-nastaliq text-amber-200">
                  {isUrdu ? 'مجموعی بل پرچی (تمام اجناس ایک ساتھ)' : "Consolidated All Products Bill"}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold font-numbers">
                  {lots.length} {isUrdu ? 'اجناس' : 'Lots'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-urdu-sans">
                {vendorName} {vendorCity ? `• ${vendorCity}` : ''} • {displayDate}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition active:scale-95"
            title="بند کریں (Close)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="bg-slate-900/90 border-b border-slate-800 p-2.5 sm:p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Dedicated 80mm POS Thermal Print */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                sound.playTick();
                printConsolidatedThermalPOSReceipt(vendorName, vendorPhone, vendorCity, lots, settings, displayDate);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-md border border-amber-400"
              title="80mm تھرمل پرنٹر پر فوری پرچی پرنٹ کریں"
            >
              <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isUrdu ? '🖨️ 80mm POS تھرمل پرنٹ' : '🖨️ 80mm POS Thermal Print'}</span>
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
              <span>{isUrdu ? 'تصویر محفوظ کریں' : 'Save Image'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isGeneratingImage}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs font-urdu-sans flex items-center gap-1.5 shadow-md transition active:scale-95 disabled:opacity-50"
            >
              {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 fill-current" />}
              <span>{isUrdu ? 'واٹس ایپ پر بھیجیں' : 'WhatsApp'}</span>
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {shareSuccessToast && (
          <div className="bg-emerald-950 border-y border-emerald-600/40 text-emerald-200 px-4 py-2 text-xs font-bold font-urdu-sans flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{shareSuccessToast}</span>
            </div>
            {copiedImageStatus && (
              <span className="text-[11px] px-2 py-0.5 bg-emerald-800 text-white rounded-md font-normal">
                📋 تصویر کلپ بورڈ میں کاپی ہے
              </span>
            )}
          </div>
        )}

        {/* Printable & Scrollable View */}
        <div className="p-3 sm:p-5 overflow-y-auto bg-slate-950/40 space-y-4">
          
          {/* THE AUTHENTIC MANDI CONSOLIDATED INVOICE PARCHI */}
          <div
            ref={printableRef}
            id="consolidated-mandi-receipt"
            className="max-w-3xl mx-auto bg-white text-slate-900 rounded-xl border border-slate-300 shadow-xl overflow-hidden print:border-none print:shadow-none print:m-0 print:max-w-none print:w-full print:bg-white relative font-urdu-sans"
          >
            {/* Clean Header - Traditional Mandi Parchi */}
            <div className="p-5 sm:p-6 bg-white border-b border-slate-300 relative text-center">
              <div className="mb-2">
                <span className="font-urdu-nastaliq text-base font-bold text-slate-900 tracking-wide inline-block">
                  بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-700 font-urdu-sans">
                  پکی پرچی آڑھت و کمیشن ایجنٹ - روزنامہ مشترکہ بل برائے کاشتکار
                </div>

                <h1 className="text-2xl sm:text-3xl font-black font-urdu-nastaliq text-slate-950 tracking-normal leading-tight">
                  {isUrdu ? settings.shopNameUrdu : settings.shopNameEn}
                </h1>

                <p className="text-xs sm:text-sm font-semibold font-urdu-sans text-slate-800">
                  پروپرائٹر: <span className="font-bold text-slate-950 font-urdu-nastaliq text-sm">{isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn}</span>
                </p>

                <p className="text-xs text-slate-600 font-urdu-sans">
                  📍 {isUrdu ? settings.shopAddressUrdu : settings.shopAddressEn} • <span className="font-numbers font-bold text-slate-800">📞 فون: {settings.shopPhone}</span>
                </p>
              </div>

              {/* Vendor & Date Metadata Bar - Clean Monochrome */}
              <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="space-y-0.5 text-start">
                  <span className="text-[11px] font-bold text-slate-500 block">زمیندار / کاشتکار:</span>
                  <strong className="text-slate-950 font-urdu-nastaliq text-sm block truncate">{vendorName}</strong>
                  {vendorCity && <span className="text-[10px] text-slate-600 block">({vendorCity})</span>}
                </div>

                <div className="space-y-0.5 text-start">
                  <span className="text-[11px] font-bold text-slate-500 block">تاریخ حساب:</span>
                  <strong className="font-numbers text-slate-900 text-xs block">{displayDate}</strong>
                </div>

                <div className="space-y-0.5 text-start">
                  <span className="text-[11px] font-bold text-slate-500 block">کل اجناس (Products):</span>
                  <strong className="text-slate-950 font-numbers text-xs font-bold block">
                    {lots.length} اجناس ({totals.totalQuantity} کل نگ)
                  </strong>
                </div>

                <div className="space-y-0.5 text-start">
                  <span className="text-[11px] font-bold text-slate-500 block">رابطہ فون:</span>
                  <strong className="text-slate-800 font-numbers text-xs block">
                    {vendorPhone || settings.shopPhone}
                  </strong>
                </div>
              </div>
            </div>

            {/* FULL DETAIL OF EACH PRODUCT'S SALES (تمام اجناس کی مکمل تفصیلی نیلامی و فروخت) */}
            <div className="p-4 sm:p-6 space-y-6">
              
              {/* Iterating each Product / Lot with full details */}
              {lots.map((lot, idx) => {
                const uLabel = unitLabels[lot.unitType][settings.language];
                return (
                  <div key={lot.id} className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                    {/* Product Header Banner */}
                    <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-300 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center font-numbers">
                          {idx + 1}
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-slate-950 font-urdu-nastaliq">
                          جنس: {lot.productUrdu} ({lot.productName})
                        </h3>
                        <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-700">
                          لاٹ #{lot.lotNumber}
                        </span>
                      </div>

                      <div className="text-xs font-urdu-sans text-slate-700 flex items-center gap-3">
                        {lot.vehicleNumber && <span>گاڑی: <b>{lot.vehicleNumber}</b></span>}
                        <span>آمد تعداد: <b className="font-numbers">{lot.totalQuantity} {uLabel}</b></span>
                        <span>فروخت: <b className="font-numbers text-slate-950">{lot.summary.totalSoldQuantity} {uLabel}</b></span>
                        {lot.summary.remainingQuantity > 0 && (
                          <span className="text-amber-800 font-bold font-numbers">(باقی: {lot.summary.remainingQuantity})</span>
                        )}
                      </div>
                    </div>

                    {/* Sales Table for THIS specific product */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-800 border-b border-slate-200 font-bold">
                            <th className="py-2 px-2.5 text-start w-8">#</th>
                            <th className="py-2 px-3 text-start">تفصیلِ آئٹم (Item)</th>
                            <th className="py-2 px-2.5 text-center w-20">تعداد ({uLabel})</th>
                            <th className="py-2 px-3 text-end w-28">ریٹ (Rate)</th>
                            <th className="py-2 px-3 text-end w-32">کل رقم (Amount)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {lot.sales.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-3 px-3 text-center text-slate-500 font-urdu-sans italic">
                                اس جنس کی ابھی کوئی نیلامی بولی درج نہیں ہوئی۔
                              </td>
                            </tr>
                          ) : (
                            lot.sales.map((sale, sIdx) => (
                              <tr key={sale.id} className="hover:bg-slate-50/60">
                                <td className="py-2 px-2.5 font-numbers text-slate-500 text-center">{sIdx + 1}</td>
                                <td className="py-2 px-3 font-bold text-slate-900 font-urdu-sans text-xs">
                                  {lot.productUrdu}
                                </td>
                                <td className="py-2 px-2.5 text-center font-numbers font-bold text-slate-800">
                                  {sale.quantity}
                                </td>
                                <td className="py-2 px-3 text-end font-numbers text-slate-700">
                                  {formatPKR(sale.ratePerUnit, settings.currencySymbol, settings.language)}
                                </td>
                                <td className="py-2 px-3 text-end font-bold text-slate-950 font-numbers">
                                  {formatPKR(sale.totalAmount, settings.currencySymbol, settings.language)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100/80 border-t border-slate-300 font-bold text-slate-900">
                            <td colSpan={2} className="py-2 px-3 font-urdu-sans text-xs">
                              {lot.productUrdu} - کل فروخت (Gross):
                            </td>
                            <td className="py-2 px-2.5 text-center font-numbers font-bold">
                              {lot.summary.totalSoldQuantity} {uLabel}
                            </td>
                            <td className="py-2 px-3 text-end"></td>
                            <td className="py-2 px-3 text-end font-black font-numbers text-slate-950">
                              {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Lot-level expenses if present */}
                    {lot.summary.totalExpenses > 0 && (
                      <div className="bg-slate-50/70 p-2.5 border-t border-slate-200 text-xs flex items-center justify-between flex-wrap gap-2">
                        <span className="text-slate-600 font-urdu-sans text-[11px]">
                          اس جنس کے کٹوتیاں:
                          {lot.expenses.commission.enabled && ` کمیشن ${formatPKR(lot.expenses.commission.amount, settings.currencySymbol, settings.language)} |`}
                          {lot.expenses.kiraya.enabled && ` کرایہ ${formatPKR(lot.expenses.kiraya.amount, settings.currencySymbol, settings.language)} |`}
                          {lot.expenses.mazdoori.enabled && ` مزدوری ${formatPKR(lot.expenses.mazdoori.amount, settings.currencySymbol, settings.language)} |`}
                          {lot.expenses.munshiana.enabled && ` منشیانہ ${formatPKR(lot.expenses.munshiana.amount, settings.currencySymbol, settings.language)} |`}
                          {lot.expenses.naqdAdvance.enabled && ` نقد ایڈوانس ${formatPKR(lot.expenses.naqdAdvance.amount, settings.currencySymbol, settings.language)}`}
                        </span>
                        <span className="font-bold text-slate-800 text-[11px] font-numbers">
                          منہا کٹوتی: -{formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)} (صافی: {formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* OVERALL SUMMARY TABLE (مجموعی گوشوارہ فروخت تمام اجناس) */}
              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                <div className="bg-slate-200/90 px-3.5 py-2 border-b border-slate-300 font-bold text-slate-900 font-urdu-nastaliq text-xs sm:text-sm">
                  مجموعی خلاصہ تمام اجناس (Summary of All Products)
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                      <th className="py-2 px-3 text-start">جنس (Product)</th>
                      <th className="py-2 px-2 text-center">لاٹ نمبر</th>
                      <th className="py-2 px-2 text-center">کل آمد</th>
                      <th className="py-2 px-2 text-center">فروخت تعداد</th>
                      <th className="py-2 px-3 text-end">کل فروخت رقم</th>
                      <th className="py-2 px-3 text-end">منہا کٹوتی</th>
                      <th className="py-2 px-3 text-end">صافی رقم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {lots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-900 font-urdu-nastaliq">{lot.productUrdu}</td>
                        <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-600">#{lot.lotNumber}</td>
                        <td className="py-2 px-2 text-center font-numbers">{lot.totalQuantity} {unitLabels[lot.unitType][settings.language]}</td>
                        <td className="py-2 px-2 text-center font-numbers font-semibold">{lot.summary.totalSoldQuantity} {unitLabels[lot.unitType][settings.language]}</td>
                        <td className="py-2 px-3 text-end font-numbers font-bold text-slate-900">{formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}</td>
                        <td className="py-2 px-3 text-end font-numbers text-slate-700">-{formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)}</td>
                        <td className="py-2 px-3 text-end font-numbers font-bold text-slate-900">{formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-slate-950">
                      <td colSpan={4} className="py-2.5 px-3 font-urdu-sans text-xs sm:text-sm">
                        مجموعی کل فروخت (Gross Total All Products):
                      </td>
                      <td className="py-2.5 px-3 text-end font-black font-numbers text-sm">
                        {formatPKR(totals.grossSales, settings.currencySymbol, settings.language)}
                      </td>
                      <td className="py-2.5 px-3 text-end font-black font-numbers text-slate-800">
                        -{formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}
                      </td>
                      <td className="py-2.5 px-3 text-end font-black font-numbers text-sm text-slate-950">
                        {formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* DEDUCTIONS BREAKDOWN - CLEAN & STRUCTURED */}
              <div className="bg-slate-50 rounded-lg border border-slate-300 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <h4 className="text-xs font-bold text-slate-900 font-urdu-nastaliq">
                    مجموعی کٹوتیاں و اخراجات کی تفصیل (Total Deductions Detail)
                  </h4>
                  <span className="text-[11px] text-slate-500 font-urdu-sans">
                    تمام اجناس کا منہا حساب
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {/* کمیشن */}
                  {totals.expenses.commission > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="font-bold text-xs text-slate-700 font-urdu-sans">
                        {t.commission}:
                      </span>
                      <span className="font-bold text-slate-900 font-numbers">
                        {formatPKR(totals.expenses.commission, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  )}

                  {/* کرایہ */}
                  {totals.expenses.kiraya > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="font-bold text-xs text-slate-700 font-urdu-sans">
                        {t.kiraya}:
                      </span>
                      <span className="font-bold text-slate-900 font-numbers">
                        {formatPKR(totals.expenses.kiraya, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  )}

                  {/* مزدوری */}
                  {totals.expenses.mazdoori > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="font-bold text-xs text-slate-700 font-urdu-sans">
                        {t.mazdoori}:
                      </span>
                      <span className="font-bold text-slate-900 font-numbers">
                        {formatPKR(totals.expenses.mazdoori, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  )}

                  {/* منشیانہ */}
                  {totals.expenses.munshiana > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="font-bold text-xs text-slate-700 font-urdu-sans">
                        {t.munshiana}:
                      </span>
                      <span className="font-bold text-slate-900 font-numbers">
                        {formatPKR(totals.expenses.munshiana, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  )}

                  {/* نقد ایڈوانس */}
                  {totals.expenses.naqdAdvance > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="font-bold text-xs text-slate-700 font-urdu-sans">
                        {t.naqdAdvance}:
                      </span>
                      <span className="font-bold text-slate-900 font-numbers">
                        {formatPKR(totals.expenses.naqdAdvance, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  )}

                  {/* مارکیٹ فیس */}
                  {totals.expenses.marketFee > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="font-bold text-xs text-slate-700 font-urdu-sans">
                        {t.marketFee}:
                      </span>
                      <span className="font-bold text-slate-900 font-numbers">
                        {formatPKR(totals.expenses.marketFee, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  )}

                  {/* دیگر کٹوتیاں */}
                  {totals.expenses.customExpensesTotal > 0 && (
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="font-bold text-xs text-slate-700 font-urdu-sans">
                        دیگر کٹوتیاں:
                      </span>
                      <span className="font-bold text-slate-900 font-numbers">
                        {formatPKR(totals.expenses.customExpensesTotal, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs font-bold bg-white p-2.5 rounded border border-slate-200">
                  <span className="font-urdu-sans text-slate-800 font-bold">{t.totalExpenses} (مجموعی کٹوتی):</span>
                  <span className="text-slate-900 font-numbers font-black text-sm">
                    - {formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              </div>

              {/* FINAL NET MEEZAN PAYABLE BANNER - CLEAN & CRISP */}
              <div className="p-4 sm:p-5 rounded-lg bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-800">
                <div className="text-center sm:text-start space-y-0.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white text-slate-950 font-black text-sm font-urdu-nastaliq">
                    <span>{t.meezan} (کل صافی میزان برائے ادائیگی)</span>
                  </div>
                  <span className="text-xs text-slate-300 block font-urdu-sans pt-1">
                    زمیندار {vendorName} کو تمام اجناس کی مجموعی قابلِ ادائیگی خالص رقم
                  </span>
                </div>

                <div className="text-center sm:text-end">
                  <div className="text-2xl sm:text-3xl font-black text-white font-numbers tracking-tight">
                    {formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}
                  </div>
                  <span className="text-[11px] text-slate-400 font-urdu-sans">
                    (کل فروخت {formatPKR(totals.grossSales, settings.currencySymbol, settings.language)} منہا کٹوتی {formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)})
                  </span>
                </div>
              </div>

              {/* PAYMENT STATUS BANNER */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                  isFullyPaid
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : isPartialPaid
                    ? 'bg-blue-50 border-blue-300 text-blue-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isFullyPaid ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : isPartialPaid ? (
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-black font-urdu-sans block">
                      {isFullyPaid
                        ? '✅ ادائیگی کی کیفیت: تمام رقم ادا شدہ (ALL PAID IN FULL)'
                        : isPartialPaid
                        ? `ℹ️ ادائیگی کی کیفیت: جزوی ادا شدہ (PARTIALLY PAID: ${formatPKR(totals.totalPaid, settings.currencySymbol, settings.language)})`
                        : '⚠️ ادائیگی کی کیفیت: ادائیگی بقایا (PAYMENT PENDING)'}
                    </span>
                    <span className="text-[10px] opacity-75 font-urdu-sans block">
                      {isFullyPaid
                        ? 'زمیندار کو اس مشترکہ بل کی مکمل رقم ادا کر دی گئی ہے۔'
                        : isPartialPaid
                        ? `ادا شدہ: ${formatPKR(totals.totalPaid, settings.currencySymbol, settings.language)} • باقی بقایا واجب الادا: ${formatPKR(pendingBalance, settings.currencySymbol, settings.language)}`
                        : `کل واجب الادا رقم: ${formatPKR(totals.netPayable, settings.currencySymbol, settings.language)} ابھی بقایا ہے۔`}
                    </span>
                  </div>
                </div>

                <div className="text-end">
                  <span className={`text-[10px] px-2.5 py-1 rounded font-bold font-urdu-sans block ${
                    isFullyPaid ? 'bg-emerald-600 text-white' : isPartialPaid ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'
                  }`}>
                    {isFullyPaid ? 'مکمل ادا شدہ' : isPartialPaid ? 'جزوی ادا' : 'بقایا واجب الادا'}
                  </span>
                  {pendingBalance > 0 && !isFullyPaid && (
                    <span className="text-[10px] font-bold text-slate-800 font-numbers block mt-0.5">
                      بقایا: {formatPKR(pendingBalance, settings.currencySymbol, settings.language)}
                    </span>
                  )}
                </div>
              </div>

              {/* SIGNATURES */}
              <div className="grid grid-cols-2 gap-8 pt-6 pb-2 border-t border-dashed border-slate-300 text-center text-xs font-urdu-sans">
                <div>
                  <div className="h-10 border-b border-slate-400 mb-1 flex items-end justify-center pb-1">
                    <span className="text-[10px] text-slate-400 italic">دستخط منشی</span>
                  </div>
                  <strong className="text-slate-800 block font-urdu-sans">{isUrdu ? 'دستخط منشی / کیشیئر' : 'Munshi / Cashier'}</strong>
                </div>

                <div>
                  <div className="h-10 border-b border-slate-400 mb-1 flex items-end justify-center pb-1">
                    <span className="text-[10px] text-slate-400 italic">دستخط و مہر</span>
                  </div>
                  <strong className="text-slate-800 block font-urdu-sans">{isUrdu ? 'دستخط آڑھتی / مہر' : 'Arhti Stamp & Signature'}</strong>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-100 px-4 py-2.5 text-center text-[10px] text-slate-600 border-t border-slate-300 font-urdu-sans flex items-center justify-between flex-wrap gap-2">
              <span>{isUrdu ? 'پکی پرچی کمپیوٹرائزڈ مشترکہ بل - ریکارڈ برائے زمیندار و آڑھت' : 'Computerized Consolidated Mandi Invoice'}</span>
              <span className="font-bold text-slate-900">{settings.shopNameUrdu}</span>
              <span>{isUrdu ? 'منڈی کمیٹی کے جملہ قواعد نافذ العمل ہیں' : 'Official Mandi Terms Apply'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* High-Resolution Image Preview Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <span className="text-xs font-bold font-urdu-sans text-amber-200">
                پیش نظارہ بل تصویر (PNG Invoice Preview)
              </span>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-950">
              <img
                src={previewImageUrl}
                alt="Consolidated Mandi Invoice Preview"
                className="max-h-[70vh] rounded-lg shadow-2xl border border-slate-700 object-contain"
              />
            </div>
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={handleSaveImage}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-urdu-sans flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصویر محفوظ کریں</span>
              </button>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-urdu-sans"
              >
                بند کریں
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
