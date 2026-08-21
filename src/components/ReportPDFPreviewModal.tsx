import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { sound } from '../utils/sound';
import { PDFPreviewData } from '../utils/pdfReportGenerator';
import { formatPKR } from '../utils/currency';
import {
  X,
  Download,
  Printer,
  Share2,
  Loader2,
  Check,
} from 'lucide-react';

// Helper: Safely converts modern CSS colors to RGB for canvas rendering
function sanitizeColorToRgb(colorStr: string, canvasCtx?: CanvasRenderingContext2D | null): string {
  if (!colorStr || typeof colorStr !== 'string') return colorStr;
  if (!colorStr.includes('oklch') && !colorStr.includes('oklab') && !colorStr.includes('color(')) {
    return colorStr;
  }
  return colorStr.replace(/(?:oklch|oklab|color)\([^)]+\)/gi, (match) => {
    if (canvasCtx) {
      try {
        canvasCtx.fillStyle = '#000000';
        canvasCtx.fillStyle = match;
        return canvasCtx.fillStyle;
      } catch {
        return '#000000';
      }
    }
    return '#000000';
  });
}

function sanitizeClonedDocumentColors(clonedDoc: Document): void {
  try {
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 1;
    canvas2d.height = 1;
    const ctx = canvas2d.getContext('2d');

    const win = clonedDoc.defaultView || window;
    const origGetComputedStyle = win.getComputedStyle.bind(win);

    win.getComputedStyle = function (el: Element, pseudo?: string | null) {
      const style = origGetComputedStyle(el, pseudo);
      return new Proxy(style, {
        get(target, prop, receiver) {
          const val = Reflect.get(target, prop, receiver);
          if (typeof val === 'string' && (val.includes('oklch') || val.includes('color(') || val.includes('oklab'))) {
            return sanitizeColorToRgb(val, ctx);
          }
          if (typeof val === 'function') {
            if (prop === 'getPropertyValue') {
              return (propertyName: string) => {
                const res = target.getPropertyValue(propertyName);
                if (typeof res === 'string' && (res.includes('oklch') || res.includes('color(') || res.includes('oklab'))) {
                  return sanitizeColorToRgb(res, ctx);
                }
                return res;
              };
            }
            return val.bind(target);
          }
          return val;
        },
      });
    };

    clonedDoc.querySelectorAll('style').forEach((styleTag) => {
      if (styleTag.textContent && (styleTag.textContent.includes('oklch') || styleTag.textContent.includes('color(') || styleTag.textContent.includes('oklab'))) {
        styleTag.textContent = sanitizeColorToRgb(styleTag.textContent, ctx);
      }
    });

    const colorProps = [
      'color',
      'backgroundColor',
      'borderColor',
      'borderTopColor',
      'borderBottomColor',
      'borderLeftColor',
      'borderRightColor',
      'outlineColor',
      'textDecorationColor',
      'fill',
      'stroke',
      'boxShadow',
    ];

    clonedDoc.querySelectorAll('*').forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl && htmlEl.style) {
        colorProps.forEach((prop) => {
          try {
            const val = (htmlEl.style as any)[prop];
            if (val && typeof val === 'string' && (val.includes('oklch') || val.includes('color(') || val.includes('oklab'))) {
              (htmlEl.style as any)[prop] = sanitizeColorToRgb(val, ctx);
            }
          } catch {
            // ignore
          }
        });
      }
    });

    const el = clonedDoc.getElementById('printable-report-document');
    if (el) {
      el.style.fontFamily = "'Noto Nastaliq Urdu', 'Noto Sans Arabic', 'Gulzar', Tahoma, sans-serif";
      el.style.transform = 'none';
    }
  } catch (err) {
    console.warn('Error during cloned document color sanitization:', err);
  }
}

interface ReportPDFPreviewModalProps {
  previewData: PDFPreviewData | null;
  onClose: () => void;
  isUrdu?: boolean;
}

export const ReportPDFPreviewModal: React.FC<ReportPDFPreviewModalProps> = ({
  previewData,
  onClose,
  isUrdu = true,
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const documentRef = useRef<HTMLDivElement>(null);

  if (!previewData) return null;

  const { settings, title, filename, dateFilterLabel, dateRangeStr, generatedDate } = previewData;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const triggerSafeDownload = (blob: Blob, downloadFileName: string) => {
    try {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = downloadFileName;
      link.target = '_self';
      link.rel = 'noopener noreferrer';
      link.onclick = (e) => e.stopPropagation();
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
      }, 3000);
    } catch (e) {
      console.error('Trigger safe download error:', e);
    }
  };

  // High-Resolution Pixel-Perfect Urdu PDF Download (html2canvas to jsPDF ensures 100% genuine Urdu Nastaliq)
  const handleDownloadPDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingPDF(true);

    const finalPdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    try {
      if (!documentRef.current) {
        throw new Error('Document container not found');
      }

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          sanitizeClonedDocumentColors(clonedDoc);
        },
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfPageWidth = 210; // A4 mm
      const pdfPageHeight = 297; // A4 mm
      
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
          pdf.addPage('a4', 'p');
        }
        
        const renderedSliceMmHeight = (sliceHeight * pdfPageWidth) / canvas.width;
        pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfPageWidth, renderedSliceMmHeight, undefined, 'FAST');

        renderedHeight += sliceHeight;
        pageIndex++;
      }

      const pdfBlob = pdf.output('blob');
      triggerSafeDownload(pdfBlob, finalPdfName);
      showToast(isUrdu ? 'پی ڈی ایف کامیابی سے ڈاؤن لوڈ ہو گئی ہے!' : 'PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      // Fallback: direct browser print
      window.print();
      showToast(isUrdu ? 'رپورٹ پرنٹ ونڈو کھول دی گئی ہے' : 'Print window opened');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Clean Direct Browser Print
  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    window.print();
  };

  // Share to WhatsApp
  const handleShareWhatsApp = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    const shopTitle = isUrdu ? settings.shopNameUrdu : settings.shopNameEn;
    const text = `*${shopTitle}*\n📄 *${title}*\n📅 دورانیہ: ${dateFilterLabel || 'تمام ریکارڈ'}\nفائل: ${filename}\n\nڈیجیٹل منڈی منشی سسٹم سے تیار کردہ تصدیق شدہ رپورٹ۔`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Simple, Clean Modal Dialog */}
      <div className="bg-slate-900 w-full max-w-4xl h-[92vh] max-h-[850px] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-slate-700/80">
        
        {/* Simple Top Header Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 text-white flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-white font-urdu-nastaliq truncate">
                {title}
              </h3>
              {dateFilterLabel && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold font-urdu-sans flex-shrink-0">
                  {dateFilterLabel}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {filename}
            </p>
          </div>

          {/* Clean Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Download PDF (Primary) */}
            <button
              type="button"
              onClick={(e) => handleDownloadPDF(e)}
              disabled={isExportingPDF}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans shadow-sm disabled:opacity-50"
              title="پی ڈی ایف ڈاؤن لوڈ کریں"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>
                {isExportingPDF ? 'تیار ہو رہا ہے...' : 'پی ڈی ایف ڈاؤن لوڈ'}
              </span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={(e) => handlePrint(e)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans"
              title="پرنٹ کریں"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">پرنٹ</span>
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={(e) => handleShareWhatsApp(e)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/70 active:scale-95 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans"
              title="واٹس ایپ پر بھیجیں"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              title="بند کریں"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-950 border-b border-emerald-600/50 text-emerald-200 px-4 py-2 text-xs font-bold font-urdu-sans flex items-center gap-2 animate-in fade-in flex-shrink-0">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Document Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/60 flex justify-center">
          <div
            ref={documentRef}
            id="printable-report-document"
            className="w-full max-w-[800px] bg-white text-slate-900 shadow-xl rounded-xl border border-slate-300 p-6 sm:p-8 font-urdu-sans space-y-5 print:border-none print:shadow-none print:m-0 print:p-4 print:max-w-none print:w-full"
            style={{
              fontFamily: "'Noto Nastaliq Urdu', 'Noto Sans Arabic', Tahoma, sans-serif",
            }}
          >
            {/* Header: Shop Details */}
            <div className="text-center space-y-1 pb-4 border-b-2 border-slate-900">
              <div className="font-urdu-nastaliq text-base font-bold text-slate-900">
                بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
              </div>

              <h1 className="text-2xl sm:text-3xl font-black font-urdu-nastaliq text-slate-950 leading-tight">
                {isUrdu ? settings.shopNameUrdu : settings.shopNameEn}
              </h1>

              <p className="text-xs sm:text-sm font-semibold text-slate-800">
                پروپرائٹر: <span className="font-bold font-urdu-nastaliq">{isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn}</span>
              </p>

              <p className="text-xs text-slate-600">
                📍 {isUrdu ? settings.shopAddressUrdu : settings.shopAddressEn} • 📞 فون: {settings.shopPhone}
              </p>

              {/* Report Title & Metadata Box */}
              <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-300">
                <div className="text-start">
                  <span className="text-slate-500 font-bold block text-[10px]">رپورٹ کی قسم:</span>
                  <strong className="text-slate-900 font-bold font-urdu-nastaliq text-sm">{title}</strong>
                </div>

                <div className="text-start">
                  <span className="text-slate-500 font-bold block text-[10px]">دورانیہ / تاریخ:</span>
                  <strong className="text-slate-900 font-bold">{dateFilterLabel || dateRangeStr || 'تمام ریکارڈ'}</strong>
                </div>

                <div className="text-start">
                  <span className="text-slate-500 font-bold block text-[10px]">تاریخِ اجراء:</span>
                  <strong className="text-slate-700 font-mono text-xs">{generatedDate || new Date().toISOString().slice(0, 10)}</strong>
                </div>
              </div>
            </div>

            {/* Summary Statistics Cards */}
            {previewData.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-start">
                  <span className="text-[10px] text-slate-500 font-bold block">کل فروخت (Gross):</span>
                  <strong className="text-sm font-bold text-slate-950 font-numbers block">
                    {formatPKR(previewData.summary.grossSales, '₨', 'en')}
                  </strong>
                </div>

                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-start">
                  <span className="text-[10px] text-emerald-800 font-bold block">کمیشن آمدن:</span>
                  <strong className="text-sm font-bold text-emerald-950 font-numbers block">
                    {formatPKR(previewData.summary.commission, '₨', 'en')}
                  </strong>
                </div>

                {previewData.summary.cashReceived !== undefined && (
                  <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200 text-start">
                    <span className="text-[10px] text-blue-800 font-bold block">وصول شدہ نقد:</span>
                    <strong className="text-sm font-bold text-blue-950 font-numbers block">
                      {formatPKR(previewData.summary.cashReceived, '₨', 'en')}
                    </strong>
                  </div>
                )}

                {previewData.summary.creditPending !== undefined && (
                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200 text-start">
                    <span className="text-[10px] text-rose-800 font-bold block">بقایا ادھار (کھاتہ):</span>
                    <strong className="text-sm font-bold text-rose-950 font-numbers block">
                      {formatPKR(previewData.summary.creditPending, '₨', 'en')}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* MAIN REPORT TABLES */}
            {/* 1. Date Wise Summary Rows */}
            {previewData.dateRows && previewData.dateRows.length > 0 && (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold">
                      <th className="py-2 px-2 text-start w-8">#</th>
                      <th className="py-2 px-2 text-start">لاٹ #</th>
                      <th className="py-2 px-2 text-start">تاریخ</th>
                      <th className="py-2 px-2.5 text-start">زمیندار</th>
                      <th className="py-2 px-2 text-start">جنس</th>
                      <th className="py-2 px-2 text-center">آمد / فروخت</th>
                      <th className="py-2 px-2.5 text-end">کل فروخت</th>
                      <th className="py-2 px-2.5 text-end">کمیشن</th>
                      <th className="py-2 px-2.5 text-end">صافی رقم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewData.dateRows.map((r, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="py-1.5 px-2 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-mono font-bold text-slate-800">#{r.lotNumber}</td>
                        <td className="py-1.5 px-2 font-mono text-slate-600">{r.date}</td>
                        <td className="py-1.5 px-2.5 font-bold text-slate-900 font-urdu-nastaliq">{r.vendor}</td>
                        <td className="py-1.5 px-2 font-bold text-slate-800">{r.product}</td>
                        <td className="py-1.5 px-2 text-center font-mono">{r.soldQty} / {r.totalQty}</td>
                        <td className="py-1.5 px-2.5 text-end font-bold font-mono">{formatPKR(r.grossSales, '', 'en')}</td>
                        <td className="py-1.5 px-2.5 text-end text-emerald-800 font-mono">{formatPKR(r.commission, '', 'en')}</td>
                        <td className="py-1.5 px-2.5 text-end font-bold text-slate-950 font-mono">{formatPKR(r.netPayable, '', 'en')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. Customer Wise Rows */}
            {previewData.customerRows && previewData.customerRows.length > 0 && (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold">
                      <th className="py-2 px-2 text-start w-8">#</th>
                      <th className="py-2 px-3 text-start">گاہک / خریدار</th>
                      <th className="py-2 px-2 text-start">فون نمبر</th>
                      <th className="py-2 px-2 text-center">خریداری تعداد</th>
                      <th className="py-2 px-2.5 text-end">کل مال خریدا</th>
                      <th className="py-2 px-2.5 text-end">نقد وصولی</th>
                      <th className="py-2 px-2.5 text-end">بقایا ادھار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewData.customerRows.map((c, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="py-2 px-2 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 font-urdu-nastaliq">{c.customerName}</td>
                        <td className="py-2 px-2 font-mono text-slate-600">{c.phone || '-'}</td>
                        <td className="py-2 px-2 text-center font-mono">{c.unitsBought}</td>
                        <td className="py-2 px-2.5 text-end font-bold font-mono">{formatPKR(c.totalAmount, '', 'en')}</td>
                        <td className="py-2 px-2.5 text-end text-emerald-800 font-mono">{formatPKR(c.cashPaid, '', 'en')}</td>
                        <td className="py-2 px-2.5 text-end font-bold text-rose-800 font-mono">{formatPKR(c.creditPending, '', 'en')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Vendor Wise Rows */}
            {previewData.vendorRows && previewData.vendorRows.length > 0 && (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold">
                      <th className="py-2 px-2 text-start w-8">#</th>
                      <th className="py-2 px-3 text-start">زمیندار / کاشتکار</th>
                      <th className="py-2 px-2 text-start">شہر</th>
                      <th className="py-2 px-2 text-center">لاٹس</th>
                      <th className="py-2 px-2 text-center">کل نگ / فروخت</th>
                      <th className="py-2 px-2.5 text-end">کل فروخت رقم</th>
                      <th className="py-2 px-2.5 text-end">کمیشن</th>
                      <th className="py-2 px-2.5 text-end">صافی واجب الادا</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewData.vendorRows.map((v, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="py-2 px-2 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 font-urdu-nastaliq">{v.vendorName}</td>
                        <td className="py-2 px-2 text-slate-600">{v.city || '-'}</td>
                        <td className="py-2 px-2 text-center font-mono">{v.lotsCount}</td>
                        <td className="py-2 px-2 text-center font-mono">{v.unitsSold} / {v.totalUnits}</td>
                        <td className="py-2 px-2.5 text-end font-bold font-mono">{formatPKR(v.grossSales, '', 'en')}</td>
                        <td className="py-2 px-2.5 text-end text-emerald-800 font-mono">{formatPKR(v.commission, '', 'en')}</td>
                        <td className="py-2 px-2.5 text-end font-bold text-slate-950 font-mono">{formatPKR(v.netPayable, '', 'en')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. Product Wise Rows */}
            {previewData.productRows && previewData.productRows.length > 0 && (
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold">
                      <th className="py-2 px-2 text-start w-8">#</th>
                      <th className="py-2 px-3 text-start">جنس کا نام</th>
                      <th className="py-2 px-2 text-center">کل لاٹس</th>
                      <th className="py-2 px-2 text-center">آمد / فروخت</th>
                      <th className="py-2 px-2.5 text-end">کل ٹرن اوور</th>
                      <th className="py-2 px-2.5 text-end">اوسط ریٹ</th>
                      <th className="py-2 px-2.5 text-end">کمیشن کمایا</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewData.productRows.map((p, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="py-2 px-2 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 font-urdu-nastaliq">{p.productName}</td>
                        <td className="py-2 px-2 text-center font-mono">{p.totalLots}</td>
                        <td className="py-2 px-2 text-center font-mono">{p.soldUnits} / {p.totalUnits}</td>
                        <td className="py-2 px-2.5 text-end font-bold font-mono">{formatPKR(p.grossTurnover, '', 'en')}</td>
                        <td className="py-2 px-2.5 text-end font-mono">Rs.{Math.round(p.avgRate)}</td>
                        <td className="py-2 px-2.5 text-end text-emerald-800 font-bold font-mono">{formatPKR(p.commission, '', 'en')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Signatures & Verification */}
            <div className="pt-8 border-t border-slate-300 flex justify-between items-center text-xs">
              <div className="text-center">
                <div className="w-40 border-b border-slate-400 mb-1"></div>
                <span className="font-bold text-slate-700">دستخط منشی / کیشیئر</span>
              </div>

              <div className="text-center">
                <div className="w-40 border-b border-slate-400 mb-1"></div>
                <span className="font-bold text-slate-700">دستخط و مہر آڑھتی صاحب</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-2 font-mono">
              Computerized Report generated by Digital Mandi Munshi System • {generatedDate}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
