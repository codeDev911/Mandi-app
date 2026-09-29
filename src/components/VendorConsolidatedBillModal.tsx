import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { VendorLot, AppSettings } from '../types';
import { translations, unitLabels, formatFullRealDate } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import { printConsolidatedThermalPOSReceipt, generateVendorConsolidatedInvoiceCanvas } from '../utils/receiptGenerator';
import { printVendorBillSlipA4 } from '../utils/printHelper';
import { saveBlobFile, downloadBlobFile } from '../utils/fileDownloader';
import { UniversalShareModal, UniversalShareItem } from './UniversalShareModal';
import { InsafMandiBillView } from './InsafMandiBillView';
import {
  Printer,
  Copy,
  Check,
  Download,
  Loader2,
  X,
  Layers,
  Sparkles,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Share2,
  ArrowLeft,
  Save,
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
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [shareSuccessToast, setShareSuccessToast] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isRenderingCanvas, setIsRenderingCanvas] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [shareModalItem, setShareModalItem] = useState<UniversalShareItem | null>(null);
  const [isAveraged, setIsAveraged] = useState<boolean>(false);

  const displayDate = formatFullRealDate(dateLabel, lots[0]?.arrivalDate);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    const uLabel = unitLabels[lot.unitType]?.[settings.language] || unitLabels[lot.unitType]?.ur || 'نگ';
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
        });
      });
    } else {
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

  // Group all sales by product for averaged display / text share (اجناس وار خلاصہ بل)
  const averagedProductItems: Array<{
    lotNumber: string;
    productName: string;
    productUrdu: string;
    quantity: number;
    unitLabel: string;
    ratePerUnit: number;
    totalAmount: number;
    buyerName?: string;
  }> = [];

  const productGroups = new Map<
    string,
    {
      productUrdu: string;
      productName: string;
      quantity: number;
      unitLabel: string;
      totalAmount: number;
      lotNumbers: Set<string>;
    }
  >();

  lots.forEach((lot) => {
    const prodKey = (lot.productUrdu || lot.productName || 'جنس').trim();
    const uLabel = unitLabels[lot.unitType]?.[settings.language] || unitLabels[lot.unitType]?.ur || 'نگ';

    if (!productGroups.has(prodKey)) {
      productGroups.set(prodKey, {
        productUrdu: prodKey,
        productName: lot.productName,
        quantity: 0,
        unitLabel: uLabel,
        totalAmount: 0,
        lotNumbers: new Set<string>(),
      });
    }

    const grp = productGroups.get(prodKey)!;
    grp.lotNumbers.add(lot.lotNumber);

    if (lot.sales && lot.sales.length > 0) {
      lot.sales.forEach((s) => {
        grp.quantity += s.quantity;
        grp.totalAmount += s.totalAmount;
      });
    } else {
      grp.quantity += lot.totalQuantity;
      grp.totalAmount += lot.summary.grossSales;
    }
  });

  productGroups.forEach((grp) => {
    const avgRate = grp.quantity > 0 ? Math.round(grp.totalAmount / grp.quantity) : 0;
    averagedProductItems.push({
      lotNumber: Array.from(grp.lotNumbers).join(', '),
      productName: grp.productName,
      productUrdu: grp.productUrdu,
      quantity: grp.quantity,
      unitLabel: grp.unitLabel,
      ratePerUnit: avgRate,
      totalAmount: Math.round(grp.totalAmount),
    });
  });

  // Generate High-Resolution PDF Canvas preview immediately on open / lot change / averaged change
  useEffect(() => {
    if (!isOpen || lots.length === 0) {
      setPreviewImageUrl(null);
      return;
    }

    setIsRenderingCanvas(true);

    const generatePreview = async () => {
      try {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      } catch {
        // ignore
      }

      try {
        const canvas = generateVendorConsolidatedInvoiceCanvas(
          vendorName,
          vendorPhone,
          vendorCity,
          lots,
          settings,
          displayDate,
          isAveraged
        );
        const dataUrl = canvas.toDataURL('image/png', 0.98);
        setPreviewImageUrl(dataUrl);
      } catch (err) {
        console.error('Error generating vendor bill PDF canvas preview:', err);
      } finally {
        setIsRenderingCanvas(false);
      }
    };

    const timer = setTimeout(generatePreview, 60);
    return () => clearTimeout(timer);
  }, [isOpen, vendorName, vendorPhone, vendorCity, lots, settings, displayDate, isAveraged]);

  if (!isOpen || lots.length === 0) return null;

  const showToast = (msg: string) => {
    setShareSuccessToast(msg);
    setTimeout(() => setShareSuccessToast(null), 3500);
  };

  // Helper to reliably trigger browser / mobile download
  const triggerSafeDownload = (blob: Blob, downloadFileName: string) => {
    try {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = downloadFileName;
      link.target = '_self';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
      }, 4000);
    } catch (e) {
      console.error('Trigger safe download error:', e);
    }
  };

  // Build Half Landscape A4 PDF (148.5mm x 210mm) from High-Res 2D Canvas with exact Urdu calligraphy
  const buildVendorBillPDF = async (): Promise<{ pdf: jsPDF; blob: Blob }> => {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // continue
      }
    }

    const canvas = generateVendorConsolidatedInvoiceCanvas(
      vendorName,
      vendorPhone,
      vendorCity,
      lots,
      settings,
      displayDate,
      isAveraged
    );

    // Half of A4 in Landscape: 210mm wide x 148.5mm high
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [148.5, 210],
    });
    const pdfPageWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfPageHeight = pdf.internal.pageSize.getHeight(); // 148.5mm
    const pxPageHeight = Math.floor((canvas.width * pdfPageHeight) / pdfPageWidth);
    const totalCanvasHeight = canvas.height;
    let renderedHeight = 0;
    let pageIndex = 0;

    while (renderedHeight < totalCanvasHeight) {
      const sliceHeight = Math.min(pxPageHeight, totalCanvasHeight - renderedHeight);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0, renderedHeight, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight
        );
      }
      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
      if (pageIndex > 0) {
        pdf.addPage([148.5, 210], 'landscape');
      }
      const renderedSliceMmHeight = (sliceHeight * pdfPageWidth) / canvas.width;
      pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfPageWidth, renderedSliceMmHeight, undefined, 'FAST');
      renderedHeight += sliceHeight;
      pageIndex++;
    }

    const blob = pdf.output('blob');
    return { pdf, blob };
  };

  // 1. Direct PDF Download
  const handleDownloadPDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingPDF(true);

    const sanitizedName = vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const finalPdfName = `Vendor_Bill_${sanitizedName}_${displayDate}.pdf`;

    try {
      const { pdf, blob } = await buildVendorBillPDF();
      const downloadRes = await downloadBlobFile(blob, finalPdfName);
      if (downloadRes.success) {
        showToast(isUrdu ? 'پی ڈی ایف بل پرچی کامیابی سے محفوظ ہو گئی!' : 'Vendor Bill PDF downloaded successfully!');
      } else {
        try {
          pdf.save(finalPdfName);
          showToast(isUrdu ? 'پی ڈی ایف بل پرچی کامیابی سے محفوظ ہو گئی!' : 'Vendor Bill PDF downloaded successfully!');
        } catch (saveErr) {
          triggerSafeDownload(blob, finalPdfName);
          showToast(isUrdu ? 'پی ڈی ایف بل پرچی کامیابی سے محفوظ ہو گئی!' : 'Vendor Bill PDF downloaded successfully!');
        }
      }
    } catch (err) {
      console.error('PDF export error:', err);
      try {
        const canvas = generateVendorConsolidatedInvoiceCanvas(
          vendorName,
          vendorPhone,
          vendorCity,
          lots,
          settings,
          displayDate,
          isAveraged
        );
        canvas.toBlob(async (pngBlob) => {
          if (pngBlob) {
            await downloadBlobFile(pngBlob, `Vendor_Bill_${sanitizedName}_${displayDate}.png`);
            showToast(isUrdu ? 'بل پرچی کی تصویر محفوظ کر لی گئی ہے' : 'Bill image downloaded successfully');
          }
        }, 'image/png', 0.95);
      } catch {
        showToast(isUrdu ? 'پی ڈی ایف ڈاؤن لوڈ میں خرابی پیش آئی' : 'Failed to download PDF');
      }
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 2. Direct PNG Image Download
  const handleSaveImage = () => {
    sound.playCashChime();
    const sanitizedName = vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const filename = `Vendor_Bill_${sanitizedName}_${displayDate}.png`;

    try {
      const canvas = generateVendorConsolidatedInvoiceCanvas(
        vendorName,
        vendorPhone,
        vendorCity,
        lots,
        settings,
        displayDate,
        isAveraged
      );
      canvas.toBlob((blob) => {
        if (blob) {
          triggerSafeDownload(blob, filename);
          showToast(isUrdu ? 'بل پرچی کی تصویر محفوظ ہو گئی ہے!' : 'Bill image downloaded!');
        }
      }, 'image/png', 0.98);
    } catch (err) {
      console.error('Save image error:', err);
      showToast(isUrdu ? 'تصویر تیار کرنے میں خرابی ہوئی' : 'Failed to generate image');
    }
  };

  // 3. Share via Web Share API / WhatsApp
  const handleShare = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingPDF(true);

    const sanitizedName = vendorName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
    const finalPdfName = `Vendor_Bill_${sanitizedName}_${displayDate}.pdf`;

    const itemsToShare = isAveraged ? averagedProductItems : allProductItems;
    const productListText = itemsToShare
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.productUrdu}: ${item.quantity} ${item.unitLabel} @ ${isAveraged ? 'اوسط ریٹ ' : ''}Rs.${item.ratePerUnit} = ${formatPKR(item.totalAmount, settings.currencySymbol, settings.language)}`
      )
      .join('\n');

    const messageText = `*${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}*
📋 *${isAveraged ? 'پکی پرچی رسید برائے زمیندار (خلاصہ اجناس وار)' : 'پکی پرچی رسید برائے زمیندار'}*
━━━━━━━━━━━━━━━━━
👤 *زمیندار:* ${vendorName} ${vendorCity ? `(${vendorCity})` : ''}
📅 *تاریخ:* ${displayDate}

📦 *تفصیلِ فروخت اجناس (${isAveraged ? 'اجناس وار اوسط ریٹ' : 'تفصیلی'}):*
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

    try {
      const { blob } = await buildVendorBillPDF();

      setShareModalItem({
        title: `بل رسید برائے زمیندار: ${vendorName}`,
        subtitle: `${lots.length} لاٹیں • ${displayDate} ${isAveraged ? '(اوسط بل)' : ''}`,
        formattedText: messageText,
        recipientName: vendorName,
        recipientPhone: vendorPhone,
        fileBlob: blob,
        fileName: finalPdfName,
        fileType: 'pdf',
        extraDetails: [
          { label: 'کل رقم', value: formatPKR(totals.grossSales, '₨', 'en') },
          { label: 'کٹوتیاں', value: formatPKR(totals.totalExpenses, '₨', 'en') },
          { label: 'صافی رقم', value: formatPKR(totals.netPayable, '₨', 'en') },
        ],
      });
    } catch (err) {
      console.warn('Share error, opening text share modal:', err);
      setShareModalItem({
        title: `بل رسید برائے زمیندار: ${vendorName}`,
        subtitle: `${lots.length} لاٹیں • ${displayDate}`,
        formattedText: messageText,
        recipientName: vendorName,
        recipientPhone: vendorPhone,
        extraDetails: [
          { label: 'صافی رقم', value: formatPKR(totals.netPayable, '₨', 'en') },
        ],
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 4. Copy Text Summary
  const handleCopyText = () => {
    sound.playTick();
    const itemsToCopy = isAveraged ? averagedProductItems : allProductItems;
    const itemsText = itemsToCopy
      .map(
        (item, idx) =>
          `${idx + 1}. ${item.productUrdu}: ${item.quantity} ${item.unitLabel} @ ${isAveraged ? 'اوسط ریٹ ' : ''}Rs.${item.ratePerUnit} = ${formatPKR(item.totalAmount, settings.currencySymbol, settings.language)}`
      )
      .join('\n');

    const text = `*${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}*
${isAveraged ? 'خلاصہ بل برائے زمیندار (اجناس وار اوسط ریٹ)' : 'پکی پرچی رسید برائے زمیندار'} - ${vendorName}
تاریخ: ${displayDate}
${itemsText}
کل فروخت: ${formatPKR(totals.grossSales, settings.currencySymbol, settings.language)}
کل کٹوتیاں: ${formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}
صافی واجب الادا: ${formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    showToast(isUrdu ? 'متن کاپی ہو گیا!' : 'Text summary copied!');
  };

  // 5. Clean Universal Half Landscape A4 Print
  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    printVendorBillSlipA4(vendorName, vendorPhone, vendorCity, lots, settings, displayDate, isAveraged);
  };

  // 6. 80mm POS Thermal Print
  const handleThermalPrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    printConsolidatedThermalPOSReceipt(vendorName, vendorPhone, vendorCity, lots, settings, displayDate, isAveraged);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex-none bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-lg z-20 gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Quick Back / Close Button on top-left/start */}
          <button
            type="button"
            onClick={() => {
              sound.playTick();
              onClose();
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition shadow-xs flex-shrink-0"
            title="واپس جائیں (Back / Close)"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          </button>

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-xs flex-shrink-0 hidden sm:flex">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-base font-black text-amber-300 font-urdu-nastaliq tracking-wide truncate">
                {isUrdu ? 'پکی پرچی بل برائے زمیندار' : 'Vendor Bill Slip'}
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex-shrink-0">
                {lots.length} {isUrdu ? 'لاٹ' : 'Lots'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 font-urdu-sans truncate">
              {vendorName} {vendorCity ? `(${vendorCity})` : ''} • {displayDate}
            </p>
          </div>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Averaged Bill Toggle Option (بڑی لسٹ کیلئے اجناس وار اوسط بل کا آپشن) */}
          <button
            type="button"
            onClick={() => {
              sound.playTick();
              setIsAveraged(!isAveraged);
            }}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border flex items-center gap-1.5 transition active:scale-95 text-xs font-bold font-urdu-sans shadow-xs ${
              isAveraged
                ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/40 shadow-amber-500/20 shadow-md'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
            title="بڑی لسٹ کیلئے اجناس وار اوسط ریٹ اور بل دیکھیں"
          >
            <span
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black ${
                isAveraged ? 'bg-slate-950 text-amber-400' : 'bg-slate-700 text-slate-400'
              }`}
            >
              {isAveraged ? '✓' : ''}
            </span>
            <span className="hidden sm:inline">
              {isAveraged ? 'اجناس وار اوسط بل (فعال ہے)' : 'اجناس وار اوسط بل'}
            </span>
            <span className="sm:hidden">
              {isAveraged ? 'اوسط بل ✓' : 'اوسط بل'}
            </span>
          </button>

          {/* Zoom Controls */}
          <div className="hidden md:flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-slate-300">
            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition active:scale-95 text-slate-400 hover:text-white"
              title="چھوٹا کریں (Zoom Out)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono font-bold text-slate-300 min-w-[3.5rem] text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(180, z + 15))}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition active:scale-95 text-slate-400 hover:text-white"
              title="بڑا کریں (Zoom In)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition active:scale-95 text-slate-400 hover:text-white border-r border-slate-800"
              title="ری سیٹ (Reset Zoom)"
              aria-label="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 1. Print A4 Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center transition active:scale-90 shadow-md"
            title="پرنٹ کریں (Print Half Landscape A4 Slip)"
            aria-label="Print A4"
          >
            <Printer className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          {/* 2. 80mm POS Thermal Print */}
          <button
            type="button"
            onClick={handleThermalPrint}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 border border-amber-400 text-slate-950 flex items-center justify-center transition active:scale-90 shadow-md font-bold"
            title="80mm تھرمل پرنٹر (POS Thermal Receipt)"
            aria-label="Thermal Receipt"
          >
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>

          {/* 3. Save PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white flex items-center justify-center transition active:scale-90 shadow-md disabled:opacity-50"
            title="پی ڈی ایف محفوظ کریں (Save PDF Slip)"
            aria-label="Save PDF"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            )}
          </button>

          {/* 4. Share PDF / WhatsApp Button */}
          <button
            type="button"
            onClick={handleShare}
            disabled={isExportingPDF}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-teal-500 hover:bg-teal-400 border border-teal-400 text-slate-950 flex items-center justify-center transition active:scale-90 shadow-md disabled:opacity-50"
            title="پی ڈی ایف یا بل شیئر کریں (Share Bill / PDF)"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>

          {/* 5. Copy Text Button */}
          <button
            type="button"
            onClick={handleCopyText}
            className="hidden sm:flex w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 items-center justify-center transition active:scale-90 shadow-sm"
            title={isCopied ? t.copied : t.copyText}
            aria-label="Copy Text"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
          </button>

          {/* 6. Highly Visible Close Modal Button */}
          <button
            type="button"
            onClick={() => {
              sound.playTick();
              onClose();
            }}
            className="h-8 px-2.5 sm:h-10 sm:px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 border border-rose-400 text-white flex items-center justify-center gap-1 transition active:scale-90 shadow-lg font-bold font-urdu-sans text-xs ml-1"
            title="بند کریں (Close)"
            aria-label="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            <span className="hidden sm:inline">{isUrdu ? 'بند کریں' : 'Close'}</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {shareSuccessToast && (
        <div className="bg-emerald-950 border-b border-emerald-600/40 text-emerald-200 px-4 py-2 text-xs font-bold font-urdu-sans flex items-center justify-center gap-2 animate-in fade-in z-30">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{shareSuccessToast}</span>
        </div>
      )}

      {/* Authentic Mandi Bill Interactive Preview Container */}
      <div 
        onClick={(e) => {
          // If clicked directly on the backdrop container (not the document itself)
          if (e.target === e.currentTarget) {
            sound.playTick();
            onClose();
          }
        }}
        className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-6 flex justify-center items-start bg-slate-950/70 cursor-pointer"
        title="باہر کلک کر کے بند کریں"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="transition-all duration-150 ease-out flex justify-center max-w-full cursor-default my-2"
          style={{
            width: `${zoomLevel}%`,
            maxWidth: '820px',
            minWidth: '320px',
          }}
        >
          <InsafMandiBillView
            vendorName={vendorName}
            vendorPhone={vendorPhone}
            vendorCity={vendorCity}
            lots={lots}
            settings={settings}
            dateLabel={displayDate}
            isAveraged={isAveraged}
            billNumber="101"
            className="rounded-xl overflow-hidden shadow-2xl"
          />
        </div>
      </div>

      {/* Mobile Floating Action Bar for Quick Printing/PDF */}
      <div className="sm:hidden flex-none bg-slate-900 border-t border-slate-800 p-2.5 flex items-center justify-between gap-1.5 z-20">
        <button
          onClick={() => {
            sound.playTick();
            setIsAveraged(!isAveraged);
          }}
          className={`py-2 px-2.5 rounded-xl border font-bold text-xs font-urdu-sans flex items-center justify-center gap-1 active:scale-95 shadow-xs ${
            isAveraged
              ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          <span>{isAveraged ? 'اوسط بل ✓' : 'اوسط بل'}</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex-1 py-2 px-2 rounded-xl bg-slate-950 border border-slate-700 text-emerald-400 font-bold text-xs font-urdu-sans flex items-center justify-center gap-1 active:scale-95 shadow-xs"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{isUrdu ? 'پرنٹ' : 'Print'}</span>
        </button>

        <button
          onClick={handleThermalPrint}
          className="flex-1 py-2 px-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs font-urdu-sans flex items-center justify-center gap-1 active:scale-95 shadow-xs"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{isUrdu ? 'تھرمل' : 'POS'}</span>
        </button>

        <button
          onClick={handleDownloadPDF}
          disabled={isExportingPDF}
          className="flex-1 py-2 px-2 rounded-xl bg-emerald-600 text-white font-bold text-xs font-urdu-sans flex items-center justify-center gap-1 active:scale-95 shadow-xs disabled:opacity-50"
        >
          {isExportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isUrdu ? 'محفوظ' : 'Save'}</span>
        </button>

        <button
          onClick={handleShare}
          disabled={isExportingPDF}
          className="flex-1 py-2 px-2 rounded-xl bg-teal-600 text-white font-bold text-xs font-urdu-sans flex items-center justify-center gap-1 active:scale-95 shadow-xs disabled:opacity-50"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{isUrdu ? 'شیئر' : 'Share'}</span>
        </button>

        <button
          onClick={() => {
            sound.playTick();
            onClose();
          }}
          className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 border border-rose-400 text-white font-bold text-xs font-urdu-sans flex items-center justify-center gap-1 active:scale-95 shadow-xs"
          title="بند کریں (Close)"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

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
