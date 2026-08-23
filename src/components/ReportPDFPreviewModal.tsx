import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import { sound } from '../utils/sound';
import { PDFPreviewData } from '../utils/pdfReportGenerator';
import { generateReportCanvas2D } from '../utils/reportCanvasGenerator';
import { printDetailedReportDocument } from '../utils/printHelper';
import { downloadBlobFile } from '../utils/fileDownloader';
import {
  X,
  Download,
  Printer,
  Share2,
  Loader2,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
} from 'lucide-react';

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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isRenderingCanvas, setIsRenderingCanvas] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const documentRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Generate high-resolution PDF canvas image preview immediately on mount / change
  useEffect(() => {
    if (!previewData) {
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
        const canvas = generateReportCanvas2D(previewData);
        const dataUrl = canvas.toDataURL('image/png', 0.98);
        setPreviewImageUrl(dataUrl);
      } catch (err) {
        console.error('Error generating report PDF preview:', err);
      } finally {
        setIsRenderingCanvas(false);
      }
    };

    const timer = setTimeout(generatePreview, 60);
    return () => clearTimeout(timer);
  }, [previewData]);

  if (!previewData) return null;

  const { settings, title, filename, dateFilterLabel } = previewData;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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

  // High-Resolution PDF Generator with HTML5 Canvas 2D Engine
  // Perfectly renders Urdu Nastaliq calligraphy without CSS parsing issues
  const buildReportPDF = async (): Promise<{ pdf: jsPDF; blob: Blob }> => {
    // Wait for document fonts if available
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // continue
      }
    }

    // Generate high-res 2D canvas with complete Urdu layout
    const canvas = generateReportCanvas2D(previewData);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfPageWidth = 210;
    const pdfPageHeight = 297;
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

    const blob = pdf.output('blob');
    return { pdf, blob };
  };

  // 1. DIRECT PDF DOWNLOAD (Icon Only Button)
  const handleDownloadPDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingPDF(true);

    const finalPdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    try {
      const { pdf, blob } = await buildReportPDF();
      
      const downloadRes = await downloadBlobFile(blob, finalPdfName);
      if (downloadRes.success) {
        showToast(isUrdu ? 'پی ڈی ایف رپورٹ کامیابی سے محفوظ ہو گئی!' : 'PDF report downloaded successfully!');
      } else {
        try {
          pdf.save(finalPdfName);
          showToast(isUrdu ? 'پی ڈی ایف رپورٹ کامیابی سے محفوظ ہو گئی!' : 'PDF report downloaded successfully!');
        } catch (saveErr) {
          triggerSafeDownload(blob, finalPdfName);
          showToast(isUrdu ? 'پی ڈی ایف رپورٹ کامیابی سے محفوظ ہو گئی!' : 'PDF report downloaded successfully!');
        }
      }
    } catch (err) {
      console.error('PDF export error:', err);
      try {
        const canvas = generateReportCanvas2D(previewData);
        canvas.toBlob(async (pngBlob) => {
          if (pngBlob) {
            await downloadBlobFile(pngBlob, `${finalPdfName.replace('.pdf', '')}.png`);
            showToast(isUrdu ? 'رپورٹ کی تصویر محفوظ کر لی گئی ہے' : 'Report image downloaded successfully');
          }
        }, 'image/png', 0.95);
      } catch {
        showToast(isUrdu ? 'پی ڈی ایف ڈاؤن لوڈ میں خرابی پیش آئی' : 'Failed to download PDF');
      }
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 2. SHARE AS PDF / WHATSAPP (Icon Only Button)
  const handleSharePDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingPDF(true);

    const finalPdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    try {
      const { blob } = await buildReportPDF();
      const pdfFile = new File([blob], finalPdfName, { type: 'application/pdf' });

      // Mobile Web Share API
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: title,
          text: `📊 ${settings.shopNameUrdu || settings.shopNameEn} - ${title}`,
        });
        showToast(isUrdu ? 'پی ڈی ایف رپورٹ شیئر کر دی گئی!' : 'PDF report shared!');
        return;
      }

      // WhatsApp Web Flow
      triggerSafeDownload(blob, finalPdfName);
      const shopTitle = isUrdu ? settings.shopNameUrdu : settings.shopNameEn;
      const text = `*${shopTitle}*\n📄 *${title}*\n📅 دورانیہ: ${dateFilterLabel || 'تمام ریکارڈ'}\nفائل: ${finalPdfName}\n\nپی ڈی ایف ڈاؤن لوڈ کر کے واٹس ایپ میں شیئر کریں۔`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      showToast(isUrdu ? 'پی ڈی ایف ڈاؤن لوڈ ہو گئی اور واٹس ایپ کھول دیا گیا ہے' : 'PDF downloaded and WhatsApp opened');
    } catch (err) {
      console.error('Share PDF error:', err);
      showToast(isUrdu ? 'شیئر کرنے میں مسئلہ پیش آیا' : 'Failed to share PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 3. CLEAN DIRECT BROWSER PRINT (Icon Only Button)
  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();

    let imgToPrint = previewImageUrl;
    if (!imgToPrint && previewData) {
      try {
        const canvas = generateReportCanvas2D(previewData);
        imgToPrint = canvas.toDataURL('image/png', 0.98);
      } catch (err) {
        console.warn('Could not generate instant canvas for print:', err);
      }
    }

    printDetailedReportDocument(previewData, imgToPrint || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Container */}
      <div className="bg-slate-900 w-full max-w-4xl h-[94vh] max-h-[880px] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-slate-700">
        
        {/* Top Header Bar: Clean Title & Action Buttons */}
        <div className="bg-slate-950 border-b border-slate-800 px-3.5 py-3 text-white flex items-center justify-between gap-2 flex-shrink-0">
          
          {/* Title & Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
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

          {/* Action Toolbar: ONLY ICON BUTTONS (No Text Labels) & High-Contrast Close Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(60, prev - 15))}
                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="زوم آؤٹ (Zoom Out)"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-400 px-1 min-w-[36px] text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(150, prev + 15))}
                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="زوم ان (Zoom In)"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title="ری سیٹ زوم (Reset Zoom)"
                aria-label="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
            
            {/* 1. Download PDF Icon Button */}
            <button
              type="button"
              onClick={(e) => handleDownloadPDF(e)}
              disabled={isExportingPDF}
              className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-90 text-white flex items-center justify-center transition shadow-md border border-emerald-500 disabled:opacity-50"
              title="ڈاؤن لوڈ پی ڈی ایف (Download PDF)"
              aria-label="Download PDF"
            >
              {isExportingPDF ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5 stroke-[2.2]" />
              )}
            </button>

            {/* 2. Share PDF Icon Button */}
            <button
              type="button"
              onClick={(e) => handleSharePDF(e)}
              disabled={isExportingPDF}
              className="w-10 h-10 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-90 text-white flex items-center justify-center transition shadow-md border border-teal-500 disabled:opacity-50"
              title="شیئر پی ڈی ایف (Share PDF)"
              aria-label="Share PDF"
            >
              <Share2 className="w-5 h-5 stroke-[2.2]" />
            </button>

            {/* 3. Print Icon Button (Directly prints the PDF report) */}
            <button
              type="button"
              onClick={(e) => handlePrint(e)}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-200 border border-slate-700 flex items-center justify-center transition shadow-sm"
              title="پی ڈی ایف پرنٹ کریں (Print PDF Report)"
              aria-label="Print PDF Report"
            >
              <Printer className="w-5 h-5 stroke-[2.2] text-amber-400" />
            </button>

            {/* 4. Highly Visible Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-rose-600/90 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center transition shadow-md border border-rose-500 ml-1"
              title="بند کریں (Close)"
              aria-label="Close"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
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

        {/* Document Scroll Area: Exact High-Res PDF Document Preview as Default */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/75 flex justify-center items-start">
          {isRenderingCanvas ? (
            <div className="w-full max-w-[780px] h-[500px] bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-xs font-urdu-sans">{isUrdu ? 'پی ڈی ایف پیش نظارہ تیار ہو رہا ہے...' : 'Rendering PDF preview...'}</p>
            </div>
          ) : previewImageUrl ? (
            <div
              ref={documentRef}
              className="transition-all duration-200 flex justify-center"
              style={{
                width: `${zoomLevel}%`,
                maxWidth: zoomLevel === 100 ? '820px' : 'none',
              }}
            >
              <img
                src={previewImageUrl}
                alt={title}
                className="w-full h-auto bg-white rounded-xl shadow-2xl border border-slate-300 select-none"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          ) : (
            <div className="w-full max-w-[780px] p-8 text-center text-rose-400 bg-slate-900 rounded-xl border border-slate-800 text-xs font-urdu-sans">
              پیش نظارہ لوڈ نہیں ہو سکا۔ براہ کرم ڈاؤن لوڈ یا پرنٹ کا بٹن دبائیں۔
            </div>
          )}
        </div>

        {/* Modal Bottom Bar with Close Option and Status */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
          <div className="flex items-center gap-2 font-urdu-sans text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>{isUrdu ? 'پی ڈی ایف معیاری پرنٹ پیش نظارہ (A4 Format)' : 'PDF Standard Print Preview (A4 Format)'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold font-urdu-sans transition border border-slate-700 ml-auto flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>{isUrdu ? 'بند کریں' : 'Close'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

