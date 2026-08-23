import React, { useState } from 'react';
import { AppSettings, VendorLot, CustomerBuyer, SavedVendor, UnitType } from '../types';
import { translations, unitLabels } from '../utils/localization';
import { parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { getStoredCloudConfig } from '../utils/cloudSyncEngine';
import { DEFAULT_UNIT_MAZDOORI_RATES } from '../utils/calculations';
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
  Cloud,
  CloudUpload,
  HardDrive,
  Download,
  Upload,
  PackageCheck,
  Calculator,
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
  const cloudConfig = getStoredCloudConfig();

  const totalBidsCount = lots.reduce((acc, l) => acc + l.sales.length, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playCashChime();
    onUpdateSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportJSON = async () => {
    sound.playTick();
    const exportPayload = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      lots,
      customers,
      vendors,
    };
    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const fileName = `sabzi-mandi-backup-${new Date().toISOString().split('T')[0]}.json`;

    try {
      // Direct browser / web download
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      sound.playCashChime();
    } catch (err) {
      // Fallback data URI
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      sound.playCashChime();
    }
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
                رابطہ فون نمبر (WhatsApp)
              </label>
              <input
                type="text"
                value={form.shopPhone}
                onChange={(e) => setForm({ ...form, shopPhone: e.target.value })}
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

        {/* Unit-Wise Mazdoori Labor Rates (پیکنگ وار مزدوری ریٹس) */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-100 pb-2">
            <h3 className="font-bold text-xs sm:text-sm text-emerald-900 font-urdu-sans flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>پیکنگ وار فی یونٹ مزدوری / اترائی کے ریٹس (Mazdoori per Unit)</span>
            </h3>
            <span className="text-[11px] text-emerald-700 font-urdu-sans font-medium">
              {isUrdu ? 'نئی لاٹ اندراج پر خودکار لاگو' : 'Auto applied during new lot entry'}
            </span>
          </div>

          <p className="text-xs text-stone-600 font-urdu-sans">
            {isUrdu
              ? 'ہر قسم کی پیکنگ (بوری، توڑہ، کینچی، شاپر وغیرہ) کا الگ فی یونٹ مزدوری ریٹ مقرر کریں تاکہ مال اندراج پر خودکار ضرب ہو کر درست خرچہ نکلے:'
              : 'Set individual labor/unloading rates per unit type (Bori, Tora, Kainchi, Shopper, etc.):'}
          </p>

          {/* Primary 4 Units: بوری, توڑہ, کینچی, شاپر */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {([
              { key: 'bori' as UnitType, labelUrdu: 'بوری (Bori)', desc: 'مثلاً: آلو، پیاز، ادرک' },
              { key: 'tora' as UnitType, labelUrdu: 'توڑہ / تورڑہ (Tora)', desc: 'مثلاً: بند گوبھی، مٹر' },
              { key: 'kainchi' as UnitType, labelUrdu: 'کینچی (Kainchi)', desc: 'مثلاً: ٹماٹر، پھل' },
              { key: 'shopper' as UnitType, labelUrdu: 'شاپر (Shopper)', desc: 'مثلاً: سبز مرچ، لیمو' },
            ]).map((item) => {
              const currentRate =
                form.unitMazdooriRates?.[item.key] ?? DEFAULT_UNIT_MAZDOORI_RATES[item.key] ?? 20;
              return (
                <div key={item.key} className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-200/70 space-y-1">
                  <label className="block text-xs font-bold text-emerald-950 font-urdu-sans">
                    {item.labelUrdu}
                  </label>
                  <span className="block text-[10px] text-emerald-800 font-urdu-sans truncate">
                    {item.desc}
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs font-bold text-slate-500 font-numbers">₨</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={currentRate}
                      onChange={(e) => {
                        const val = parseNumber(e.target.value);
                        setForm({
                          ...form,
                          unitMazdooriRates: {
                            ...DEFAULT_UNIT_MAZDOORI_RATES,
                            ...form.unitMazdooriRates,
                            [item.key]: val,
                          },
                        });
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-numbers text-center font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Other Packing Units */}
          <div className="pt-2 border-t border-stone-100">
            <label className="block text-[11px] font-semibold text-stone-600 mb-1.5 font-urdu-sans">
              {isUrdu ? 'دیگر متبادل پیکنگ ریٹس:' : 'Other unit labor rates:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {([
                { key: 'crates' as UnitType, labelUrdu: 'کریٹ (Crates)' },
                { key: 'peti' as UnitType, labelUrdu: 'پیٹی (Peti)' },
                { key: 'theli' as UnitType, labelUrdu: 'تھیلی (Theli)' },
                { key: 'kg' as UnitType, labelUrdu: 'کلوگرام (Kg)' },
                { key: 'nag' as UnitType, labelUrdu: 'نگ / عدد (Pieces)' },
              ]).map((item) => {
                const currentRate =
                  form.unitMazdooriRates?.[item.key] ?? DEFAULT_UNIT_MAZDOORI_RATES[item.key] ?? 20;
                return (
                  <div key={item.key} className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                    <label className="block text-[11px] font-bold text-stone-700 font-urdu-sans truncate">
                      {item.labelUrdu}
                    </label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[11px] text-slate-500 font-numbers">₨</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={currentRate}
                        onChange={(e) => {
                          const val = parseNumber(e.target.value);
                          setForm({
                            ...form,
                            unitMazdooriRates: {
                              ...DEFAULT_UNIT_MAZDOORI_RATES,
                              ...form.unitMazdooriRates,
                              [item.key]: val,
                            },
                          });
                        }}
                        className="w-full px-1.5 py-1 bg-white border border-stone-300 rounded-md text-xs font-numbers text-center font-bold text-stone-900"
                      />
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
                  ? `اگر آپ آلو کے ۵ بوری منتخب کرتے ہیں اور بوری کی مزدوری ₨${form.unitMazdooriRates?.bori ?? DEFAULT_UNIT_MAZDOORI_RATES.bori} ہے، تو کل مزدوری خودکار ۵ × ₨${form.unitMazdooriRates?.bori ?? DEFAULT_UNIT_MAZDOORI_RATES.bori} = ₨${(5 * (form.unitMazdooriRates?.bori ?? DEFAULT_UNIT_MAZDOORI_RATES.bori)).toLocaleString('en-US')} درج ہوگی۔`
                  : `If you select 5 bori of Potatoes with rate Rs.${form.unitMazdooriRates?.bori ?? DEFAULT_UNIT_MAZDOORI_RATES.bori}/bori, total labor will automatically be 5 × Rs.${form.unitMazdooriRates?.bori ?? DEFAULT_UNIT_MAZDOORI_RATES.bori} = Rs.${5 * (form.unitMazdooriRates?.bori ?? DEFAULT_UNIT_MAZDOORI_RATES.bori)}.`}
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
            {isUrdu ? 'ڈیٹا بیک اپ و ڈاؤن لوڈ (JSON File):' : 'Local Data Backup & File Export:'}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold border border-stone-300 transition flex items-center justify-center gap-1.5 shadow-2xs font-urdu-sans"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isUrdu ? 'بیک اپ فائل محفوظ کریں' : 'Download Backup File'}</span>
            </button>

            <label className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-stone-100 text-stone-800 text-xs font-bold border border-stone-300 transition flex items-center justify-center gap-1.5 shadow-2xs font-urdu-sans cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-blue-700" />
              <span>{isUrdu ? 'بیک اپ فائل بحال کریں' : 'Restore Backup File'}</span>
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
    </div>
  );
};
