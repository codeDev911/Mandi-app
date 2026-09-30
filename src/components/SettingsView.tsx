import React, { useState, useEffect } from 'react';
import { AppSettings, VendorLot, CustomerBuyer, SavedVendor, UnitType, MazdooriRateItem } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { getStoredCloudConfig } from '../utils/cloudSyncEngine';
import { DEFAULT_UNIT_MAZDOORI_RATES, getMazdooriItems, DEFAULT_MAZDOORI_ITEMS } from '../utils/calculations';
import { downloadJSONBackup, shareJSONBackup } from '../utils/fileDownloader';
import { ShareBackupModal } from './ShareBackupModal';
import { ManageMazdooriModal } from './ManageMazdooriModal';
import { PinPromptModal } from './PinPromptModal';
import { SystemLogsModal } from './SystemLogsModal';
import { seedInitialLogsIfEmpty, addSystemLog } from '../utils/systemLogs';
import {
  Settings,
  Store,
  Percent,
  DollarSign,
  Volume2,
  RotateCcw,
  Check,
  Phone,
  MapPin,
  User,
  ShieldAlert,
  ShieldCheck,
  Cloud,
  CloudUpload,
  HardDrive,
  Download,
  Upload,
  PackageCheck,
  Calculator,
  Save,
  Lock,
  KeyRound,
  Share2,
  Plus,
  Trash2,
  Edit2,
  Tag,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  lots?: VendorLot[];
  customers?: CustomerBuyer[];
  vendors?: SavedVendor[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetData: () => void;
  onOpenCloudSync?: () => void;
  onRestoreBackup?: (backupData: {
    settings?: AppSettings;
    lots?: VendorLot[];
    customers?: CustomerBuyer[];
    vendors?: SavedVendor[];
  }) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  lots = [],
  customers = [],
  vendors = [],
  onUpdateSettings,
  onResetData,
  onOpenCloudSync,
  onRestoreBackup,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isManageMazdooriOpen, setIsManageMazdooriOpen] = useState(false);
  const [newQuickTitle, setNewQuickTitle] = useState('');
  const [newQuickRate, setNewQuickRate] = useState<number>(25);
  const [editingMazdooriId, setEditingMazdooriId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingRate, setEditingRate] = useState<number>(25);
  const [showPin, setShowPin] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSuccess, setPinChangeSuccess] = useState<string | null>(null);
  const [isPinModalOpenForLogs, setIsPinModalOpenForLogs] = useState(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const cloudConfig = getStoredCloudConfig();

  useEffect(() => {
    seedInitialLogsIfEmpty(lots);
  }, [lots]);

  const totalBidsCount = lots.reduce((acc, l) => acc + l.sales.length, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playCashChime();
    onUpdateSettings(form);
    addSystemLog({
      title: 'ST',
      status: 'updated',
      description: `سسٹم و دکان کی ترتیبات محفوظ کی گئیں: ${form.shopNameUrdu || form.shopNameEn || 'کمیشن شاپ'}`,
      descriptionEn: `Settings updated: ${form.shopNameEn || form.shopNameUrdu}`,
      meta: { shopName: form.shopNameUrdu || form.shopNameEn },
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportJSON = async () => {
    sound.playCashChime();
    const exportPayload = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      lots,
      customers,
      vendors,
    };
    const res = await downloadJSONBackup(exportPayload, 'sabzi-mandi-backup');
    if (res.success) {
      alert(isUrdu ? 'بیک اپ فائل کامیابی سے ڈیوائس پر محفوظ ہو گئی ہے!' : 'Backup file saved to device successfully!');
    }
  };

  const handleShareJSON = () => {
    sound.playCashChime();
    setIsShareModalOpen(true);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && (Array.isArray(parsed.lots) || parsed.settings || Array.isArray(parsed.customers))) {
          const lotsCount = Array.isArray(parsed.lots) ? parsed.lots.length : 0;
          const custCount = Array.isArray(parsed.customers) ? parsed.customers.length : 0;
          if (
            confirm(
              isUrdu
                ? `کیا آپ یہ بیک اپ بحال کرنا چاہتے ہیں؟ (${lotsCount} لاٹس، ${custCount} خریدار)`
                : `Restore backup with ${lotsCount} lots and ${custCount} buyers?`
            )
          ) {
            sound.playCashChime();
            onRestoreBackup?.({
              settings: parsed.settings || settings,
              lots: Array.isArray(parsed.lots) ? parsed.lots : [],
              customers: Array.isArray(parsed.customers) ? parsed.customers : [],
              vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
            });
            alert(isUrdu ? 'بیک اپ کامیابی سے بحال ہو گیا ہے!' : 'Backup successfully restored!');
          }
        } else {
          alert(isUrdu ? 'غلط بیک اپ فائل فارمیٹ' : 'Invalid backup file format');
        }
      } catch (err) {
        alert(isUrdu ? 'فائل پڑھنے میں غلطی' : 'Error reading backup file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16 sm:pb-6">
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-900 font-urdu-nastaliq">{t.settingsTitle}</h2>
            <p className="text-xs text-stone-500 font-urdu-sans">
              {isUrdu ? 'دکان کی تفصیلات اور ڈیفالٹ کمیشن ریٹس' : 'Shop profile & default commission rates'}
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold font-urdu-sans flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            <span>{isUrdu ? 'سیٹنگز محفوظ ہو گئیں!' : 'Settings saved!'}</span>
          </span>
        )}
      </div>

      {/* Cloud Database & Multi-Device Sync Banner */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base font-urdu-nastaliq text-white">
                  {isUrdu ? 'پوسٹگریس کیول (PostgreSQL) کلاؤڈ ڈیٹا بیس سنک' : 'PostgreSQL Cloud Database Sync'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                  {cloudConfig.shopCloudId}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-urdu-sans mt-0.5">
                {isUrdu
                  ? 'موبائل، ٹیبلٹ اور لیپ ٹاپ پر دکان کا تمام ریکارڈ PostgreSQL کلاؤڈ سے ہم آہنگ رکھیں۔'
                  : 'Sync offline data to PostgreSQL database and access seamlessly on mobile & laptop.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playPop();
              onOpenCloudSync?.();
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xs active:scale-95 font-urdu-sans whitespace-nowrap cursor-pointer"
          >
            <Cloud className="w-4 h-4" />
            <span>{isUrdu ? 'کلاؤڈ سنک کھولیں' : 'Open Cloud Sync'}</span>
          </button>
        </div>

        {/* Real Timestamps for Upload & Download */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
          <div className="bg-slate-950/70 px-3 py-2 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-urdu-sans block">
              {isUrdu ? 'آخری اپ لوڈ کا وقت (Last Uploaded):' : 'Last Uploaded:'}
            </span>
            <span className="font-bold text-emerald-400 font-numbers">
              {cloudConfig.lastUploadedAt ? new Date(cloudConfig.lastUploadedAt).toLocaleString(isUrdu ? 'ur-PK' : 'en-PK') : (isUrdu ? 'ابھی تک نہیں ہوا (Never)' : 'Never')}
            </span>
          </div>

          <div className="bg-slate-950/70 px-3 py-2 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-urdu-sans block">
              {isUrdu ? 'آخری ڈاؤن لوڈ کا وقت (Last Downloaded):' : 'Last Downloaded:'}
            </span>
            <span className="font-bold text-blue-400 font-numbers">
              {cloudConfig.lastDownloadedAt ? new Date(cloudConfig.lastDownloadedAt).toLocaleString(isUrdu ? 'ur-PK' : 'en-PK') : (isUrdu ? 'ابھی تک نہیں ہوا (Never)' : 'Never')}
            </span>
          </div>
        </div>

        {/* PostgreSQL Database URL from Form Input */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-300 font-urdu-sans flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isUrdu ? 'PostgreSQL ڈیٹا بیس کنکشن URL (براہ راست ان پٹ):' : 'PostgreSQL Database URL (Direct Input):'}</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Form Input</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              dir="ltr"
              value={cloudConfig.postgresUrl || ''}
              placeholder="postgresql://user:password@host:5432/mandidb?sslmode=require"
              onChange={(e) => {
                const updated = { ...cloudConfig, postgresUrl: e.target.value };
                try {
                  localStorage.setItem('mandi_postgres_sync_config_v3', JSON.stringify(updated));
                } catch {
                  // ignore
                }
              }}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-emerald-300 placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => {
                sound.playPop();
                onOpenCloudSync?.();
              }}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-urdu-sans rounded-xl transition active:scale-95 whitespace-nowrap"
            >
              {isUrdu ? 'ٹیسٹ و سنک' : 'Test & Sync'}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-urdu-sans">
            {isUrdu
              ? 'ڈیٹا بیس URL براہ راست اس ان پٹ سے پڑھا جاتا ہے (کوئی .env پر انحصار نہیں)'
              : 'Database URL is read directly from this input (no .env dependency required)'}
          </p>
        </div>

        {/* Offline High-Speed Storage Engine Info */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-urdu-sans">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isUrdu ? 'آف لائن ہائی اسپیڈ ڈیٹا بیس (IndexedDB)' : 'High-Speed Local Storage'}</span>
          </span>
          <span className="font-numbers text-slate-300">
            {lots.length} {isUrdu ? 'لاٹس' : 'lots'} • {totalBidsCount} {isUrdu ? 'بولیاں' : 'bids'} • {customers.length} {isUrdu ? 'گاہک' : 'buyers'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shop Info Section */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <h3 className="font-bold text-xs sm:text-sm text-emerald-900 font-urdu-sans flex items-center gap-2 border-b border-stone-100 pb-2">
            <Store className="w-4 h-4" />
            <span>{t.shopInfo} (دکان کا پروفائل)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                دکان کا نام (اردو)
              </label>
              <input
                type="text"
                value={form.shopNameUrdu}
                onChange={(e) => setForm({ ...form, shopNameUrdu: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-urdu-nastaliq"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                Shop Name (English)
              </label>
              <input
                type="text"
                value={form.shopNameEn}
                onChange={(e) => setForm({ ...form, shopNameEn: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm font-urdu-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                آڑھتی / مالک کا نام (اردو)
              </label>
              <input
                type="text"
                value={form.arhtiNameUrdu}
                onChange={(e) => setForm({ ...form, arhtiNameUrdu: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-urdu-nastaliq"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                تار کا پتہ (اختیاری)
              </label>
              <input
                type="text"
                value={form.tarKaPataUrdu || ''}
                onChange={(e) => setForm({ ...form, tarKaPataUrdu: e.target.value })}
                placeholder="مثال: حاجی ولی جان"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-urdu-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                رابطہ فون نمبر 1 (WhatsApp)
              </label>
              <input
                type="text"
                value={form.shopPhone}
                onChange={(e) => setForm({ ...form, shopPhone: e.target.value })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-numbers"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                اضافی فون نمبر 2 (اختیاری)
              </label>
              <input
                type="text"
                value={form.shopPhone2 || ''}
                onChange={(e) => setForm({ ...form, shopPhone2: e.target.value })}
                placeholder="مثال: 0301-8322877"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-numbers"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
              منڈی کا پتہ / لوکیشن (اردو)
            </label>
            <input
              type="text"
              value={form.shopAddressUrdu}
              onChange={(e) => setForm({ ...form, shopAddressUrdu: e.target.value })}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-urdu-sans"
            />
          </div>
        </div>

        {/* Commission & General Defaults */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <h3 className="font-bold text-xs sm:text-sm text-emerald-900 font-urdu-sans flex items-center gap-2 border-b border-stone-100 pb-2">
            <Percent className="w-4 h-4" />
            <span>{t.commissionSettings} (ڈیفالٹ کمیشن و فیسیں)</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] text-stone-600 mb-1 font-urdu-sans">
                {t.defaultCommission}
              </label>
              <input
                type="number"
                step="0.5"
                value={form.defaultCommissionPercent}
                onChange={(e) => setForm({ ...form, defaultCommissionPercent: parseNumber(e.target.value) })}
                className="w-full px-2 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-numbers text-center font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] text-stone-600 mb-1 font-urdu-sans">
                {t.defaultMunshiana}
              </label>
              <input
                type="number"
                value={form.defaultMunshiana}
                onChange={(e) => setForm({ ...form, defaultMunshiana: parseNumber(e.target.value) })}
                className="w-full px-2 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-numbers text-center font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] text-stone-600 mb-1 font-urdu-sans">
                {t.defaultMarketFee}
              </label>
              <input
                type="number"
                value={form.defaultMarketFeePerUnit}
                onChange={(e) => setForm({ ...form, defaultMarketFeePerUnit: parseNumber(e.target.value) })}
                className="w-full px-2 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-numbers text-center font-bold"
              />
            </div>
          </div>
        </div>

        {/* Unit-Wise Mazdoori Labor Rates (پیکنگ وار مزدوری ریٹس و عنوانات) */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2">
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-emerald-900 font-urdu-sans flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <span>پیکنگ وار فی یونٹ مزدوری / اترائی کے ریٹس (Mazdoori per Unit Items & Rates)</span>
              </h3>
              <p className="text-[11px] text-stone-500 font-urdu-sans mt-0.5">
                {isUrdu
                  ? 'یہاں آپ مزدوری کے عنوان اور ریٹ شامل، تبدیل یا حذف کر سکتے ہیں۔ نئی لاٹ کے اندراج پر یہ ریٹس خودکار ظاہر ہوں گے۔'
                  : 'Add, edit, or remove labor titles & rates. These will automatically appear in the new lot entry modal.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setIsManageMazdooriOpen(true);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-urdu-sans flex items-center gap-1.5 transition active:scale-95 shadow-xs whitespace-nowrap self-start sm:self-auto"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'مکمل انتظام و نئی اقسام (+)' : 'Manage All Rates (+)'}</span>
            </button>
          </div>

          {/* Quick Add Mazdoori Item Form */}
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-2">
            <span className="text-xs font-bold text-emerald-950 font-urdu-sans flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isUrdu ? 'نیا مزدوری عنوان و ریٹ فوری شامل کریں:' : 'Quick Add New Labor Title & Rate:'}</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  value={newQuickTitle}
                  onChange={(e) => setNewQuickTitle(e.target.value)}
                  placeholder={isUrdu ? 'عنوان (مثلاً: بڑی بوری یا ٹرالی اترائی)' : 'Title (e.g. Large Bori)'}
                  className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-urdu-sans font-bold"
                />
              </div>
              <div className="sm:col-span-3">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-500 font-numbers">₨</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={newQuickRate}
                    onChange={(e) => setNewQuickRate(parseNumber(e.target.value))}
                    placeholder="25"
                    className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-numbers font-bold text-center text-emerald-950"
                  />
                </div>
              </div>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!newQuickTitle.trim()) {
                      alert(isUrdu ? 'براہ کرم مزدوری کا عنوان درج کریں' : 'Please enter title');
                      return;
                    }
                    sound.playCashChime();
                    const currentItems = getMazdooriItems(form);
                    const newItem: MazdooriRateItem = {
                      id: `mzd-${Date.now()}`,
                      title: newQuickTitle.trim(),
                      rate: newQuickRate > 0 ? newQuickRate : 25,
                    };
                    const updated = [...currentItems, newItem];
                    const updatedForm = { ...form, mazdooriItems: updated };
                    setForm(updatedForm);
                    onUpdateSettings(updatedForm);
                    setNewQuickTitle('');
                    setNewQuickRate(25);
                  }}
                  className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold font-urdu-sans text-xs flex items-center justify-center gap-1 transition shadow-2xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isUrdu ? 'شامل کریں' : 'Add'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* List of Configured Mazdoori Items */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-stone-600 font-urdu-sans font-bold px-1">
              <span>{isUrdu ? 'موجودہ فعال مزدوری ریٹس:' : 'Configured Labor Rates:'}</span>
              <span className="text-[11px] text-stone-400 font-numbers">
                ({getMazdooriItems(form).length} {isUrdu ? 'اقسام' : 'items'})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {getMazdooriItems(form).map((item, idx) => {
                const isEditing = editingMazdooriId === item.id;

                if (isEditing) {
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 bg-amber-50/90 rounded-xl border border-amber-300 transition flex flex-col gap-2 shadow-xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          placeholder="عنوان"
                          className="flex-1 px-2 py-1 bg-white border border-amber-400 rounded-lg text-xs font-bold font-urdu-sans"
                        />
                        <div className="flex items-center gap-0.5">
                          <span className="text-[11px] text-slate-500 font-numbers font-bold">₨</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={editingRate}
                            onChange={(e) => setEditingRate(parseNumber(e.target.value))}
                            className="w-16 px-1.5 py-1 bg-white border border-amber-400 rounded-lg text-xs font-numbers text-center font-bold"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!editingTitle.trim()) return;
                            sound.playPop();
                            const currentItems = getMazdooriItems(form);
                            const updated = currentItems.map((it) =>
                              it.id === item.id
                                ? { ...it, title: editingTitle.trim(), rate: editingRate > 0 ? editingRate : it.rate }
                                : it
                            );
                            const newUnitRates: any = { ...form.unitMazdooriRates };
                            if (item.unitType) newUnitRates[item.unitType] = editingRate;
                            const updatedForm = {
                              ...form,
                              mazdooriItems: updated,
                              unitMazdooriRates: newUnitRates,
                            };
                            setForm(updatedForm);
                            onUpdateSettings(updatedForm);
                            setEditingMazdooriId(null);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-urdu-sans flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isUrdu ? 'محفوظ' : 'Save'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMazdooriId(null)}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold font-urdu-sans"
                        >
                          {isUrdu ? 'منسوخ' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className="p-2.5 bg-stone-50 hover:bg-emerald-50/40 rounded-xl border border-stone-200 hover:border-emerald-200 transition flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-stone-900 font-urdu-sans truncate">
                        {item.title}
                      </div>
                      {item.unitType && (
                        <span className="text-[10px] text-stone-400 font-urdu-sans">
                          (پیکنگ: {unitLabels[item.unitType]?.[settings.language] || item.unitType})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[11px] text-slate-500 font-numbers font-bold">₨</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={item.rate}
                          onChange={(e) => {
                            const val = parseNumber(e.target.value);
                            const currentItems = getMazdooriItems(form);
                            const updated = currentItems.map((it) =>
                              it.id === item.id ? { ...it, rate: val } : it
                            );
                            const newUnitRates: any = { ...form.unitMazdooriRates };
                            if (item.unitType) newUnitRates[item.unitType] = val;
                            const updatedForm = {
                              ...form,
                              mazdooriItems: updated,
                              unitMazdooriRates: newUnitRates,
                            };
                            setForm(updatedForm);
                            onUpdateSettings(updatedForm);
                          }}
                          className="w-14 px-1 py-1 bg-white border border-stone-300 rounded-lg text-xs font-numbers text-center font-bold text-emerald-950 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playTick();
                          setEditingMazdooriId(item.id);
                          setEditingTitle(item.title);
                          setEditingRate(item.rate);
                        }}
                        className="p-1 rounded-md text-stone-400 hover:text-blue-700 hover:bg-blue-50 transition"
                        title={isUrdu ? 'عنوان و ریٹ تبدیل کریں' : 'Edit title & rate'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sound.playTrash();
                          const currentItems = getMazdooriItems(form);
                          const updated = currentItems.filter((it) => it.id !== item.id);
                          const updatedForm = { ...form, mazdooriItems: updated };
                          setForm(updatedForm);
                          onUpdateSettings(updatedForm);
                        }}
                        className="p-1 rounded-md text-stone-400 hover:text-rose-700 hover:bg-rose-50 transition"
                        title={isUrdu ? 'حذف کریں' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Example calculation callout */}
          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs font-urdu-sans text-amber-950 flex items-start gap-2">
            <Calculator className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                {isUrdu ? 'خودکار فارمولا مثال:' : 'Auto Calculation Example:'}
              </span>
              <p className="text-[11px] text-amber-900 mt-0.5">
                {isUrdu
                  ? 'جب آپ نئی لاٹ میں تعداد (مثلاً 50 بوری) اور مزدوری ریٹ (₨30) درج کریں گے تو کل کٹوتی خودکار 50 × ₨30 = ₨1,500 لاٹ پر لگ جائے گی۔'
                  : 'Entering quantity (e.g. 50 bori) and labor rate (Rs.30) automatically applies 50 × Rs.30 = Rs.1,500 total labor.'}
              </p>
            </div>
          </div>
        </div>

        {/* Currency & Audio Preferences */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                {t.currencySymbol}
              </label>
              <div className="flex gap-2">
                {(['₨', 'Rs.', 'روپے'] as const).map((sym) => (
                  <button
                    type="button"
                    key={sym}
                    onClick={() => setForm({ ...form, currencySymbol: sym })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                      form.currencySymbol === sym
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-stone-50 border-stone-300 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                {t.soundEffects}
              </label>
              <button
                type="button"
                onClick={() => setForm({ ...form, soundEnabled: !form.soundEnabled })}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition ${
                  form.soundEnabled
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-stone-50 text-stone-500 border-stone-300'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>{form.soundEnabled ? (isUrdu ? 'آواز آن ہے' : 'Sound ON') : (isUrdu ? 'آواز بند ہے' : 'Sound OFF')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Change Security PIN Code (3 Inputs: Old PIN, New PIN, Confirm PIN) */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <h3 className="font-bold text-xs sm:text-sm text-stone-900 font-urdu-sans flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600" />
              <span>{isUrdu ? 'حفاظتی پن کوڈ تبدیل کریں (Change Security PIN)' : 'Change Security PIN'}</span>
            </h3>
            <span className="text-[11px] font-urdu-sans font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
              {form.securityPin ? (isUrdu ? 'حفاظتی پن: فعال' : 'PIN: Active') : (isUrdu ? 'ڈیفالٹ پن: 1234' : 'Default: 1234')}
            </span>
          </div>

          <p className="text-xs text-stone-500 font-urdu-sans leading-relaxed">
            {isUrdu
              ? 'کسی بھی ریکارڈ (بولی، لاٹ، گاہک، نقد ادائیگی یا زمیندار ادائیگی) کو حذف کرنے کے لیے یہ پن کوڈ مطلوب ہوتا ہے۔ پن کوڈ تبدیل کرنے کے لیے پرانا پن، نیا پن اور تصدیق درج کریں۔'
              : 'This PIN code is required when deleting records (bids, lots, customer payments, or vendor payments). Enter old PIN, new PIN, and confirm new PIN to update.'}
          </p>

          {/* Feedback Alerts */}
          {pinChangeError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 font-urdu-sans flex items-center gap-1.5 animate-in fade-in">
              <span>⚠️</span>
              <span>{pinChangeError}</span>
            </div>
          )}

          {pinChangeSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 font-urdu-sans flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{pinChangeSuccess}</span>
            </div>
          )}

          {/* 3 Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* 1. Old PIN */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-stone-400" />
                  <span>{isUrdu ? '1. پرانا پن کوڈ:' : '1. Old PIN:'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowOldPin(!showOldPin)}
                  className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 font-urdu-sans"
                >
                  {showOldPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showOldPin ? (isUrdu ? 'چھپائیں' : 'Hide') : (isUrdu ? 'دیکھیں' : 'Show')}</span>
                </button>
              </label>
              <input
                type={showOldPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                value={oldPin}
                onChange={(e) => {
                  setOldPin(e.target.value.trim());
                  setPinChangeError(null);
                }}
                placeholder={isUrdu ? 'پرانا پن (ڈیفالٹ: 1234)' : 'Old PIN (Default: 1234)'}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-numbers tracking-widest font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* 2. New PIN */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>{isUrdu ? '2. نیا پن کوڈ:' : '2. New PIN:'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 font-urdu-sans"
                >
                  {showNewPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showNewPin ? (isUrdu ? 'چھپائیں' : 'Hide') : (isUrdu ? 'دیکھیں' : 'Show')}</span>
                </button>
              </label>
              <input
                type={showNewPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                value={newPin}
                onChange={(e) => {
                  setNewPin(e.target.value.trim());
                  setPinChangeError(null);
                }}
                placeholder={isUrdu ? 'نیا 4 ہندسوں کا پن' : 'New 4-digit PIN'}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-numbers tracking-widest font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* 3. Confirm New PIN */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{isUrdu ? '3. نئے پن کی تصدیق:' : '3. Confirm PIN:'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowConfirmPin(!showConfirmPin)}
                  className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 font-urdu-sans"
                >
                  {showConfirmPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showConfirmPin ? (isUrdu ? 'چھپائیں' : 'Hide') : (isUrdu ? 'دیکھیں' : 'Show')}</span>
                </button>
              </label>
              <input
                type={showConfirmPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={8}
                value={confirmPin}
                onChange={(e) => {
                  setConfirmPin(e.target.value.trim());
                  setPinChangeError(null);
                }}
                placeholder={isUrdu ? 'دوبارہ نیا پن درج کریں' : 'Re-enter new PIN'}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-sm font-numbers tracking-widest font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Action Row for PIN Change */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-stone-100">
            <span className="text-[11px] text-stone-400 font-urdu-sans">
              {isUrdu ? 'ڈیفالٹ پن کوڈ "1234" ہے' : 'Default initial PIN is "1234"'}
            </span>
            <button
              type="button"
              onClick={() => {
                setPinChangeError(null);
                setPinChangeSuccess(null);
                const currentPin = (form.securityPin || '1234').trim();

                if (!oldPin) {
                  sound.playWarning();
                  setPinChangeError(isUrdu ? 'براہ کرم پرانا پن کوڈ درج کریں!' : 'Please enter old PIN!');
                  return;
                }

                if (oldPin.trim() !== currentPin) {
                  sound.playWarning();
                  setPinChangeError(isUrdu ? 'پرانا پن کوڈ درست نہیں ہے! دوبارہ کوشش کریں۔' : 'Old PIN is incorrect! Please try again.');
                  return;
                }

                if (!newPin.trim() || newPin.trim().length < 4) {
                  sound.playWarning();
                  setPinChangeError(isUrdu ? 'نیا پن کوڈ کم از کم 4 ہندسوں پر مشتمل ہونا چاہیے۔' : 'New PIN must be at least 4 digits.');
                  return;
                }

                if (newPin.trim() !== confirmPin.trim()) {
                  sound.playWarning();
                  setPinChangeError(isUrdu ? 'نیا پن کوڈ اور تصدیقی پن کوڈ ایک دوسرے سے مماثل نہیں ہیں!' : 'New PIN and Confirm PIN do not match!');
                  return;
                }

                const updatedPin = newPin.trim();
                const updatedForm = { ...form, securityPin: updatedPin };
                setForm(updatedForm);
                onUpdateSettings(updatedForm);
                sound.playCashChime();
                setOldPin('');
                setNewPin('');
                setConfirmPin('');
                setPinChangeError(null);
                setPinChangeSuccess(isUrdu ? 'حفاظتی پن کوڈ کامیابی سے تبدیل ہو گیا ہے!' : 'Security PIN successfully updated!');
                setTimeout(() => setPinChangeSuccess(null), 3500);
              }}
              disabled={!oldPin || !newPin || !confirmPin}
              className="w-full sm:w-auto px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs font-urdu-sans transition flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'پن کوڈ تبدیل کریں (Update PIN)' : 'Update PIN Code'}</span>
            </button>
          </div>
        </div>

        {/* System Transaction Audit Logs Section (Protected by PIN) */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center flex-shrink-0 shadow-inner">
                <ShieldCheck className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base font-urdu-sans text-white">
                    {isUrdu ? 'سسٹم ٹرانزیکشن آڈٹ لاگز (Audit Logs)' : 'System Audit & Transaction Logs'}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-400/30 font-urdu-sans">
                    {isUrdu ? 'حفاظتی پن مطلوب' : 'PIN Protected'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-urdu-sans mt-0.5 leading-relaxed">
                  {isUrdu
                    ? 'لاٹ کا نیا اندراج، بولی بکری، دکان اخراجات، نقد دراز کیش اور کھاتہ جات کے تمام ریکارڈز کی تبدیلی و حذف کا کمپیوٹر آڈٹ لاگ محفوظ ہے۔'
                    : 'View immutable system audit trail for all lot entries, sales, expenses, cash drawer, and khata records.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setIsPinModalOpenForLogs(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs font-urdu-sans flex items-center justify-center gap-2 transition active:scale-95 shadow-md flex-shrink-0 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-indigo-200" />
              <span>{isUrdu ? 'لاگز دکھائیں (Show Logs)' : 'Show Logs'}</span>
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-bold text-sm sm:text-base transition shadow-md active:scale-95 flex items-center justify-center gap-2 font-urdu-sans"
        >
          <Check className="w-5 h-5" />
          <span>{t.saveSettings}</span>
        </button>

        {/* JSON File Backup & Restore */}
        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2">
          <span className="text-xs font-bold text-stone-700 font-urdu-sans block">
            {isUrdu ? 'ڈیٹا بیک اپ، محفوظ کرنا و شیئر (JSON Backup):' : 'Data Backup, Device Save & Share (JSON):'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleExportJSON}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-200 transition flex items-center justify-center gap-1.5 shadow-2xs font-urdu-sans cursor-pointer"
            >
              <Save className="w-4 h-4 text-emerald-700" />
              <span>{isUrdu ? 'ڈیوائس پر محفوظ کریں' : 'Save to Device'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareJSON}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-blue-50 text-blue-900 text-xs font-bold border border-blue-200 transition flex items-center justify-center gap-1.5 shadow-2xs font-urdu-sans cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-blue-700" />
              <span>{isUrdu ? 'شیئر کریں (WhatsApp/Drive)' : 'Share Backup File'}</span>
            </button>

            <label className="py-2.5 px-3 rounded-xl bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold border border-stone-300 transition flex items-center justify-center gap-1.5 shadow-2xs font-urdu-sans cursor-pointer">
              <Upload className="w-4 h-4 text-stone-700" />
              <span>{isUrdu ? 'بیک اپ بحال کریں' : 'Restore Backup'}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </form>

      {/* Share Backup Modal */}
      <ShareBackupModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        settings={settings}
        lots={lots}
        customers={customers}
        vendors={vendors}
      />

      {/* Manage Mazdoori Rates Modal */}
      {isManageMazdooriOpen && (
        <ManageMazdooriModal
          isOpen={isManageMazdooriOpen}
          onClose={() => setIsManageMazdooriOpen(false)}
          items={getMazdooriItems(form)}
          settings={form}
          onSaveItems={(updatedItems) => {
            const newUnitRates: any = { ...form.unitMazdooriRates };
            updatedItems.forEach((it) => {
              if (it.unitType) newUnitRates[it.unitType] = it.rate;
            });
            const updatedForm = {
              ...form,
              mazdooriItems: updatedItems,
              unitMazdooriRates: newUnitRates,
            };
            setForm(updatedForm);
            onUpdateSettings(updatedForm);
          }}
        />
      )}

      {/* PIN Prompt Modal for System Audit Logs */}
      <PinPromptModal
        isOpen={isPinModalOpenForLogs}
        onClose={() => setIsPinModalOpenForLogs(false)}
        onSuccess={() => {
          setIsPinModalOpenForLogs(false);
          setIsLogsModalOpen(true);
        }}
        correctPin={settings.securityPin || '1234'}
        isUrdu={isUrdu}
        title={isUrdu ? 'سسٹم لاگز دیکھنے کے لیے پن کوڈ درج کریں' : 'Enter PIN to View System Logs'}
        itemDescription={isUrdu ? 'حفاظتی وجوہات کی بنا پر سسٹم آڈٹ لاگز تک رسائی کے لیے پن کوڈ درکار ہے۔' : 'Security PIN required to access audit logs.'}
      />

      {/* System Audit Logs Modal */}
      <SystemLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        settings={settings}
      />
    </div>
  );
};
