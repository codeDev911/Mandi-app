import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import { sound } from '../utils/sound';
import { PDFPreviewData } from '../utils/pdfReportGenerator';
import { generateReportCanvas2DPages } from '../utils/reportCanvasGenerator';
import { printDetailedReportDocument } from '../utils/printHelper';
import { saveBlobFile } from '../utils/fileDownloader';
import { UniversalShareModal, UniversalShareItem } from './UniversalShareModal';
import {
  X,
  Save,
  Download,
  Printer,
  Share2,
  Loader2,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  ChevronLeft,
  ChevronRight,
  Layers,
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
  const [pageCanvases, setPageCanvases] = useState<HTMLCanvasElement[]>([]);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [isRenderingCanvas, setIsRenderingCanvas] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [shareModalItem, setShareModalItem] = useState<UniversalShareItem | null>(null);

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
      setPageCanvases([]);
      setPageImages([]);
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
        const canvases = generateReportCanvas2DPages(previewData);
        setPageCanvases(canvases);
        const images = canvases.map((c) => c.toDataURL('image/png', 0.98));
        setPageImages(images);
        setCurrentPageIndex(0);
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
  const totalPages = Math.max(1, pageCanvases.length);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // High-Resolution Multi-Page PDF Generator with HTML5 Canvas 2D Engine
  // Perfectly renders Urdu Nastaliq calligraphy without CSS parsing or row-clipping issues
  const buildReportPDF = async (): Promise<{ pdf: jsPDF; blob: Blob }> => {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // continue
      }
    }

    // Generate high-res 2D canvases for every page
    const canvases = pageCanvases.length > 0 ? pageCanvases : generateReportCanvas2DPages(previewData);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfPageWidth = 210;
    const pdfPageHeight = 297;

    canvases.forEach((canvas, idx) => {
      if (idx > 0) {
        pdf.addPage('a4', 'p');
      }
      const pageImgData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfPageWidth, pdfPageHeight, undefined, 'FAST');
    });

    const blob = pdf.output('blob');
    return { pdf, blob };
  };

  // 1. SAVE PDF (File System Access API / Universal File Saver)
  const handleSavePDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingPDF(true);

    const finalPdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    try {
      const { pdf, blob } = await buildReportPDF();
      const saveRes = await saveBlobFile(blob, finalPdfName, 'Mandi PDF Report');
      if (saveRes.success) {
        showToast(
          isUrdu
            ? `پی ڈی ایف رپورٹ محفوظ ہو گئی! (${totalPages} صفحات)`
            : `PDF report saved successfully! (${totalPages} pages)`
        );
      } else {
        try {
          pdf.save(finalPdfName);
          showToast(isUrdu ? 'پی ڈی ایف رپورٹ محفوظ ہو گئی!' : 'PDF report saved successfully!');
        } catch {
          showToast(isUrdu ? 'فائل محفوظ کرنے میں مسئلہ پیش آیا' : 'Failed to save PDF file');
        }
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showToast(isUrdu ? 'پی ڈی ایف محفوظ کرنے میں خرابی پیش آئی' : 'Failed to save PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 2. SHARE AS PDF / WHATSAPP (Universal Share Dialog)
  const handleSharePDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    setIsExportingPDF(true);

    const finalPdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    const shopTitle = isUrdu ? settings.shopNameUrdu : settings.shopNameEn;
    const messageText = `*${shopTitle}*\n📄 *${title}*\n📅 دورانیہ: ${dateFilterLabel || 'تمام ریکارڈ'}\n📑 صفحات: ${totalPages}\n\nپی ڈی ایف رپورٹ دستاویز منسلک ہے۔`;

    try {
      const { blob } = await buildReportPDF();

      setShareModalItem({
        title: title,
        subtitle: `${totalPages} صفحات • ${dateFilterLabel || 'تمام ریکارڈ'}`,
        formattedText: messageText,
        fileBlob: blob,
        fileName: finalPdfName,
        fileType: 'pdf',
        extraDetails: [
          { label: 'رپورٹ کا نام', value: title },
          { label: 'صفحات کی تعداد', value: `${totalPages}` },
        ],
      });
    } catch (err: any) {
      console.error('Share PDF error:', err);
      setShareModalItem({
        title: title,
        subtitle: `${totalPages} صفحات • ${dateFilterLabel || 'تمام ریکارڈ'}`,
        formattedText: messageText,
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 3. CLEAN DIRECT BROWSER PRINT
  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();

    const allImages = pageImages.length > 0 ? pageImages : undefined;
    printDetailedReportDocument(previewData, allImages);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Container */}
      <div className="bg-slate-900 w-full max-w-5xl h-[95vh] max-h-[920px] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-slate-700">
        
        {/* Top Header Bar: Clean Title & Action Buttons */}
        <div className="bg-slate-950 border-b border-slate-800 px-3.5 py-3 text-white flex items-center justify-between gap-2 flex-shrink-0 flex-wrap">
          
          {/* Title & Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <h3 className="font-bold text-sm sm:text-base text-white font-urdu-nastaliq truncate">
                {title}
              </h3>
              {dateFilterLabel && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold font-urdu-sans flex-shrink-0">
                  {dateFilterLabel}
                </span>
              )}
              {totalPages > 1 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-700/60 text-[10px] font-bold font-urdu-sans flex-shrink-0">
                  {isUrdu ? `${totalPages} صفحات (A4)` : `${totalPages} Pages (A4)`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {filename}
            </p>
          </div>

          {/* Action Toolbar: Multi-Page Pagination Controls + Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap">
            
            {/* Multi-Page Navigation Controls */}
            {totalPages > 1 && (
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setCurrentPageIndex((prev) => Math.max(0, prev - 1));
                    setViewMode('single');
                  }}
                  disabled={currentPageIndex === 0}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-30"
                  title="پچھلا صفحہ (Previous Page)"
                >
                  <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setViewMode((prev) => (prev === 'all' ? 'single' : 'all'));
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-urdu-sans transition flex items-center gap-1 ${
                    viewMode === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={viewMode === 'all' ? 'سنگل صفحہ دیکھیں' : 'تمام صفحات دیکھیں'}
                >
                  <Layers className="w-3 h-3" />
                  <span>
                    {viewMode === 'all'
                      ? (isUrdu ? 'سبھی صفحات' : 'All Pages')
                      : (isUrdu ? `صفحہ ${currentPageIndex + 1} از ${totalPages}` : `Page ${currentPageIndex + 1}/${totalPages}`)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setCurrentPageIndex((prev) => Math.min(totalPages - 1, prev + 1));
                    setViewMode('single');
                  }}
                  disabled={currentPageIndex >= totalPages - 1}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-30"
                  title="اگلا صفحہ (Next Page)"
                >
                  <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="hidden md:flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
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
            
            {/* 1. Save PDF Action Button */}
            <button
              type="button"
              onClick={(e) => handleSavePDF(e)}
              disabled={isExportingPDF}
              className="px-3 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center gap-1.5 transition shadow-md border border-emerald-500 disabled:opacity-50 font-urdu-sans font-bold text-xs"
              title="پی ڈی ایف فائل محفوظ کریں (Save PDF)"
              aria-label="Save PDF"
            >
              {isExportingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 stroke-[2.2]" />
              )}
              <span>{isUrdu ? 'محفوظ کریں' : 'Save PDF'}</span>
            </button>

            {/* 2. Share PDF Action Button */}
            <button
              type="button"
              onClick={(e) => handleSharePDF(e)}
              disabled={isExportingPDF}
              className="px-3 h-10 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-95 text-white flex items-center justify-center gap-1.5 transition shadow-md border border-teal-500 disabled:opacity-50 font-urdu-sans font-bold text-xs"
              title="پی ڈی ایف شیئر کریں (Share PDF)"
              aria-label="Share PDF"
            >
              <Share2 className="w-4 h-4 stroke-[2.2]" />
              <span>{isUrdu ? 'شیئر کریں' : 'Share'}</span>
            </button>

            {/* 3. Print Icon Button */}
            <button
              type="button"
              onClick={(e) => handlePrint(e)}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-90 text-slate-200 border border-slate-700 flex items-center justify-center transition shadow-sm"
              title="پی ڈی ایف پرنٹ کریں (Print PDF Report)"
              aria-label="Print PDF Report"
            >
              <Printer className="w-4 h-4 stroke-[2.2] text-amber-400" />
            </button>

            {/* 4. Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-rose-600/90 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center transition shadow-md border border-rose-500 ml-1"
              title="بند کریں (Close)"
              aria-label="Close"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
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

        {/* Document Scroll Area: Exact High-Res Paginated PDF Document Preview */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/75 flex justify-center items-start">
          {isRenderingCanvas ? (
            <div className="w-full max-w-[780px] h-[500px] bg-slate-900/60 rounded-xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-xs font-urdu-sans">{isUrdu ? 'پی ڈی ایف صفحات تیار ہو رہے ہیں...' : 'Rendering PDF pages...'}</p>
            </div>
          ) : pageImages.length > 0 ? (
            <div
              ref={documentRef}
              className="transition-all duration-200 flex flex-col items-center gap-6"
              style={{
                width: `${zoomLevel}%`,
                maxWidth: zoomLevel === 100 ? '820px' : 'none',
              }}
            >
              {viewMode === 'all' ? (
                // ALL PAGES STACKED VIEW WITH CLEAN PAGE BADGES
                pageImages.map((imgSrc, pIdx) => (
                  <div key={pIdx} className="w-full relative group">
                    <div className="absolute -top-3 right-4 bg-slate-900/90 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-urdu-sans shadow-md z-10">
                      {isUrdu ? `صفحہ ${pIdx + 1} از ${totalPages}` : `Page ${pIdx + 1} of ${totalPages}`}
                    </div>
                    <img
                      src={imgSrc}
                      alt={`${title} - Page ${pIdx + 1}`}
                      className="w-full h-auto bg-white rounded-xl shadow-2xl border border-slate-300 select-none"
                      style={{ imageRendering: 'auto' }}
                    />
                  </div>
                ))
              ) : (
                // SINGLE ACTIVE PAGE VIEW
                <div className="w-full relative">
                  <div className="absolute -top-3 right-4 bg-slate-900/90 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-urdu-sans shadow-md z-10">
                    {isUrdu ? `صفحہ ${currentPageIndex + 1} از ${totalPages}` : `Page ${currentPageIndex + 1} of ${totalPages}`}
                  </div>
                  <img
                    src={pageImages[currentPageIndex]}
                    alt={`${title} - Page ${currentPageIndex + 1}`}
                    className="w-full h-auto bg-white rounded-xl shadow-2xl border border-slate-300 select-none"
                    style={{ imageRendering: 'auto' }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-[780px] p-8 text-center text-rose-400 bg-slate-900 rounded-xl border border-slate-800 text-xs font-urdu-sans">
              پیش نظارہ لوڈ نہیں ہو سکا۔ براہ کرم محفوظ کرنے یا پرنٹ کا بٹن دبائیں۔
            </div>
          )}
        </div>

        {/* Modal Bottom Bar with Page Navigation and Status */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2 font-urdu-sans text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>
              {isUrdu
                ? `پی ڈی ایف پرنٹ پیش نظارہ • کل ${totalPages} صفحہ (A4 Standard)`
                : `PDF Print Preview • Total ${totalPages} Page(s) (A4 Standard)`}
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setCurrentPageIndex((prev) => Math.max(0, prev - 1));
                  setViewMode('single');
                }}
                disabled={currentPageIndex === 0}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold font-urdu-sans transition border border-slate-700 disabled:opacity-40"
              >
                {isUrdu ? 'پچھلا صفحہ' : 'Previous'}
              </button>
              <span className="text-[11px] font-bold font-urdu-sans text-emerald-400">
                {isUrdu ? `صفحہ ${currentPageIndex + 1} از ${totalPages}` : `${currentPageIndex + 1} / ${totalPages}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setCurrentPageIndex((prev) => Math.min(totalPages - 1, prev + 1));
                  setViewMode('single');
                }}
                disabled={currentPageIndex >= totalPages - 1}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold font-urdu-sans transition border border-slate-700 disabled:opacity-40"
              >
                {isUrdu ? 'اگلا صفحہ' : 'Next'}
              </button>
            </div>
          )}

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
