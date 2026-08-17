import React, { useState } from 'react';
import { AppSettings } from '../types';
import { translations } from '../utils/localization';
import { parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
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
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetData,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playCashChime();
    onUpdateSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
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

        {/* Commission & Rate Defaults */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <h3 className="font-bold text-xs sm:text-sm text-emerald-900 font-urdu-sans flex items-center gap-2 border-b border-stone-100 pb-2">
            <Percent className="w-4 h-4" />
            <span>{t.commissionSettings} (ڈیفالٹ ریٹس)</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                {t.defaultMazdoori}
              </label>
              <input
                type="number"
                value={form.defaultMazdooriPerUnit}
                onChange={(e) => setForm({ ...form, defaultMazdooriPerUnit: parseNumber(e.target.value) })}
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

        {/* Reset / Demo Data button */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => {
              if (confirm(isUrdu ? 'کیا آپ نمونہ ڈیٹا دوبارہ لوڈ کرنا چاہتے ہیں؟' : 'Reload demo Mandi lots?')) {
                onResetData();
              }
            }}
            className="text-xs text-stone-500 hover:text-stone-800 underline font-urdu-sans"
          >
            {t.restoreSampleData}
          </button>
        </div>
      </form>
    </div>
  );
};
