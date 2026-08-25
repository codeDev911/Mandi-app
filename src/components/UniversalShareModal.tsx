import React, { useState } from 'react';
import { AppSettings } from '../types';
import { sound } from '../utils/sound';
import { copyTextToClipboard } from '../utils/fileDownloader';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export interface UniversalShareItem {
  title: string;
  subtitle?: string;
  formattedText: string;
  recipientName?: string;
  recipientPhone?: string;
  fileBlob?: Blob;
  fileName?: string;
  fileType?: 'image' | 'pdf' | 'json';
  previewImageUrl?: string;
  extraDetails?: { label: string; value: string }[];
}

interface UniversalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareItem: UniversalShareItem | null;
  settings: AppSettings;
}

export const UniversalShareModal: React.FC<UniversalShareModalProps> = ({
  isOpen,
  onClose,
  shareItem,
  settings,
}) => {
  const isUrdu = settings.language === 'ur';

  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [customPhone, setCustomPhone] = useState(shareItem?.recipientPhone || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Sync phone when shareItem changes
  React.useEffect(() => {
    if (shareItem?.recipientPhone) {
      setCustomPhone(shareItem.recipientPhone);
    } else {
      setCustomPhone('');
    }
  }, [shareItem]);

  if (!isOpen || !shareItem) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const getCleanPhone = (phoneStr: string) => {
    const raw = phoneStr.replace(/[^0-9]/g, '');
    if (!raw) return '';
    if (raw.startsWith('0')) return '92' + raw.slice(1);
    return raw;
  };

  // 1. Direct WhatsApp to Contact
  const handleOpenWhatsApp = () => {
    sound.playCashChime();
    const phoneToUse = customPhone.trim() || shareItem.recipientPhone || '';
    const cleanPhone = getCleanPhone(phoneToUse);

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareItem.formattedText)}`
      : `https://wa.me/?text=${encodeURIComponent(shareItem.formattedText)}`;

    // Try opening
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showToast(isUrdu ? 'واٹس ایپ کھول دیا گیا ہے!' : 'WhatsApp opened!');
  };

  // 2. Native System Share Sheet (if supported)
  const handleNativeShare = async () => {
    sound.playCashChime();
    setIsProcessing(true);

    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        const shareData: ShareData = {
          title: shareItem.title,
          text: shareItem.formattedText,
        };

        if (shareItem.fileBlob && shareItem.fileName && navigator.canShare) {
          const file = new File([shareItem.fileBlob], shareItem.fileName, {
            type: shareItem.fileBlob.type || 'image/png',
          });
          if (navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }
        }

        await navigator.share(shareData);
        showToast(isUrdu ? 'کامیابی سے شیئر کر دیا گیا!' : 'Shared successfully!');
        return;
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Native share error, falling back to WhatsApp:', err);
      }
    } finally {
      setIsProcessing(false);
    }

    // If native share not supported
    handleOpenWhatsApp();
  };

  // 3. Copy Text Summary to Clipboard
  const handleCopyText = async () => {
    sound.playTick();
    const ok = await copyTextToClipboard(shareItem.formattedText);
    if (ok) {
      setCopiedText(true);
      showToast(isUrdu ? 'تحریر کلپ بورڈ پر کاپی ہو گئی!' : 'Text copied to clipboard!');
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  // 4. Copy Image to Clipboard (for pasting directly in WhatsApp Web)
  const handleCopyImage = async () => {
    if (!shareItem.fileBlob) return;
    sound.playTick();
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ [shareItem.fileBlob.type || 'image/png']: shareItem.fileBlob });
        await navigator.clipboard.write([item]);
        setCopiedImage(true);
        showToast(isUrdu ? 'تصویر کاپی ہو گئی! واٹس ایپ چیٹ میں پیسٹ (Ctrl+V) کریں' : 'Image copied! Paste (Ctrl+V) in WhatsApp.');
        setTimeout(() => setCopiedImage(false), 3500);
      } else {
        showToast(isUrdu ? 'براہِ کرم ڈیوائس پر ڈاؤن لوڈ کریں' : 'Please download file to device.');
      }
    } catch (err) {
      console.warn('Clipboard image copy not supported:', err);
      showToast(isUrdu ? 'فائل محفوظ کر کے واٹس ایپ میں بھیجیں' : 'Download file and send on WhatsApp.');
    }
  };

  // 5. Download Attached File
  const handleDownloadFile = () => {
    if (!shareItem.fileBlob || !shareItem.fileName) return;
    sound.playCashChime();
    const url = URL.createObjectURL(shareItem.fileBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = shareItem.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(isUrdu ? 'فائل ڈیوائس پر ڈاؤن لوڈ ہو گئی!' : 'File downloaded to device!');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white font-urdu-nastaliq flex items-center gap-2">
                <span>{isUrdu ? 'واٹس ایپ و سوشل شیئرنگ' : 'Share on WhatsApp & Socials'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-sans border border-teal-500/30">
                  WhatsApp
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-urdu-sans">
                {shareItem.title} {shareItem.subtitle ? `• ${shareItem.subtitle}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 font-urdu-sans text-sm">
          
          {/* Toast Notification */}
          {toastMsg && (
            <div className="p-2.5 rounded-xl bg-teal-950/80 border border-teal-500/50 text-teal-200 text-xs flex items-center gap-2 animate-in slide-in-from-top duration-200">
              <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Quick Recipient Phone Input */}
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-400" />
                <span>{isUrdu ? 'واٹس ایپ نمبر (اختیاری):' : 'WhatsApp Number (Optional):'}</span>
              </label>
              {shareItem.recipientName && (
                <span className="text-[11px] text-teal-400 font-bold">
                  {shareItem.recipientName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="tel"
                dir="ltr"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="03001234567 یا 923001234567"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-numbers font-bold"
              />
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-md flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isUrdu ? 'بھیجیں' : 'Send'}</span>
              </button>
            </div>
          </div>

          {/* Extra Details / Summary Pills if provided */}
          {shareItem.extraDetails && shareItem.extraDetails.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {shareItem.extraDetails.map((det, idx) => (
                <div key={idx} className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 block">{det.label}</span>
                  <span className="text-xs font-bold text-white font-numbers">{det.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Formatted Message Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-teal-400" />
                <span>{isUrdu ? 'واٹس ایپ میسج کا متن:' : 'WhatsApp Message Preview:'}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 text-[11px] transition"
              >
                {copiedText ? <Check className="w-3 h-3 text-teal-300" /> : <Copy className="w-3 h-3" />}
                <span>{copiedText ? (isUrdu ? 'کاپی ہو گیا!' : 'Copied!') : (isUrdu ? 'متن کاپی کریں' : 'Copy Text')}</span>
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed selection:bg-teal-500 selection:text-slate-950">
              {shareItem.formattedText}
            </div>
          </div>

          {/* File Attachment Details & Quick Actions */}
          {shareItem.fileBlob && (
            <div className="p-3 rounded-2xl bg-teal-950/40 border border-teal-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center flex-shrink-0">
                  {shareItem.fileType === 'pdf' ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">
                    {shareItem.fileName || 'Mandi_Receipt.png'}
                  </span>
                  <span className="text-[10px] text-teal-300">
                    {shareItem.fileType === 'pdf' ? 'PDF Document' : 'HD Slip Image'} ({(shareItem.fileBlob.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-slate-700"
                  title="تصویر کلپ بورڈ پر کاپی کریں"
                >
                  {copiedImage ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedImage ? (isUrdu ? 'کاپی ہو گئی' : 'Copied') : (isUrdu ? 'تصویر کاپی' : 'Copy Image')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
                  title="ڈیوائس پر فائل محفوظ کریں"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isUrdu ? 'محفوظ کریں' : 'Save File'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full sm:flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm font-urdu-sans flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950 stroke-[2.5]" />
            <span>{isUrdu ? 'واٹس ایپ پر شیئر کریں (WhatsApp Chat)' : 'Open WhatsApp Chat'}</span>
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            disabled={isProcessing}
            className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs font-urdu-sans flex items-center justify-center gap-1.5 transition active:scale-95 border border-slate-700"
          >
            <Share2 className="w-4 h-4 text-teal-400" />
            <span>{isUrdu ? 'دیگر ایپس (More Apps)' : 'More Apps'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
