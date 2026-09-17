import React from 'react';
import { AppSettings, VendorLot } from '../types';
import { translations } from '../utils/localization';
import { formatPKR } from '../utils/currency';
import { PlusCircle, Globe, Smartphone, Monitor, Volume2, VolumeX, Sparkles, Cloud, CloudUpload, Wifi } from 'lucide-react';

interface HeaderProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  activeLotsCount?: number;
  todayLotsCount?: number;
  totalTodaySales: number;
  totalTodayProfit: number;
  onOpenNewLot?: () => void;
  onOpenCloudSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onUpdateSettings,
  activeLotsCount = 0,
  todayLotsCount,
  totalTodaySales,
  totalTodayProfit,
  onOpenNewLot,
  onOpenCloudSync,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  // Display today's lots count (or fallback to activeLotsCount if not provided)
  const displayLotsCount = typeof todayLotsCount === 'number' ? todayLotsCount : activeLotsCount;

  const toggleLanguage = () => {
    const nextLang = settings.language === 'ur' ? 'en' : 'ur';
    onUpdateSettings({ ...settings, language: nextLang });
    document.documentElement.dir = nextLang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = nextLang;
  };

  const toggleSound = () => {
    onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled });
  };

  const toggleViewMode = () => {
    onUpdateSettings({
      ...settings,
      viewMode: settings.viewMode === 'mobile' ? 'desktop' : 'mobile',
    });
  };

  const todayFormatted = new Date().toLocaleDateString(isUrdu ? 'ur-PK' : 'en-PK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="relative w-full bg-emerald-800 text-white shadow-md transition-all border-b border-emerald-700 pt-[max(env(safe-area-inset-top,0px),2.25rem)] sm:pt-3">
      {/* Top Bar */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
        {/* Shop Name & Logo */}
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center text-xl sm:text-2xl shadow-inner flex-shrink-0 backdrop-blur-xs">
            📦
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-xl font-bold truncate leading-tight tracking-wide font-urdu-nastaliq flex items-center gap-1.5">
              <span>{isUrdu ? settings.shopNameUrdu : settings.shopNameEn}</span>
              <span className="text-[10px] sm:text-xs font-normal opacity-80 font-sans hidden md:inline">
                {isUrdu ? `(${settings.shopNameEn})` : `(${settings.shopNameUrdu})`}
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-emerald-100 truncate flex items-center gap-1.5 sm:gap-2 font-urdu-sans mt-0.5">
              <span className="font-semibold">{isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn}</span>
              <span className="opacity-60">•</span>
              <span className="opacity-90">{todayFormatted}</span>
            </p>
          </div>
        </div>

        {/* Action Controls - Language & Speaker positioned neatly on the right */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Cloud Sync Button */}
          {onOpenCloudSync && (
            <button
              onClick={onOpenCloudSync}
              title={isUrdu ? 'کلاؤڈ ڈیٹا بیس و ڈیوائس سنک' : 'Cloud DB & Sync'}
              className="h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 transition text-white border border-emerald-400/30 flex items-center gap-1.5 text-xs shadow-2xs font-urdu-sans"
            >
              <CloudUpload className="w-3.5 h-3.5 text-emerald-200" />
              <span className="text-[11px] font-bold hidden sm:inline">{isUrdu ? 'کلاؤڈ سنک' : 'Cloud Sync'}</span>
            </button>
          )}

          {/* Device Frame View Toggle (Desktop only) */}
          <button
            onClick={toggleViewMode}
            title={settings.viewMode === 'mobile' ? 'پورے سائز پر دیکھیں' : 'موبائل سائز پر دیکھیں'}
            className="h-8 sm:h-9 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition text-white hidden lg:flex items-center gap-1.5 text-xs border border-white/15 active:scale-95"
          >
            {settings.viewMode === 'mobile' ? (
              <>
                <Monitor className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold">Desktop</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold">Mobile</span>
              </>
            )}
          </button>

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 font-bold text-xs transition flex items-center gap-1.5 border border-white/20 text-white shadow-2xs"
            title={isUrdu ? 'Switch Language' : 'زبان تبدیل کریں'}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isUrdu ? 'English' : 'اردو'}</span>
          </button>

          {/* Audio / Speaker toggle */}
          <button
            onClick={toggleSound}
            title={isUrdu ? 'آواز آن/آف' : 'Toggle Sound'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 transition text-white border border-white/20 flex items-center justify-center shadow-2xs"
            aria-label="Sound Toggle"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-100" />
            ) : (
              <VolumeX className="w-4 h-4 opacity-60" />
            )}
          </button>
        </div>
      </div>

      {/* Quick Summary Bar - Today's Live Stats */}
      <div className="bg-emerald-700/80 text-emerald-50 text-xs px-3 sm:px-6 py-1 sm:py-1.5 border-t border-emerald-500/60 backdrop-blur-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="flex items-center gap-1 font-urdu-sans">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-300 animate-pulse"></span>
              <span className="hidden xs:inline">{isUrdu ? 'آج کی لاٹس:' : "Today's Lots:"}</span>
              <span className="xs:hidden">{isUrdu ? 'آج لاٹس:' : 'Lots:'}</span>
              <strong className="text-emerald-950 bg-emerald-200/90 px-1.5 sm:px-2 py-0.5 rounded-full font-numbers font-bold">
                {displayLotsCount}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 font-numbers">
            <span className="text-emerald-100 font-urdu-sans truncate">
              <span className="hidden sm:inline">{isUrdu ? 'آج کی فروخت:' : "Today's Sales:"} </span>
              <span className="sm:hidden">{isUrdu ? 'آج فروخت:' : 'Sales:'} </span>
              <strong className="text-white font-bold font-numbers bg-white/15 px-1.5 sm:px-2 py-0.5 rounded-lg">
                {formatPKR(totalTodaySales, settings.currencySymbol, settings.language)}
              </strong>
            </span>
            <span className="text-emerald-100 font-urdu-sans truncate">
              <span className="hidden sm:inline">{isUrdu ? 'آج کا منافع:' : "Today's Profit:"} </span>
              <span className="sm:hidden">{isUrdu ? 'آج منافع:' : 'Profit:'} </span>
              <strong className="text-amber-300 font-bold font-numbers">
                {formatPKR(totalTodayProfit, settings.currencySymbol, settings.language)}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
