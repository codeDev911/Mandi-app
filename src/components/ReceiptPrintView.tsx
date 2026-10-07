import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { VendorLot, AppSettings } from '../types';
import { translations, unitLabels, getUnitDisplayLabel } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import { generateMandiInvoiceCanvas, printThermalPOSReceipt } from '../utils/receiptGenerator';
import { printSingleLotReceiptA4 } from '../utils/printHelper';
import { saveBlobFile } from '../utils/fileDownloader';
import { UniversalShareModal, UniversalShareItem } from './UniversalShareModal';
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
  Download,
  Image as ImageIcon,
  Loader2,
  Send,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Eye,
  X,
  ExternalLink,
  DollarSign,
  CheckCircle2,
  Clock,
  Building2,
  Sliders,
  Save,
} from 'lucide-react';

interface ReceiptPrintViewProps {
  lot: VendorLot;
  lots: VendorLot[];
  onSelectLot: (lotId: string) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onBackToBolli?: () => void;
  onOpenExpenseSlip?: (lotId: string) => void;
  settings: AppSettings;
}

export const ReceiptPrintView: React.FC<ReceiptPrintViewProps> = ({
  lot,
  lots,
  onSelectLot,
  onToggleVendorPaymentStatus,
  onBackToBolli,
  onOpenExpenseSlip,
  settings,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';
  const unitLabel = getUnitDisplayLabel(lot.unitType, settings.language);

  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [shareSuccessToast, setShareSuccessToast] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [copiedImageStatus, setCopiedImageStatus] = useState(false);
  const [paperFormat, setPaperFormat] = useState<'pos80' | 'standard'>('pos80');
  const [shareModalItem, setShareModalItem] = useState<UniversalShareItem | null>(null);
  const receiptCardRef = useRef<HTMLDivElement>(null);

  const isPaid = lot.vendorPaymentStatus === 'paid';

  // Dedicated 80mm POS Thermal Receipt Print
  const handlePOSPrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    printThermalPOSReceipt(lot, settings);
  };

  // Full Page A4 Print Engine
  const handleFullPagePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    printSingleLotReceiptA4(lot, settings);
  };

  // Helper to safely render receipt into a PNG DataURL and Blob
  const getReceiptImage = async (): Promise<{ dataUrl: string; blob: Blob }> => {
    // Strategy 1: Try HTML2Canvas on the rendered DOM component
    if (receiptCardRef.current) {
      try {
        const canvas = await html2canvas(receiptCardRef.current, {
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

    // Strategy 2: Ultra-reliable Standalone Canvas 2D Renderer (always works in sandboxed iframes)
    const directCanvas = generateMandiInvoiceCanvas(lot, settings);
    const dataUrl = directCanvas.toDataURL('image/png');
    const blob = await new Promise<Blob | null>((resolve) =>
      directCanvas.toBlob((b) => resolve(b), 'image/png', 0.95)
    );

    if (!blob) {
      throw new Error('Image creation failed');
    }
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

  // 1. One-Click Save Slip Image
  const handleSaveImage = async () => {
    sound.playCashChime();
    setIsGeneratingImage(true);
    try {
      const { blob } = await getReceiptImage();
      const sanitizedVendor = lot.vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
      const filename = `Mandi_Vendor_Bill_${sanitizedVendor}_${lot.arrivalDate}.png`;
      const saveRes = await saveBlobFile(blob, filename, 'Mandi Slip Image');

      if (saveRes.success) {
        setShareSuccessToast(isUrdu ? 'رسید کی تصویر کامیابی سے محفوظ ہو گئی!' : 'Vendor Bill image saved successfully!');
      } else {
        triggerBrowserDownload(blob, filename);
        setShareSuccessToast(isUrdu ? 'رسید کی تصویر محفوظ ہو گئی!' : 'Vendor Bill image saved!');
      }
      setTimeout(() => setShareSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error saving receipt image:', err);
      setShareSuccessToast(isUrdu ? 'تصویر محفوظ کرنے میں مسئلہ پیش آیا' : 'Failed to save receipt image');
      setTimeout(() => setShareSuccessToast(null), 3000);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 2. High-Res Visual Preview Modal
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

  // 3. Formatted WhatsApp text (NO CUSTOMER NAMES - QTY, RATE, TOTAL ONLY)
  const generateWhatsAppMessage = () => {
    let msg = `*${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}*\n`;
    msg += `🧾 *${isUrdu ? 'پکی پرچی رسید برائے زمیندار (POS Bill)' : 'Vendor POS Invoice'}*\n`;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `📅 *تاریخ:* ${lot.arrivalDate}\n`;
    msg += `👤 *زمیندار:* ${lot.vendorName} ${lot.vendorCity ? `(${lot.vendorCity})` : ''}\n`;
    if (lot.vehicleNumber) msg += `🚚 *گاڑی نمبر:* ${lot.vehicleNumber}\n`;
    msg += `📦 *جنس:* ${lot.productUrdu} (${lot.totalQuantity} ${unitLabel})\n`;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `*فروخت کی تفصیل (Sales Detail):*\n`;

    if (lot.sales.length === 0) {
      msg += `_(ابھی کوئی فروخت درج نہیں ہوئی)_\n`;
    } else {
      lot.sales.forEach((s, idx) => {
        msg += `${idx + 1}. ${lot.productUrdu}: ${s.quantity} ${unitLabel} @ ${s.ratePerUnit} = ${formatPKR(s.totalAmount, 'Rs.', 'en')}\n`;
      });
    }

    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *کل مال فروخت:* ${formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)} (${lot.summary.totalSoldQuantity} ${unitLabel})\n`;

    // Deductions
    const activeDeductions: string[] = [];
    if (lot.expenses.commission.enabled) activeDeductions.push(`کمیشن (${lot.expenses.commission.rate}%): ${formatPKR(lot.expenses.commission.amount, 'Rs.', 'en')}`);
    if (lot.expenses.kiraya.enabled) activeDeductions.push(`کرایہ: ${formatPKR(lot.expenses.kiraya.amount, 'Rs.', 'en')}`);
    if (lot.expenses.mazdoori.enabled) activeDeductions.push(`مزدوری: ${formatPKR(lot.expenses.mazdoori.amount, 'Rs.', 'en')}`);
    if (lot.expenses.munshiana.enabled) activeDeductions.push(`منشیانہ: ${formatPKR(lot.expenses.munshiana.amount, 'Rs.', 'en')}`);
    if (lot.expenses.naqdAdvance.enabled) activeDeductions.push(`نقد پیشگی: ${formatPKR(lot.expenses.naqdAdvance.amount, 'Rs.', 'en')}`);
    if (lot.expenses.marketFee.enabled) activeDeductions.push(`مارکیٹ فیس: ${formatPKR(lot.expenses.marketFee.amount, 'Rs.', 'en')}`);
    lot.expenses.customExpenses?.forEach((ce) => {
      activeDeductions.push(`${ce.nameUrdu}: ${formatPKR(ce.amount, 'Rs.', 'en')}`);
    });

    if (activeDeductions.length > 0) {
      msg += `📉 *منہا کٹوتیاں و اخراجات:*\n• ` + activeDeductions.join('\n• ') + `\n`;
      msg += `🔻 *کل کٹوتی:* -${formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)}\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *صافی رقم واجب الادا (Net Payable):* *${formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}*\n`;
    msg += `📌 *ادائیگی کی کیفیت:* ${isPaid ? '✅ ادا شدہ (PAID IN FULL)' : '⚠️ ادائیگی بقایا (PENDING)'}\n`;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 آڑھتی: ${settings.arhtiNameUrdu || settings.arhtiNameEn}\n`;
    msg += `📍 ${settings.shopAddressUrdu || settings.shopAddressEn}\n`;
    msg += `📞 فون: ${settings.shopPhone}`;
    return msg;
  };

  // 4. WhatsApp Share -> Opens interactive Share Modal
  const handleShareWhatsApp = async () => {
    sound.playCashChime();
    setIsGeneratingImage(true);

    const messageText = generateWhatsAppMessage();
    const sanitizedVendor = lot.vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const filename = `Mandi_POS_Bill_${sanitizedVendor}_Lot_${lot.lotNumber}.png`;

    try {
      const { blob, dataUrl } = await getReceiptImage();

      setShareModalItem({
        title: `بل رسید #${lot.lotNumber} - ${lot.vendorName}`,
        subtitle: `${lot.productUrdu} (${lot.totalQuantity} ${unitLabel})`,
        formattedText: messageText,
        recipientName: lot.vendorName,
        recipientPhone: lot.vendorPhone,
        fileBlob: blob,
        fileName: filename,
        fileType: 'image',
        previewImageUrl: dataUrl,
        extraDetails: [
          { label: 'کل رقم', value: formatPKR(lot.summary.grossSales, '₨', 'en') },
          { label: 'کٹوتیاں', value: formatPKR(lot.summary.totalExpenses, '₨', 'en') },
          { label: 'صافی رقم', value: formatPKR(lot.summary.netPayableToVendor, '₨', 'en') },
        ],
      });
    } catch (err) {
      console.warn('Share modal preview generation fallback:', err);
      // Fallback modal without image blob
      setShareModalItem({
        title: `بل رسید #${lot.lotNumber} - ${lot.vendorName}`,
        subtitle: `${lot.productUrdu} (${lot.totalQuantity} ${unitLabel})`,
        formattedText: messageText,
        recipientName: lot.vendorName,
        recipientPhone: lot.vendorPhone,
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopyText = () => {
    sound.playTick();
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-8 animate-in fade-in duration-200">
      
      {/* Top Action Bar */}
      <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl text-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg no-print">
        
        {/* Lot Selector & Back Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onBackToBolli && (
            <button
              onClick={() => {
                sound.playTick();
                onBackToBolli();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-urdu-sans flex items-center gap-1.5 border border-slate-700 transition active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{isUrdu ? 'واپس بولی روم' : 'Back to Bolli'}</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-urdu-sans hidden sm:inline">{isUrdu ? 'منتخب لاٹ:' : 'Select Lot:'}</span>
            <select
              value={lot.id}
              onChange={(e) => {
                sound.playTick();
                onSelectLot(e.target.value);
              }}
              className="bg-slate-800 text-slate-100 text-xs rounded-xl px-3 py-1.5 border border-slate-700 font-urdu-sans focus:ring-2 focus:ring-emerald-500 font-bold"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.vendorName} - {l.productUrdu} ({l.arrivalDate})
                </option>
              ))}
            </select>
          </div>

          {/* 1-Click Vendor Payment Status Switcher */}
          {onToggleVendorPaymentStatus && (
            <button
              onClick={() => onToggleVendorPaymentStatus(lot.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-sm border ${
                isPaid
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                  : 'bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900'
              }`}
              title={isPaid ? 'ادائیگی ہو چکی ہے - کلک کر کے بقایا کریں' : 'ادائیگی بقایا ہے - کلک کر کے ادا شدہ کریں'}
            >
              {isPaid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isPaid ? (isUrdu ? 'ادا شدہ (Paid) ✅' : 'Paid ✅') : (isUrdu ? 'ادائیگی بقایا (Pending) ⏳' : 'Pending ⏳')}</span>
            </button>
          )}
        </div>

        {/* Action Buttons: POS Thermal Print, A4 Print, Preview, Image, WhatsApp */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenExpenseSlip && (
            <button
              type="button"
              onClick={() => onOpenExpenseSlip(lot.id)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-urdu-sans flex items-center gap-1.5 border border-slate-700 transition active:scale-95 shadow-xs"
              title="اخراجات پرچی و کٹوتیاں تبدیل کریں"
            >
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span>{isUrdu ? 'اخراجات پرچی' : 'Expense Slip'}</span>
            </button>
          )}

          {/* Dedicated 80mm POS Thermal Print Button */}
          <button
            type="button"
            onClick={handlePOSPrint}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-md border border-amber-400"
            title="80mm تھرمل پرنٹر پر فوری پرچی پرنٹ کریں (Zero Margins, POS Thermal Roll)"
          >
            <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isUrdu ? '80mm POS پرنٹ' : '80mm POS Print'}</span>
          </button>

          {/* Full Page A4 Print Button */}
          <button
            type="button"
            onClick={handleFullPagePrint}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-md border border-emerald-500"
            title="A4 سائز پر مکمل بل پرنٹ کریں"
          >
            <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isUrdu ? 'A4 بل پرنٹ' : 'A4 Bill Print'}</span>
          </button>

          {/* Paper View Toggle (80mm POS vs A4 Standard) */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setPaperFormat('pos80')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold font-urdu-sans transition ${
                paperFormat === 'pos80'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isUrdu ? '80mm پرچی' : '80mm Slip'}
            </button>
            <button
              type="button"
              onClick={() => setPaperFormat('standard')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold font-urdu-sans transition ${
                paperFormat === 'standard'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isUrdu ? 'A4 بل' : 'A4 Bill'}
            </button>
          </div>

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

          <button
            type="button"
            onClick={handleSaveImage}
            disabled={isGeneratingImage}
            className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold font-urdu-sans flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
            title="رسید کی تصویر محفوظ کریں (Save Image)"
          >
            {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isUrdu ? 'تصویر محفوظ کریں' : 'Save Image'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={isGeneratingImage}
            className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs font-urdu-sans flex items-center gap-1.5 shadow-md transition active:scale-95 disabled:opacity-50"
            title="پرچی یا بل شیئر کریں (Share Receipt)"
          >
            {isGeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>{isUrdu ? 'شیئر کریں' : 'Share'}</span>
          </button>

          {/* Dedicated Close / Return Button */}
          {onBackToBolli && (
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                onBackToBolli();
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs font-urdu-sans flex items-center gap-1 shadow-md transition active:scale-95 border border-rose-400"
              title="بند کریں اور واپس جائیں"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isUrdu ? 'بند کریں' : 'Close'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {shareSuccessToast && (
        <div className="bg-emerald-950 border border-emerald-600/40 text-emerald-200 px-4 py-2.5 rounded-xl text-xs font-bold font-urdu-sans flex items-center justify-between gap-2 animate-in fade-in shadow-md no-print">
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

      {/* THE MINIMAL LOCAL SHOP POS RECEIPT / BILL (پاکستانی دکان POS پرچی) */}
      <div className="flex justify-center p-1 sm:p-4">
        <div
          ref={receiptCardRef}
          id="mandi-pos-receipt-card"
          className={`w-full ${
            paperFormat === 'pos80' ? 'max-w-[360px]' : 'max-w-md'
          } bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-xl p-4 sm:p-5 space-y-3.5 font-urdu-sans print:border-none print:shadow-none print:m-0 print:p-2 print:max-w-none print:w-full transition-all`}
        >
          {/* Receipt Top Header */}
          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-black font-urdu-nastaliq text-slate-950 leading-tight">
              {isUrdu ? settings.shopNameUrdu : settings.shopNameEn}
            </h1>

            <p className="text-xs font-bold text-slate-800 font-urdu-sans">
              پروپرائٹر: <span className="font-urdu-nastaliq text-sm">{isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn}</span>
            </p>

            <p className="text-[11px] text-slate-600 font-urdu-sans">
              📍 {isUrdu ? settings.shopAddressUrdu : settings.shopAddressEn} • <span className="font-numbers font-bold text-slate-800">📞 فون: {settings.shopPhone}</span>
            </p>

            <div className="inline-block mt-1 px-3 py-0.5 bg-slate-100 border border-slate-300 rounded-md text-[11px] font-bold text-slate-800 font-urdu-sans">
              پکی پرچی رسید برائے زمیندار (POS Invoice)
            </div>
          </div>

          {/* Dashed Separator */}
          <div className="border-t border-dashed border-slate-400 my-2" />

          {/* Bill Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-0.5 text-start">
              <span className="text-[10px] text-slate-500 font-bold block">تاریخ آمد:</span>
              <strong className="font-numbers text-xs text-slate-900 block font-bold">{lot.arrivalDate}</strong>
            </div>

            <div className="space-y-0.5 text-start">
              <span className="text-[10px] text-slate-500 font-bold block">زمیندار / کاشتکار:</span>
              <strong className="font-urdu-nastaliq text-xs sm:text-sm text-slate-950 block truncate font-bold">
                {lot.vendorName} {lot.vendorCity ? `(${lot.vendorCity})` : ''}
              </strong>
            </div>

            <div className="space-y-0.5 text-start col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-500 font-bold block">کل جنس / آمد:</span>
              <strong className="text-xs text-slate-950 block font-bold">
                {lot.productUrdu} ({lot.totalQuantity} {unitLabel})
              </strong>
            </div>

            {lot.vehicleNumber && (
              <div className="space-y-0.5 text-start col-span-2">
                <span className="text-[10px] text-slate-500 font-bold block">گاڑی نمبر:</span>
                <strong className="text-xs text-slate-900 block font-mono">{lot.vehicleNumber}</strong>
              </div>
            )}
          </div>

          {/* Dashed Separator */}
          <div className="border-t border-dashed border-slate-400 my-2" />

          {/* SALES TABLE - NO CUSTOMER NAME, ONLY QTY, RATE, TOTAL */}
          <div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-900 text-slate-900 font-bold">
                  <th className="py-1 px-1 text-start w-6">#</th>
                  <th className="py-1 px-2 text-start">تفصیلِ جنس (Item)</th>
                  <th className="py-1 px-1.5 text-center">تعداد ({unitLabel})</th>
                  <th className="py-1 px-2 text-end">ریٹ</th>
                  <th className="py-1 px-2 text-end">کل رقم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lot.sales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-slate-400 text-xs font-urdu-sans">
                      کوئی بولی فروخت درج نہیں ہوئی۔
                    </td>
                  </tr>
                ) : (
                  lot.sales.map((sale, idx) => (
                    <tr key={sale.id} className="text-slate-900">
                      <td className="py-1.5 px-1 font-numbers text-slate-500 text-start">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-bold text-slate-950 font-urdu-sans text-start">
                        {lot.productUrdu}
                      </td>
                      <td className="py-1.5 px-1.5 text-center font-numbers font-bold">
                        {sale.quantity}
                      </td>
                      <td className="py-1.5 px-2 text-end font-numbers text-slate-700">
                        {formatPKR(sale.ratePerUnit, 'Rs.', 'en')}
                      </td>
                      <td className="py-1.5 px-2 text-end font-numbers font-bold text-slate-950">
                        {formatPKR(sale.totalAmount, 'Rs.', 'en')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-900 font-bold bg-slate-50 text-slate-950">
                  <td colSpan={2} className="py-1.5 px-2 text-start font-urdu-sans">
                    کل فروخت ({lot.summary.totalSoldQuantity} {unitLabel}):
                  </td>
                  <td className="py-1.5 px-1.5 text-center font-numbers">{lot.summary.totalSoldQuantity}</td>
                  <td className="py-1.5 px-2 text-end text-[10px] text-slate-500 font-urdu-sans">ٹوٹل</td>
                  <td className="py-1.5 px-2 text-end font-numbers font-black text-sm text-slate-950">
                    {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Dashed Separator */}
          <div className="border-t border-dashed border-slate-400 my-2" />

          {/* DEDUCTIONS / EXPENSES LIST (کٹوتیاں و اخراجات) */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-900 font-urdu-nastaliq text-xs mb-1">
              <span>منہا کٹوتیاں و اخراجات (Deductions):</span>
              {onOpenExpenseSlip && (
                <button
                  type="button"
                  onClick={() => onOpenExpenseSlip(lot.id)}
                  className="text-[10px] text-amber-800 hover:text-amber-900 font-urdu-sans font-bold no-print underline"
                  title="اخراجات پرچی کھولیں اور کٹوتیاں تبدیل کریں"
                >
                  اخراجات پرچی ✏️
                </button>
              )}
            </div>

            <div className="space-y-1 text-slate-700">
              {lot.expenses.commission.enabled && (
                <div className="flex justify-between items-center">
                  <span>کمیشن ({lot.expenses.commission.rate}%):</span>
                  <span className="font-numbers font-bold text-slate-900">
                    {formatPKR(lot.expenses.commission.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {lot.expenses.kiraya.enabled && (
                <div className="flex justify-between items-center">
                  <span>کرایہ گاڑی:</span>
                  <span className="font-numbers font-bold text-slate-900">
                    {formatPKR(lot.expenses.kiraya.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {lot.expenses.mazdoori.enabled && (
                <div className="flex justify-between items-center">
                  <span>مزدوری:</span>
                  <span className="font-numbers font-bold text-slate-900">
                    {formatPKR(lot.expenses.mazdoori.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {lot.expenses.munshiana.enabled && (
                <div className="flex justify-between items-center">
                  <span>منشیانہ:</span>
                  <span className="font-numbers font-bold text-slate-900">
                    {formatPKR(lot.expenses.munshiana.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {lot.expenses.naqdAdvance.enabled && (
                <div className="flex justify-between items-center">
                  <span>نقد پیشگی (Advance):</span>
                  <span className="font-numbers font-bold text-slate-900">
                    {formatPKR(lot.expenses.naqdAdvance.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {lot.expenses.marketFee.enabled && (
                <div className="flex justify-between items-center">
                  <span>مارکیٹ فیس:</span>
                  <span className="font-numbers font-bold text-slate-900">
                    {formatPKR(lot.expenses.marketFee.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              )}

              {lot.expenses.customExpenses?.map((ce) => (
                <div key={ce.id} className="flex justify-between items-center">
                  <span>{ce.nameUrdu}:</span>
                  <span className="font-numbers font-bold text-slate-900">
                    {formatPKR(ce.amount, settings.currencySymbol, settings.language)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Deductions */}
            <div className="flex justify-between items-center pt-1 border-t border-slate-200 font-bold text-rose-800">
              <span>کل منہا اخراجات:</span>
              <span className="font-numbers font-black">
                - {formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)}
              </span>
            </div>
          </div>

          {/* Dashed Separator */}
          <div className="border-t border-dashed border-slate-400 my-2" />

          {/* NET PAYABLE BOX (صافی رقم برائے ادائیگی) */}
          <div className="bg-slate-950 text-white p-3.5 rounded-xl flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] text-slate-300 font-urdu-sans block">صافی میزان واجب الادا</span>
              <span className="text-xs font-bold font-urdu-nastaliq text-amber-300">صافی رقم برائے ادائیگی</span>
            </div>
            <div className="text-end">
              <span className="text-lg sm:text-xl font-black font-numbers text-white tracking-tight">
                {formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}
              </span>
            </div>
          </div>

          {/* VENDOR PAYMENT STATUS BOX (بقایا یا ادا شدہ) */}
          <div
            onClick={() => onToggleVendorPaymentStatus && onToggleVendorPaymentStatus(lot.id)}
            className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer ${
              isPaid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100'
                : 'bg-amber-50 border-amber-300 text-amber-950 hover:bg-amber-100'
            }`}
            title="کلک کر کے ادائیگی کی کیفیت تبدیل کریں (Click to toggle payment status)"
          >
            <div className="flex items-center gap-2">
              {isPaid ? (
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 stroke-[2.5]" />
                </div>
              )}
              <div>
                <span className="text-xs font-black font-urdu-sans block">
                  {isPaid ? '✅ ادائیگی کی کیفیت: ادا شدہ (PAID IN FULL)' : '⚠️ ادائیگی کی کیفیت: ادائیگی بقایا (PENDING)'}
                </span>
                <span className="text-[10px] opacity-75 font-urdu-sans block">
                  {isPaid
                    ? `زمیندار کو مکمل ادائیگی ہو چکی ہے ${lot.vendorPaymentDate ? `(${lot.vendorPaymentDate})` : ''}`
                    : 'زمیندار کو رقم کی ادائیگی ابھی باقی ہے (کلک کر کے ادا شدہ کریں)'}
                </span>
              </div>
            </div>

            <span className="text-[10px] px-2 py-0.5 rounded bg-white/80 border border-slate-300 font-bold font-urdu-sans">
              {isPaid ? 'ادا شدہ' : 'بقایا'}
            </span>
          </div>

          {/* Signatures & Footer Note */}
          <div className="pt-4 border-t border-dashed border-slate-300 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-center text-xs">
              <div className="space-y-1">
                <div className="border-b border-dashed border-slate-400 pb-2" />
                <span className="text-[11px] text-slate-600 font-bold font-urdu-sans">دستخط منشی / کیشیئر</span>
              </div>
              <div className="space-y-1">
                <div className="border-b border-dashed border-slate-400 pb-2" />
                <span className="text-[11px] text-slate-600 font-bold font-urdu-sans">دستخط و مہر آڑھتی</span>
              </div>
            </div>

            <p className="text-center text-[10px] text-slate-500 font-urdu-sans">
              کمپیوٹرائزڈ رسید برائے زمیندار | منڈی کمیٹی کے جملہ قواعد نافذ العمل ہیں
            </p>
          </div>
        </div>
      </div>

      {/* High-Resolution Standalone Image Preview Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 max-w-lg w-full rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-xs sm:text-sm font-urdu-sans">
                  {isUrdu ? 'رسید کی ہائی ریزولوشن تصویر' : 'High-Res Receipt Image Preview'}
                </h3>
              </div>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-950/50 flex items-center justify-center">
              <img
                src={previewImageUrl}
                alt="Receipt Full Preview"
                className="max-w-full h-auto rounded-lg shadow-lg border border-slate-800"
              />
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  sound.playCashChime();
                  const link = document.createElement('a');
                  link.download = `Mandi_POS_Receipt_Lot_${lot.lotNumber}.png`;
                  link.href = previewImageUrl;
                  link.click();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-urdu-sans flex items-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isUrdu ? 'ڈاؤن لوڈ کریں' : 'Download PNG'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal WhatsApp & Social Share Modal */}
      <UniversalShareModal
        isOpen={!!shareModalItem}
        onClose={() => setShareModalItem(null)}
        shareItem={shareModalItem}
        settings={settings}
      />
    </div>
  );
};
