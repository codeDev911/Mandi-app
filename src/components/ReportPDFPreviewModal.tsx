import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { sound } from '../utils/sound';
import { PDFPreviewData } from '../utils/pdfReportGenerator';
import { formatPKR } from '../utils/currency';
import { unitLabels } from '../utils/localization';
import { ensureUrduFontsLoaded } from '../utils/receiptGenerator';
import {
  X,
  Download,
  Printer,
  Eye,
  FileText,
  Share2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  CheckCircle,
  Building2,
  Calendar,
  Layers,
  Image as ImageIcon,
  Loader2,
  Check,
  User,
  Package,
} from 'lucide-react';

// Helper: Safely converts any modern CSS color strings (oklch, oklab, color()) to standard rgb/rgba strings
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

    // 1. Intercept getComputedStyle in cloned document to sanitize any oklch returned by the browser
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

    // 2. Sanitize all <style> tags in the cloned document
    clonedDoc.querySelectorAll('style').forEach((styleTag) => {
      if (styleTag.textContent && (styleTag.textContent.includes('oklch') || styleTag.textContent.includes('color(') || styleTag.textContent.includes('oklab'))) {
        styleTag.textContent = sanitizeColorToRgb(styleTag.textContent, ctx);
      }
    });

    // 3. Explicitly sanitize inline styles on all elements
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
            // ignore property access error
          }
        });
      }
    });

    // 4. Set font & clean transforms on root report container
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const documentRef = useRef<HTMLDivElement>(null);

  if (!previewData) return null;

  const { settings, title, filename, reportType, dateFilterLabel, dateRangeStr, generatedDate } = previewData;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Safe file download helper that operates cleanly inside sandboxed iframes without navigating the window
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
        try {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
          window.URL.revokeObjectURL(url);
        } catch {
          // ignore cleanup errors
        }
      }, 2000);
    } catch (err) {
      console.error('Safe download error:', err);
    }
  };

  // 1. Download as High-Resolution Pixel-Perfect PDF (with genuine Urdu Nastaliq typography)
  const handleDownloadPDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingPDF(true);

    try {
      if (!documentRef.current) {
        throw new Error('Document container not found');
      }

      // Pre-load and verify all Urdu Nastaliq & Arabic fonts
      await ensureUrduFontsLoaded();
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Small delay to ensure browser layout & font rendering passes are finalized
      await new Promise((resolve) => setTimeout(resolve, 80));

      // Capture at high resolution (scale 2.2 for crisp typography and clean lines)
      const canvas = await html2canvas(documentRef.current, {
        scale: 2.2,
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
      
      // Calculate how many canvas pixels correspond to one A4 page
      const pxPageHeight = Math.floor((canvas.width * pdfPageHeight) / pdfPageWidth);
      const totalCanvasHeight = canvas.height;
      let renderedHeight = 0;
      let pageIndex = 0;

      while (renderedHeight < totalCanvasHeight) {
        const sliceHeight = Math.min(pxPageHeight, totalCanvasHeight - renderedHeight);
        
        // Create an isolated sub-canvas for this specific page slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, renderedHeight, canvas.width, sliceHeight, // source slice
            0, 0, canvas.width, sliceHeight // destination
          );
        }
        
        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98);
        const sliceHeightMm = (sliceHeight * pdfPageWidth) / canvas.width;
        
        if (pageIndex > 0) {
          pdf.addPage();
        }
        pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfPageWidth, sliceHeightMm, undefined, 'FAST');
        
        renderedHeight += sliceHeight;
        pageIndex++;
      }

      const pdfBlob = pdf.output('blob');
      const finalPdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      triggerSafeDownload(pdfBlob, finalPdfName);
      showToast(isUrdu ? 'پی ڈی ایف کامیابی سے ڈاؤن لوڈ ہو گئی ہے!' : 'PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast(isUrdu ? 'پی ڈی ایف بنانے میں مسئلہ پیش آیا، براہِ کرم دوبارہ کوشش کریں' : 'Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 2. Download as High-Resolution PNG Image
  const handleDownloadImage = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingImage(true);

    try {
      if (!documentRef.current) {
        throw new Error('Document container not found');
      }

      await ensureUrduFontsLoaded();
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 80));

      const canvas = await html2canvas(documentRef.current, {
        scale: 2.2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          sanitizeClonedDocumentColors(clonedDoc);
        },
      });

      const finalImgName = filename.replace(/\.pdf$/i, '') + '.png';

      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) {
            triggerSafeDownload(blob, finalImgName);
            showToast(isUrdu ? 'رپورٹ کی تصویر کامیابی سے محفوظ ہو گئی ہے!' : 'Report image downloaded successfully!');
          } else {
            // Fallback converting dataURL to Blob
            const byteString = atob(canvas.toDataURL('image/png').split(',')[1]);
            const mimeString = 'image/png';
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const safeBlob = new Blob([ab], { type: mimeString });
            triggerSafeDownload(safeBlob, finalImgName);
            showToast(isUrdu ? 'رپورٹ کی تصویر کامیابی سے محفوظ ہو گئی ہے!' : 'Report image downloaded successfully!');
          }
          setIsExportingImage(false);
        }, 'image/png');
      } else {
        const byteString = atob(canvas.toDataURL('image/png').split(',')[1]);
        const mimeString = 'image/png';
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const safeBlob = new Blob([ab], { type: mimeString });
        triggerSafeDownload(safeBlob, finalImgName);
        showToast(isUrdu ? 'رپورٹ کی تصویر کامیابی سے محفوظ ہو گئی ہے!' : 'Report image downloaded successfully!');
        setIsExportingImage(false);
      }
    } catch (err) {
      console.error('Image export error:', err);
      showToast(isUrdu ? 'تصویر بنانے میں خرابی ہوئی' : 'Failed to export image');
      setIsExportingImage(false);
    }
  };

  // 3. Clean Print
  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    window.print();
  };

  // 4. Share to WhatsApp
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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-0 sm:p-3 animate-in fade-in duration-200">
      {/* Main Container */}
      <div
        className={`bg-slate-900 flex flex-col overflow-hidden transition-all duration-300 shadow-2xl border border-slate-700/60 ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-5xl h-[94vh] max-h-[900px] rounded-2xl'
        }`}
      >
        {/* Top Control Bar */}
        <div className="bg-slate-900 border-b border-slate-800 p-3 sm:p-4 text-white flex items-center justify-between gap-2 sm:gap-4 flex-shrink-0">
          {/* Left: Info Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-sm text-white font-urdu-sans truncate flex items-center gap-1.5">
                <span>{title}</span>
                {dateFilterLabel && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 text-[10px]">
                    {dateFilterLabel}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {filename}
              </p>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Zoom Controls */}
            <div className="hidden md:flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
              <button
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
                title="زوم کم کریں"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold px-1.5 text-slate-300">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
                title="زوم بڑھائیں"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition ml-0.5"
                title="اصل سائز"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 ${
                isFullscreen
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 hover:bg-amber-600/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title={isFullscreen ? 'عام ویو پر واپس آئیں' : 'فل سکرین ویو کھولیں'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">عام سائز</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">فل سکرین (Full Screen)</span>
                </>
              )}
            </button>

            {/* Download PDF Button */}
            <button
              type="button"
              onClick={(e) => handleDownloadPDF(e)}
              disabled={isExportingPDF}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans shadow-sm disabled:opacity-50"
              title="پی ڈی ایف ڈاؤن لوڈ کریں"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {isExportingPDF ? 'تیار ہو رہا ہے...' : 'پی ڈی ایف ڈاؤن لوڈ (PDF)'}
              </span>
            </button>

            {/* Download Image Button */}
            <button
              type="button"
              onClick={(e) => handleDownloadImage(e)}
              disabled={isExportingImage}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans disabled:opacity-50"
              title="تصویر ڈاؤن لوڈ کریں"
            >
              {isExportingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span className="hidden md:inline">تصویر (PNG)</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={(e) => handlePrint(e)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans"
              title="پرنٹ کریں"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden md:inline">پرنٹ</span>
            </button>

            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={(e) => handleShareWhatsApp(e)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 active:scale-95 text-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans"
              title="واٹس ایپ پر بھیجیں"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition"
              title="بند کریں"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold font-urdu-sans text-center flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-200">
            <CheckCircle className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Document Scrollable Area */}
        <div className="flex-1 bg-slate-950/50 p-3 sm:p-6 overflow-y-auto overflow-x-auto flex justify-center">
          <div
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className="transition-transform duration-150 w-full max-w-[850px]"
          >
            {/* Real Printable & Renderable Mandi Document */}
            <div
              ref={documentRef}
              id="printable-report-document"
              className="bg-white text-slate-900 rounded-xl shadow-xl p-5 sm:p-8 border border-slate-200 font-urdu-sans dir-rtl text-right min-h-[950px] relative"
              dir="rtl"
            >
              {/* Document Header (آڑھت و دکان کا لیٹر ہیڈ) */}
              <div className="border-b-2 border-slate-900 pb-4 mb-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold mb-1.5">
                      ✓ تصدیق شدہ منڈی ریکارڈ
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black font-urdu-nastaliq text-slate-950 leading-relaxed">
                      {settings.shopNameUrdu || settings.shopNameEn || 'سبزی و پھل کمیشن شاپ'}
                    </h1>
                    <div className="text-xs sm:text-sm text-slate-700 font-urdu-nastaliq mt-1">
                      آڑھتی: <span className="font-bold text-slate-950">{settings.arhtiNameUrdu || settings.arhtiNameEn || 'آڑھتی صاحب'}</span>
                      {settings.shopPhone && ` | فون: ${settings.shopPhone}`}
                    </div>
                    {(settings.shopAddressUrdu || settings.shopAddressEn) && (
                      <div className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                        {settings.shopAddressUrdu || settings.shopAddressEn}
                      </div>
                    )}
                  </div>

                  <div className="text-left font-mono text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-900 font-urdu-sans text-right mb-1">
                      {reportType === 'date' && '📅 یومیہ روزنامچہ رپورٹ'}
                      {reportType === 'customer' && '👥 گاہک کھاتہ و بقایا جات'}
                      {reportType === 'product' && '📦 جنس وار تفصیلات و فروخت'}
                      {reportType === 'vendor' && '👨‍🌾 زمیندار / وینڈر مال رپورٹ'}
                      {reportType === 'entire_record' && '📑 جامع مکمل منڈی ریکارڈ'}
                      {reportType === 'single_lot' && '📦 لاٹ رپورٹ و بولی تفصیل'}
                      {reportType === 'single_customer' && '👤 گاہک تفصیلی اسٹیٹمنٹ'}
                      {reportType === 'single_product' && '📦 جنس تفصیلی رپورٹ'}
                      {reportType === 'single_vendor' && '👨‍🌾 زمیندار تفصیلی بل'}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      دورانیہ / فلٹر: <span className="font-bold text-slate-800 font-urdu-sans">{dateFilterLabel || 'تمام'}</span>
                    </div>
                    {dateRangeStr && (
                      <div className="text-[10px] text-slate-500 font-sans">
                        {dateRangeStr}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 font-sans mt-1">
                      تاریخ اجراء: {generatedDate || new Date().toLocaleDateString('en-PK')}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: SUMMARY METRIC BADGES (خلاصہ گوشوارہ) */}
              {previewData.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="text-[11px] text-slate-500 font-bold mb-1">کل مجموعی فروخت (Gross)</div>
                    <div className="text-base sm:text-lg font-black text-slate-950 font-numbers">
                      {formatPKR(previewData.summary.grossSales, settings.currencySymbol, settings.language)}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-2xs">
                    <div className="text-[11px] text-emerald-800 font-bold mb-1">کمیشن آمدنی (Commission)</div>
                    <div className="text-base sm:text-lg font-black text-emerald-700 font-numbers">
                      {formatPKR(previewData.summary.commission, settings.currencySymbol, settings.language)}
                    </div>
                  </div>

                  {previewData.summary.cashReceived !== undefined && (
                    <div className="bg-white p-3 rounded-lg border border-teal-200 shadow-2xs">
                      <div className="text-[11px] text-teal-800 font-bold mb-1">نقد وصولی (Cash)</div>
                      <div className="text-base sm:text-lg font-black text-teal-700 font-numbers">
                        {formatPKR(previewData.summary.cashReceived, settings.currencySymbol, settings.language)}
                      </div>
                    </div>
                  )}

                  {previewData.summary.creditPending !== undefined && (
                    <div className="bg-white p-3 rounded-lg border border-rose-200 shadow-2xs">
                      <div className="text-[11px] text-rose-800 font-bold mb-1">بقایا ادھار (Credit)</div>
                      <div className="text-base sm:text-lg font-black text-rose-700 font-numbers">
                        {formatPKR(previewData.summary.creditPending, settings.currencySymbol, settings.language)}
                      </div>
                    </div>
                  )}

                  {previewData.summary.vendorPayable !== undefined && (
                    <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-2xs">
                      <div className="text-[11px] text-amber-900 font-bold mb-1">صافی واجب الادا زمیندار</div>
                      <div className="text-base sm:text-lg font-black text-amber-800 font-numbers">
                        {formatPKR(previewData.summary.vendorPayable, settings.currencySymbol, settings.language)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* REPORT CONTENT BY REPORT TYPE */}

              {/* 1. DATE-WISE ROZNAMCHA TABLE */}
              {reportType === 'date' && previewData.dateRows && (
                <div className="mb-6">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq mb-2">
                    یومیہ لاٹس اور فروخت کا ریکارڈ
                  </h3>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-emerald-900 text-white font-bold">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">لاٹ نمبر</th>
                          <th className="py-2.5 px-3">آمد تاریخ</th>
                          <th className="py-2.5 px-3">زمیندار / وینڈر</th>
                          <th className="py-2.5 px-3">جنس / آئٹم</th>
                          <th className="py-2.5 px-3 text-center">فروخت / کل آمد</th>
                          <th className="py-2.5 px-3 text-left">کل فروخت</th>
                          <th className="py-2.5 px-3 text-left">کمیشن</th>
                          <th className="py-2.5 px-3 text-left">صافی زمیندار</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.dateRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-slate-500">اس مدت میں کوئی ریکارڈ موجود نہیں ہے۔</td>
                          </tr>
                        ) : (
                          previewData.dateRows.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold font-mono text-emerald-800">#{row.lotNumber}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">{row.date}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{row.vendor}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{row.product}</td>
                              <td className="py-2 px-3 text-center font-numbers">{row.soldQty} / {row.totalQty}</td>
                              <td className="py-2 px-3 text-left font-bold font-numbers">{formatPKR(row.grossSales, settings.currencySymbol, settings.language)}</td>
                              <td className="py-2 px-3 text-left font-numbers text-emerald-700">{formatPKR(row.commission, settings.currencySymbol, settings.language)}</td>
                              <td className="py-2 px-3 text-left font-bold font-numbers text-slate-900">{formatPKR(row.netPayable, settings.currencySymbol, settings.language)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                          <td colSpan={5} className="py-2.5 px-3">میزان کل (Total):</td>
                          <td className="py-2.5 px-3 text-center font-numbers">{previewData.dateRows.reduce((a, b) => a + b.soldQty, 0)}</td>
                          <td className="py-2.5 px-3 text-left font-numbers font-black text-slate-950">
                            {formatPKR(previewData.dateRows.reduce((a, b) => a + b.grossSales, 0), settings.currencySymbol, settings.language)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-numbers text-emerald-800 font-bold">
                            {formatPKR(previewData.dateRows.reduce((a, b) => a + b.commission, 0), settings.currencySymbol, settings.language)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-numbers font-black text-slate-950">
                            {formatPKR(previewData.dateRows.reduce((a, b) => a + b.netPayable, 0), settings.currencySymbol, settings.language)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. CUSTOMER REPORT TABLE */}
              {reportType === 'customer' && previewData.customerRows && (
                <div className="mb-6">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq mb-2">
                    خریداروں (گاہکوں) کا کھاتہ و بقایا جات
                  </h3>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white font-bold">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">گاہک کا نام</th>
                          <th className="py-2.5 px-3">فون نمبر</th>
                          <th className="py-2.5 px-3 text-center">کل بلز</th>
                          <th className="py-2.5 px-3 text-center">کل خریدی تعداد</th>
                          <th className="py-2.5 px-3 text-left">کل مالیت خرید</th>
                          <th className="py-2.5 px-3 text-left">نقد ادا شدہ</th>
                          <th className="py-2.5 px-3 text-left">بقایا ادھار</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.customerRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-500">اس مدت میں کوئی ریکارڈ موجود نہیں ہے۔</td>
                          </tr>
                        ) : (
                          previewData.customerRows.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{row.customerName}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">{row.phone || '-'}</td>
                              <td className="py-2 px-3 text-center font-numbers">{row.purchasesCount}</td>
                              <td className="py-2 px-3 text-center font-numbers font-semibold">{row.unitsBought}</td>
                              <td className="py-2 px-3 text-left font-bold font-numbers">{formatPKR(row.totalAmount, settings.currencySymbol, settings.language)}</td>
                              <td className="py-2 px-3 text-left font-numbers text-emerald-700">{formatPKR(row.cashPaid, settings.currencySymbol, settings.language)}</td>
                              <td className="py-2 px-3 text-left font-bold font-numbers text-rose-700">{formatPKR(row.creditPending, settings.currencySymbol, settings.language)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                          <td colSpan={3} className="py-2.5 px-3">میزان کل ({previewData.customerRows.length} گاہک):</td>
                          <td className="py-2.5 px-3 text-center font-numbers">{previewData.customerRows.reduce((a, b) => a + b.purchasesCount, 0)}</td>
                          <td className="py-2.5 px-3 text-center font-numbers">{previewData.customerRows.reduce((a, b) => a + b.unitsBought, 0)}</td>
                          <td className="py-2.5 px-3 text-left font-numbers font-black text-slate-950">
                            {formatPKR(previewData.customerRows.reduce((a, b) => a + b.totalAmount, 0), settings.currencySymbol, settings.language)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-numbers text-emerald-800 font-bold">
                            {formatPKR(previewData.customerRows.reduce((a, b) => a + b.cashPaid, 0), settings.currencySymbol, settings.language)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-numbers font-black text-rose-700">
                            {formatPKR(previewData.customerRows.reduce((a, b) => a + b.creditPending, 0), settings.currencySymbol, settings.language)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. PRODUCT REPORT TABLE */}
              {reportType === 'product' && previewData.productRows && (
                <div className="mb-6">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq mb-2">
                    اجناس کے نرخ، فروخت اور آمدنی کا گوشوارہ
                  </h3>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white font-bold">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">جنس کا نام</th>
                          <th className="py-2.5 px-3 text-center">کل لاٹس</th>
                          <th className="py-2.5 px-3 text-center">فروخت / کل آمد</th>
                          <th className="py-2.5 px-3 text-center">اوسط ریٹ</th>
                          <th className="py-2.5 px-3 text-center">کم سے کم / زیادہ ریٹ</th>
                          <th className="py-2.5 px-3 text-left">کل کاروبار (Turnover)</th>
                          <th className="py-2.5 px-3 text-left">کمیشن منافع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.productRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-500">اس مدت میں کوئی ریکارڈ موجود نہیں ہے۔</td>
                          </tr>
                        ) : (
                          previewData.productRows.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{row.productName}</td>
                              <td className="py-2 px-3 text-center font-numbers">{row.totalLots}</td>
                              <td className="py-2 px-3 text-center font-numbers">{row.soldUnits} / {row.totalUnits}</td>
                              <td className="py-2 px-3 text-center font-numbers font-semibold">
                                {row.avgRate > 0 ? formatPKR(row.avgRate, settings.currencySymbol, settings.language) : '-'}
                              </td>
                              <td className="py-2 px-3 text-center font-numbers text-slate-600">
                                {row.minRate > 0 ? `${row.minRate} - ${row.maxRate}` : '-'}
                              </td>
                              <td className="py-2 px-3 text-left font-bold font-numbers">{formatPKR(row.grossTurnover, settings.currencySymbol, settings.language)}</td>
                              <td className="py-2 px-3 text-left font-bold font-numbers text-emerald-700">{formatPKR(row.commission, settings.currencySymbol, settings.language)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                          <td colSpan={2} className="py-2.5 px-3">میزان کل:</td>
                          <td className="py-2.5 px-3 text-center font-numbers">{previewData.productRows.reduce((a, b) => a + b.totalLots, 0)}</td>
                          <td className="py-2.5 px-3 text-center font-numbers">{previewData.productRows.reduce((a, b) => a + b.soldUnits, 0)}</td>
                          <td colSpan={2}></td>
                          <td className="py-2.5 px-3 text-left font-numbers font-black text-slate-950">
                            {formatPKR(previewData.productRows.reduce((a, b) => a + b.grossTurnover, 0), settings.currencySymbol, settings.language)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-numbers text-emerald-800 font-black">
                            {formatPKR(previewData.productRows.reduce((a, b) => a + b.commission, 0), settings.currencySymbol, settings.language)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. VENDOR REPORT TABLE */}
              {reportType === 'vendor' && previewData.vendorRows && (
                <div className="mb-6">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq mb-2">
                    زمینداروں و وینڈرز کی سپلائی اور رقوم کا گوشوارہ
                  </h3>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-amber-950 text-white font-bold">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">زمیندار / وینڈر</th>
                          <th className="py-2.5 px-3">شہر / علاقہ</th>
                          <th className="py-2.5 px-3 text-center">لاٹس</th>
                          <th className="py-2.5 px-3 text-center">فروخت تعداد</th>
                          <th className="py-2.5 px-3 text-left">کل مالیت فروخت</th>
                          <th className="py-2.5 px-3 text-left">کمیشن</th>
                          <th className="py-2.5 px-3 text-left">صافی واجب الادا</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.vendorRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-500">اس مدت میں کوئی ریکارڈ موجود نہیں ہے۔</td>
                          </tr>
                        ) : (
                          previewData.vendorRows.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-slate-900">{row.vendorName}</td>
                              <td className="py-2 px-3 text-slate-600">{row.city || '-'}</td>
                              <td className="py-2 px-3 text-center font-numbers">{row.lotsCount}</td>
                              <td className="py-2 px-3 text-center font-numbers">{row.unitsSold} / {row.totalUnits}</td>
                              <td className="py-2 px-3 text-left font-bold font-numbers">{formatPKR(row.grossSales, settings.currencySymbol, settings.language)}</td>
                              <td className="py-2 px-3 text-left font-numbers text-emerald-700">{formatPKR(row.commission, settings.currencySymbol, settings.language)}</td>
                              <td className="py-2 px-3 text-left font-bold font-numbers text-slate-950">{formatPKR(row.netPayable, settings.currencySymbol, settings.language)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                          <td colSpan={3} className="py-2.5 px-3">میزان کل:</td>
                          <td className="py-2.5 px-3 text-center font-numbers">{previewData.vendorRows.reduce((a, b) => a + b.lotsCount, 0)}</td>
                          <td className="py-2.5 px-3 text-center font-numbers">{previewData.vendorRows.reduce((a, b) => a + b.unitsSold, 0)}</td>
                          <td className="py-2.5 px-3 text-left font-numbers font-black text-slate-950">
                            {formatPKR(previewData.vendorRows.reduce((a, b) => a + b.grossSales, 0), settings.currencySymbol, settings.language)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-numbers text-emerald-800 font-bold">
                            {formatPKR(previewData.vendorRows.reduce((a, b) => a + b.commission, 0), settings.currencySymbol, settings.language)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-numbers font-black text-slate-950">
                            {formatPKR(previewData.vendorRows.reduce((a, b) => a + b.netPayable, 0), settings.currencySymbol, settings.language)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. ENTIRE RECORD MASTER REPORT */}
              {reportType === 'entire_record' && previewData.entireLots && (
                <div className="space-y-6">
                  {/* Section 1: All Arrived Lots */}
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq mb-2">
                      ١. تمام موصولہ لاٹس اور نیلامی کا مکمل جائزہ
                    </h3>
                    <div className="border border-slate-300 rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead>
                          <tr className="bg-emerald-950 text-white font-bold">
                            <th className="py-2 px-2.5">#</th>
                            <th className="py-2 px-2.5">لاٹ نمبر</th>
                            <th className="py-2 px-2.5">آمد تاریخ</th>
                            <th className="py-2 px-2.5">زمیندار</th>
                            <th className="py-2 px-2.5">جنس</th>
                            <th className="py-2 px-2.5 text-center">فروخت / آمد</th>
                            <th className="py-2 px-2.5 text-left">کل فروخت</th>
                            <th className="py-2 px-2.5 text-left">کمیشن</th>
                            <th className="py-2 px-2.5 text-left">صافی رقم</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {previewData.entireLots.map((lot, idx) => (
                            <tr key={lot.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="py-1.5 px-2.5 font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-800">#{lot.lotNumber}</td>
                              <td className="py-1.5 px-2.5 font-mono text-slate-600">{lot.arrivalDate}</td>
                              <td className="py-1.5 px-2.5 font-bold text-slate-900">{lot.vendorName}</td>
                              <td className="py-1.5 px-2.5 font-bold text-slate-900">{lot.productUrdu || lot.productName}</td>
                              <td className="py-1.5 px-2.5 text-center font-numbers">{lot.summary.totalSoldQuantity} / {lot.totalQuantity}</td>
                              <td className="py-1.5 px-2.5 text-left font-bold font-numbers">{formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}</td>
                              <td className="py-1.5 px-2.5 text-left font-numbers text-emerald-700">{formatPKR(lot.summary.arhtiProfitCommission, settings.currencySymbol, settings.language)}</td>
                              <td className="py-1.5 px-2.5 text-left font-bold font-numbers text-slate-900">{formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 2: Detailed Bids & Customer Purchases */}
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq mb-2">
                      ٢. تفصیلی بولی و خریدار آڈٹ (تمام سودے)
                    </h3>
                    <div className="border border-slate-300 rounded-lg overflow-hidden">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white font-bold">
                            <th className="py-2 px-2.5">لاٹ #</th>
                            <th className="py-2 px-2.5">آمد تاریخ</th>
                            <th className="py-2 px-2.5">جنس</th>
                            <th className="py-2 px-2.5">خریدار (گاہک)</th>
                            <th className="py-2 px-2.5 text-center">تعداد</th>
                            <th className="py-2 px-2.5 text-left">ریٹ فی نگ</th>
                            <th className="py-2 px-2.5 text-left">کل رقم</th>
                            <th className="py-2 px-2.5 text-center">ادائیگی</th>
                            <th className="py-2 px-2.5">زمیندار</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {previewData.entireLots.flatMap((l) =>
                            l.sales.map((s) => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-800">#{l.lotNumber}</td>
                                <td className="py-1.5 px-2.5 font-mono text-slate-600">{l.arrivalDate}</td>
                                <td className="py-1.5 px-2.5 font-bold text-slate-900">{l.productUrdu || l.productName}</td>
                                <td className="py-1.5 px-2.5 font-bold text-slate-900 font-urdu-nastaliq">{s.buyerName}</td>
                                <td className="py-1.5 px-2.5 text-center font-numbers font-bold">{s.quantity}</td>
                                <td className="py-1.5 px-2.5 text-left font-numbers">{formatPKR(s.ratePerUnit, settings.currencySymbol, settings.language)}</td>
                                <td className="py-1.5 px-2.5 text-left font-bold font-numbers">{formatPKR(s.totalAmount, settings.currencySymbol, settings.language)}</td>
                                <td className="py-1.5 px-2.5 text-center">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    s.paymentStatus === 'cash'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {s.paymentStatus === 'cash' ? 'نقد' : 'ادھار'}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2.5 text-slate-700">{l.vendorName}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 6. SINGLE LOT DETAIL REPORT */}
              {reportType === 'single_lot' && previewData.singleLot && (
                <div className="space-y-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">زمیندار کا نام:</span>
                      <span className="font-bold text-slate-900 text-sm font-urdu-nastaliq">{previewData.singleLot.vendorName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">جنس / آئٹم:</span>
                      <span className="font-bold text-slate-900 text-sm">{previewData.singleLot.productUrdu || previewData.singleLot.productName} ({previewData.singleLot.unitType})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">آمد تاریخ و گاڑی:</span>
                      <span className="font-bold text-slate-900 font-mono">{previewData.singleLot.arrivalDate} | {previewData.singleLot.vehicleNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">کل آمد تعداد:</span>
                      <span className="font-bold text-slate-900 font-numbers">{previewData.singleLot.totalQuantity} (فروخت: {previewData.singleLot.summary.totalSoldQuantity})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">کل فروخت مالیت:</span>
                      <span className="font-bold text-slate-900 font-numbers">{formatPKR(previewData.singleLot.summary.grossSales, settings.currencySymbol, settings.language)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">صافی واجب الادا:</span>
                      <span className="font-bold text-emerald-800 font-numbers">{formatPKR(previewData.singleLot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}</span>
                    </div>
                  </div>

                  {/* Bids List */}
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq">نیلامی کے سودے (خریدار وار بولی ریکارڈ)</h4>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-emerald-900 text-white font-bold">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">وقت</th>
                          <th className="py-2 px-3">خریدار کا نام</th>
                          <th className="py-2 px-3 text-center">تعداد</th>
                          <th className="py-2 px-3 text-left">ریٹ فی نگ</th>
                          <th className="py-2 px-3 text-left">کل رقم</th>
                          <th className="py-2 px-3 text-center">ادائیگی نوعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.singleLot.sales.map((s, idx) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{s.timestamp ? s.timestamp.slice(11, 16) || s.timestamp.slice(0, 10) : '-'}</td>
                            <td className="py-2 px-3 font-bold text-slate-900 font-urdu-nastaliq">{s.buyerName}</td>
                            <td className="py-2 px-3 text-center font-numbers font-bold">{s.quantity}</td>
                            <td className="py-2 px-3 text-left font-numbers">{formatPKR(s.ratePerUnit, settings.currencySymbol, settings.language)}</td>
                            <td className="py-2 px-3 text-left font-bold font-numbers">{formatPKR(s.totalAmount, settings.currencySymbol, settings.language)}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.paymentStatus === 'cash'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {s.paymentStatus === 'cash' ? 'نقد وصولی' : 'ادھار'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 7. SINGLE CUSTOMER LEDGER STATEMENT */}
              {reportType === 'single_customer' && previewData.singleCustomer && (
                <div className="space-y-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">گاہک کا نام:</span>
                      <span className="font-bold text-slate-900 text-sm font-urdu-nastaliq">{previewData.singleCustomer.customerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">فون و دکان:</span>
                      <span className="font-bold text-slate-900">{previewData.singleCustomer.phone || '-'} {previewData.singleCustomer.shopName ? `(${previewData.singleCustomer.shopName})` : ''}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">کل خریدی تعداد:</span>
                      <span className="font-bold text-slate-900 font-numbers">{previewData.singleCustomer.totalUnitsBought} نگ</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">بقایا واجب الادا ادھار:</span>
                      <span className="font-bold text-rose-700 font-numbers text-sm">{formatPKR(previewData.singleCustomer.creditPending, settings.currencySymbol, settings.language)}</span>
                    </div>
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq">تفصیلی تاریخ وار خریداری سودے</h4>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white font-bold">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">تاریخ</th>
                          <th className="py-2 px-3">جنس / آئٹم</th>
                          <th className="py-2 px-3 text-center">تعداد</th>
                          <th className="py-2 px-3 text-left">ریٹ فی نگ</th>
                          <th className="py-2 px-3 text-left">کل رقم</th>
                          <th className="py-2 px-3 text-center">حیثیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.singleCustomer.transactions.map((tx, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{tx.date}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{tx.productUrdu}</td>
                            <td className="py-2 px-3 text-center font-numbers font-bold">{tx.quantity}</td>
                            <td className="py-2 px-3 text-left font-numbers">{formatPKR(tx.ratePerUnit, settings.currencySymbol, settings.language)}</td>
                            <td className="py-2 px-3 text-left font-bold font-numbers">{formatPKR(tx.totalAmount, settings.currencySymbol, settings.language)}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tx.paymentStatus === 'cash'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {tx.paymentStatus === 'cash' ? 'نقد ادا' : 'ادھار'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 8. SINGLE PRODUCT DETAIL */}
              {reportType === 'single_product' && previewData.singleProduct && (
                <div className="space-y-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">جنس کا نام:</span>
                      <span className="font-bold text-slate-900 text-sm">{previewData.singleProduct.emoji} {previewData.singleProduct.productUrdu}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">کل لاٹس و آمد:</span>
                      <span className="font-bold text-slate-900 font-numbers">{previewData.singleProduct.totalLots} لاٹس ({previewData.singleProduct.totalUnits} نگ)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">اوسط نرخ:</span>
                      <span className="font-bold text-slate-900 font-numbers">{formatPKR(previewData.singleProduct.avgRate, settings.currencySymbol, settings.language)} ({previewData.singleProduct.minRate}-{previewData.singleProduct.maxRate})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">کل کمیشن منافع:</span>
                      <span className="font-bold text-emerald-800 font-numbers text-sm">{formatPKR(previewData.singleProduct.commissionEarned, settings.currencySymbol, settings.language)}</span>
                    </div>
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq">اس جنس کی تمام لاٹس کا احوال</h4>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white font-bold">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">آمد تاریخ</th>
                          <th className="py-2 px-3">لاٹ نمبر</th>
                          <th className="py-2 px-3">زمیندار</th>
                          <th className="py-2 px-3 text-center">فروخت / آمد</th>
                          <th className="py-2 px-3 text-left">کل مالیت</th>
                          <th className="py-2 px-3 text-left">کمیشن</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.singleProduct.lots.map((l, idx) => (
                          <tr key={l.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{l.arrivalDate}</td>
                            <td className="py-2 px-3 font-bold font-mono text-emerald-800">#{l.lotNumber}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{l.vendorName}</td>
                            <td className="py-2 px-3 text-center font-numbers">{l.summary.totalSoldQuantity} / {l.totalQuantity}</td>
                            <td className="py-2 px-3 text-left font-bold font-numbers">{formatPKR(l.summary.grossSales, settings.currencySymbol, settings.language)}</td>
                            <td className="py-2 px-3 text-left font-bold font-numbers text-emerald-700">{formatPKR(l.summary.arhtiProfitCommission, settings.currencySymbol, settings.language)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 9. SINGLE VENDOR DETAIL */}
              {reportType === 'single_vendor' && previewData.singleVendor && (
                <div className="space-y-4 mb-6">
                  <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-amber-800 block">زمیندار کا نام:</span>
                      <span className="font-bold text-slate-950 text-sm font-urdu-nastaliq">{previewData.singleVendor.vendorName}</span>
                    </div>
                    <div>
                      <span className="text-amber-800 block">شہر و فون:</span>
                      <span className="font-bold text-slate-900">{previewData.singleVendor.vendorCity || '-'} | {previewData.singleVendor.vendorPhone || '-'}</span>
                    </div>
                    <div>
                      <span className="text-amber-800 block">کل لاٹس مالیت:</span>
                      <span className="font-bold text-slate-900 font-numbers">{formatPKR(previewData.singleVendor.grossSales, settings.currencySymbol, settings.language)}</span>
                    </div>
                    <div>
                      <span className="text-amber-800 block">صافی واجب الادا:</span>
                      <span className="font-bold text-slate-950 font-numbers text-sm">{formatPKR(previewData.singleVendor.netPayable, settings.currencySymbol, settings.language)}</span>
                    </div>
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq">زمیندار کی لائی گئی تمام لاٹس</h4>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-amber-950 text-white font-bold">
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">آمد تاریخ</th>
                          <th className="py-2 px-3">لاٹ نمبر</th>
                          <th className="py-2 px-3">جنس</th>
                          <th className="py-2 px-3 text-center">فروخت / آمد</th>
                          <th className="py-2 px-3 text-left">کل فروخت</th>
                          <th className="py-2 px-3 text-left">کمیشن</th>
                          <th className="py-2 px-3 text-left">صافی رقم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewData.singleVendor.lots.map((l, idx) => (
                          <tr key={l.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{l.arrivalDate}</td>
                            <td className="py-2 px-3 font-bold font-mono text-emerald-800">#{l.lotNumber}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{l.productUrdu || l.productName}</td>
                            <td className="py-2 px-3 text-center font-numbers">{l.summary.totalSoldQuantity} / {l.totalQuantity}</td>
                            <td className="py-2 px-3 text-left font-bold font-numbers">{formatPKR(l.summary.grossSales, settings.currencySymbol, settings.language)}</td>
                            <td className="py-2 px-3 text-left font-numbers text-emerald-700">{formatPKR(l.summary.arhtiProfitCommission, settings.currencySymbol, settings.language)}</td>
                            <td className="py-2 px-3 text-left font-bold font-numbers text-slate-900">{formatPKR(l.summary.netPayableToVendor, settings.currencySymbol, settings.language)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Document Signatures Footer (دستخط و تصدیق) */}
              <div className="mt-12 pt-6 border-t border-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs text-slate-700">
                <div className="text-center border-t border-dashed border-slate-400 pt-2">
                  <div className="font-bold text-slate-900 font-urdu-nastaliq">دستخط آڑھتی / منشی</div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">Authorised Signature</div>
                </div>

                <div className="text-center border-t border-dashed border-slate-400 pt-2">
                  <div className="font-bold text-slate-900 font-urdu-nastaliq">دستخط خریدار / زمیندار</div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">Party Verification</div>
                </div>

                <div className="hidden sm:block text-center border-t border-dashed border-slate-400 pt-2">
                  <div className="font-bold text-emerald-800 font-urdu-nastaliq">ڈیجیٹل منڈی منشی پرو</div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">Automated System Audit</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-urdu-sans flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-300">
              {isUrdu
                ? 'رپورٹ تیار ہے • صاف اور اصل اردو نستعلیق پرنٹنگ کے ساتھ'
                : 'Report preview ready • High-resolution Urdu typography'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span>{isFullscreen ? 'عام ویو' : 'فل سکرین ویو'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
            >
              {isUrdu ? 'بند کریں' : 'Close'}
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs font-urdu-sans disabled:opacity-50"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isUrdu ? 'پی ڈی ایف ڈاؤن لوڈ کریں' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
