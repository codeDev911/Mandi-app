import React, { useState } from 'react';
import { AppSettings, VendorLot, CustomerBuyer, SavedVendor, ShopExpense, DrawerAdjustment } from '../types';
import { sound } from '../utils/sound';
import { downloadJSONBackup, shareJSONBackup, copyTextToClipboard } from '../utils/fileDownloader';
import { getSystemLogs } from '../utils/systemLogs';
import {
  X,
  Share2,
  Copy,
  Check,
  Save,
  MessageCircle,
  Mail,
  HardDrive,
  Database,
  FileJson,
  CheckCircle2,
} from 'lucide-react';

interface ShareBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  lots?: VendorLot[];
  customers?: CustomerBuyer[];
  vendors?: SavedVendor[];
  expenses?: ShopExpense[];
  drawerAdjustments?: DrawerAdjustment[];
}

export const ShareBackupModal: React.FC<ShareBackupModalProps> = ({
  isOpen,
  onClose,
  settings,
  lots = [],
  customers = [],
  vendors = [],
  expenses = [],
  drawerAdjustments = [],
}) => {
  const isUrdu = settings.language === 'ur';
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const systemLogs = getSystemLogs();
  const exportPayload = {
    version: '2.0.0',
    appName: 'MandiMunshiMasterSystem',
    exportedAt: new Date().toISOString(),
    stats: {
      lotsCount: lots.length,
      customersCount: customers.length,
      vendorsCount: vendors.length,
      expensesCount: expenses.length,
      drawerCount: drawerAdjustments.length,
      logsCount: systemLogs.length,
    },
    settings,
    lots,
    customers,
    vendors,
    expenses,
    drawerAdjustments,
    systemLogs,
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `sabzi-mandi-backup-${dateStr}.json`;
  const shopName = isUrdu
    ? (settings.shopNameUrdu || settings.shopNameEn || 'سبزی منڈی')
    : (settings.shopNameEn || settings.shopNameUrdu || 'Sabzi Mandi');

  const totalBids = lots.reduce((acc, l) => acc + (l.sales?.length || 0), 0);

  const summaryMessage = `📦 *بیک اپ فائل: ${shopName}*
📅 تاریخ: ${dateStr}
━━━━━━━━━━━━━━━━━
🌾 کل مال لاٹس: ${lots.length}
⚖️ کل بولیاں و سودے: ${totalBids}
👥 کل خریدار کھاتے: ${customers.length}
👨‍🌾 کل زمیندار: ${vendors.length}
💸 کل دکان اخراجات: ${expenses.length}
💵 کیش دراز انٹریز: ${drawerAdjustments.length}
━━━━━━━━━━━━━━━━━
یہ بیک اپ سبزی منڈی ایپ میں سیٹنگز سے بآسانی بحال (Restore) کیا جا سکتا ہے۔`;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 1. Native System Share Sheet
  const handleNativeShare = async () => {
    sound.playCashChime();
    const res = await shareJSONBackup(exportPayload, 'sabzi-mandi-backup');
    if (res.sharedViaNative) {
      showToast(isUrdu ? 'بیک اپ کامیابی سے شیئر ہو گیا!' : 'Backup shared successfully!');
    } else {
      showToast(isUrdu ? 'براہِ کرم نیچے دیے گئے واٹس ایپ یا کاپی بٹن کا استعمال کریں' : 'Please use WhatsApp or Copy button below');
    }
  };

  // 2. WhatsApp Share
  const handleWhatsAppShare = () => {
    sound.playCashChime();
    const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showToast(isUrdu ? 'واٹس ایپ اوپن ہو رہا ہے...' : 'Opening WhatsApp...');
  };

  // 3. Copy JSON Payload
  const handleCopyJSON = async () => {
    sound.playCashChime();
    const success = await copyTextToClipboard(jsonStr);
    if (success) {
      setCopied(true);
      showToast(isUrdu ? 'مکمل بیک اپ ڈیٹا کلپ بورڈ پر کاپی ہو گیا!' : 'Full backup JSON copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } else {
      showToast(isUrdu ? 'کاپی کرنے میں مسئلہ پیش آیا' : 'Failed to copy');
    }
  };

  // 4. Save to Device
  const handleSaveToDevice = async () => {
    sound.playCashChime();
    setIsSaving(true);
    try {
      const res = await downloadJSONBackup(exportPayload, 'sabzi-mandi-backup');
      if (res.success) {
        showToast(isUrdu ? 'بیک اپ فائل ڈیوائس پر محفوظ ہو گئی!' : 'Backup saved to device!');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Send by Email
  const handleEmailShare = () => {
    sound.playCashChime();
    const subject = encodeURIComponent(`Sabzi Mandi Backup - ${shopName} - ${dateStr}`);
    const body = encodeURIComponent(summaryMessage + '\n\n---\n\n' + jsonStr.slice(0, 3000) + '...');
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base font-urdu-sans">
                {isUrdu ? 'بیک اپ فائل شیئر کریں' : 'Share Backup File'}
              </h3>
              <p className="text-xs text-blue-100 font-urdu-sans">
                {isUrdu ? `${shopName} • کل ڈیٹا بیک اپ` : `${shopName} • Full Data Backup`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white text-xs px-4 py-2 text-center font-bold font-urdu-sans flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Data Summary Card */}
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-stone-800 font-bold text-xs font-urdu-sans">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>{isUrdu ? 'بیک اپ فائل کا خلاصہ:' : 'Backup Content Summary:'}</span>
              </div>
              <span className="text-[11px] font-mono text-stone-500 bg-stone-200/80 px-2 py-0.5 rounded-md">
                {fileName}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 font-urdu-sans block">{isUrdu ? 'کل مال لاٹس' : 'Lots'}</span>
                <span className="text-sm font-bold text-stone-800 font-mono">{lots.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 font-urdu-sans block">{isUrdu ? 'کل سودے' : 'Sales'}</span>
                <span className="text-sm font-bold text-stone-800 font-mono">{totalBids}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 font-urdu-sans block">{isUrdu ? 'گاہک کھاتے' : 'Buyers'}</span>
                <span className="text-sm font-bold text-stone-800 font-mono">{customers.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 font-urdu-sans block">{isUrdu ? 'زمیندار' : 'Vendors'}</span>
                <span className="text-sm font-bold text-stone-800 font-mono">{vendors.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 font-urdu-sans block">{isUrdu ? 'دکان اخراجات' : 'Expenses'}</span>
                <span className="text-sm font-bold text-stone-800 font-mono">{expenses.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                <span className="text-[10px] text-stone-500 font-urdu-sans block">{isUrdu ? 'کیش دراز انٹریز' : 'Drawer Records'}</span>
                <span className="text-sm font-bold text-stone-800 font-mono">{drawerAdjustments.length}</span>
              </div>
            </div>
          </div>

          {/* Share Action Buttons */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-stone-700 font-urdu-sans block">
              {isUrdu ? 'شیئر کرنے کے طریقے:' : 'Choose Share Method:'}
            </span>

            {/* 1. Native Mobile / System Share Sheet */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm font-urdu-sans flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
              >
                <Share2 className="w-4 h-4" />
                <span>{isUrdu ? 'موبائل شیئر مینو کھولیں (System Share Sheet)' : 'Open System Share Sheet'}</span>
              </button>
            )}

            {/* 2. WhatsApp Share */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm font-urdu-sans flex items-center justify-center gap-2 shadow-sm transition active:scale-98"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>{isUrdu ? 'واٹس ایپ پر شیئر کریں (WhatsApp)' : 'Share via WhatsApp'}</span>
            </button>

            {/* 3. Copy JSON Payload */}
            <button
              type="button"
              onClick={handleCopyJSON}
              className="w-full py-3 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs sm:text-sm font-urdu-sans flex items-center justify-center gap-2 border border-stone-300 transition active:scale-98"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-stone-600" />}
              <span>
                {copied
                  ? (isUrdu ? 'کاپی ہو گیا ہے!' : 'Copied!')
                  : (isUrdu ? 'بیک اپ ڈیٹا کاپی کریں (Copy JSON to Clipboard)' : 'Copy Backup Data')}
              </span>
            </button>

            {/* 4. Secondary actions (Save & Email) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveToDevice}
                disabled={isSaving}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold font-urdu-sans border border-stone-300 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-stone-600" />
                <span>{isUrdu ? 'فائل محفوظ کریں' : 'Save File'}</span>
              </button>

              <button
                type="button"
                onClick={handleEmailShare}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold font-urdu-sans border border-stone-300 flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Mail className="w-3.5 h-3.5 text-stone-600" />
                <span>{isUrdu ? 'ای میل پر بھیجیں' : 'Send by Email'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 px-5 py-3 border-t border-stone-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold font-urdu-sans transition"
          >
            {isUrdu ? 'بند کریں' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
