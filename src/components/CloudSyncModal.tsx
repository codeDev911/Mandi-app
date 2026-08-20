import React, { useState, useEffect } from 'react';
import { AppSettings, VendorLot, CustomerBuyer, SavedVendor } from '../types';
import {
  CloudSyncMetadata,
  getStoredCloudConfig,
  saveStoredCloudConfig,
  uploadDataToCloud,
  downloadDataFromCloud,
  testPostgresConnection,
  formatSyncDateTime,
  CloudSyncResult,
} from '../utils/cloudSyncEngine';
import { sound } from '../utils/sound';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Laptop,
  Wifi,
  WifiOff,
  Lock,
  Key,
  X,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Database,
  Server,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ExternalLink,
  Save,
  CheckCircle,
  Layers,
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  settings: AppSettings;
  lots: VendorLot[];
  customers: CustomerBuyer[];
  vendors: SavedVendor[];
  onApplyCloudData: (data: {
    settings?: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
  }) => void;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  settings,
  lots,
  customers,
  vendors,
  onApplyCloudData,
  onClose,
}) => {
  const isUrdu = settings.language === 'ur';

  const [activeTab, setActiveTab] = useState<'upload' | 'download' | 'postgres'>('upload');
  const [config, setConfig] = useState<CloudSyncMetadata>(getStoredCloudConfig());
  const [downloadShopId, setDownloadShopId] = useState(config.shopCloudId);
  const [downloadPin, setDownloadPin] = useState(config.shopPin);
  const [postgresUrlInput, setPostgresUrlInput] = useState(config.postgresUrl || '');

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<CloudSyncResult | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [copiedId, setCopiedId] = useState(false);

  // PostgreSQL Connection Test State
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{
    success: boolean;
    message: string;
    serverTime?: string;
    version?: string;
  } | null>(null);

  // Keyboard Escape listener and Body Lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update local config state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredCloudConfig();
      setConfig(stored);
      setDownloadShopId(stored.shopCloudId);
      setDownloadPin(stored.shopPin);
      setPostgresUrlInput(stored.postgresUrl || '');
      setSyncResult(null);
      setDbTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setSyncResult(null);
    sound.playPop();

    const result = await uploadDataToCloud(
      {
        ...config,
        postgresUrl: postgresUrlInput.trim(),
      },
      {
        settings,
        lots,
        customers,
        vendors,
      }
    );

    setIsSyncing(false);
    setSyncResult(result);

    if (result.success) {
      sound.playCashChime();
      const updated = getStoredCloudConfig();
      setConfig(updated);
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !confirm(
        isUrdu
          ? 'کیا آپ کلاؤڈ / PostgreSQL سے ڈیٹا ڈاؤن لوڈ کر کے اس ڈیوائس پر لانا چاہتے ہیں؟'
          : 'Download & sync PostgreSQL cloud data to this device?'
      )
    ) {
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    sound.playPop();

    const result = await downloadDataFromCloud(
      downloadShopId,
      downloadPin,
      postgresUrlInput.trim()
    );

    setIsSyncing(false);
    setSyncResult(result);

    if (result.success && result.data) {
      sound.playCashChime();
      onApplyCloudData(result.data);
      const updated = getStoredCloudConfig();
      setConfig(updated);
    }
  };

  const handleTestPostgres = async () => {
    setIsTestingDb(true);
    setDbTestResult(null);
    sound.playPop();

    const res = await testPostgresConnection(postgresUrlInput.trim());
    setIsTestingDb(false);
    setDbTestResult(res);

    if (res.success) {
      sound.playCashChime();
      const updated = {
        ...config,
        postgresUrl: postgresUrlInput.trim(),
      };
      saveStoredCloudConfig(updated);
      setConfig(updated);
    }
  };

  const handleSavePostgresUrl = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playTick();
    const updated = {
      ...config,
      postgresUrl: postgresUrlInput.trim(),
    };
    saveStoredCloudConfig(updated);
    setConfig(updated);
    alert(isUrdu ? 'PostgreSQL کنکشن محفوظ ہو گیا!' : 'PostgreSQL configuration saved!');
  };

  const handleCopyShopId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(config.shopCloudId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-emerald-800/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-md flex-shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg font-urdu-nastaliq text-white">
                  {isUrdu ? 'کلاؤڈ ڈیٹا بیس و ملٹی ڈیوائس ہم آہنگی' : 'PostgreSQL Cloud Database & Multi-Device Sync'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 font-urdu-sans ${
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}
                >
                  {isOnline ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
                  <span>{isOnline ? 'آن لائن' : 'آف لائن'}</span>
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 font-urdu-sans mt-0.5">
                {isUrdu
                  ? 'پوسٹگریس کیول (PostgreSQL) کلاؤڈ ڈیٹا بیس سنک برائے موبائل و لیپ ٹاپ'
                  : 'Enterprise PostgreSQL sync for mobile devices and office computers'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition active:scale-95 flex-shrink-0 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Real-time Last Upload & Last Download Timestamps Banner */}
        <div className="bg-slate-900 px-4 py-2.5 text-xs text-slate-300 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <ArrowUpRight className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="truncate">
              <span className="text-[11px] text-slate-400 font-urdu-sans block">
                {isUrdu ? 'آخری اپ لوڈ کا وقت (Last Uploaded):' : 'Last Uploaded:'}
              </span>
              <span className="font-semibold text-emerald-300 font-numbers text-xs">
                {formatSyncDateTime(config.lastUploadedAt, isUrdu)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <ArrowDownLeft className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div className="truncate">
              <span className="text-[11px] text-slate-400 font-urdu-sans block">
                {isUrdu ? 'آخری ڈاؤن لوڈ کا وقت (Last Downloaded):' : 'Last Downloaded:'}
              </span>
              <span className="font-semibold text-blue-300 font-numbers text-xs">
                {formatSyncDateTime(config.lastDownloadedAt, isUrdu)}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 bg-stone-100 border-b border-stone-200 flex gap-1.5 sm:gap-2 flex-shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setSyncResult(null);
            }}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition flex items-center justify-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            <span>{isUrdu ? '1. کلاؤڈ اپ لوڈ' : '1. Upload Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('download');
              setSyncResult(null);
            }}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition flex items-center justify-center gap-1.5 ${
              activeTab === 'download'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
            }`}
          >
            <CloudDownload className="w-4 h-4" />
            <span>{isUrdu ? '2. کلاؤڈ ڈاؤن لوڈ' : '2. Download Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('postgres');
              setSyncResult(null);
            }}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition flex items-center justify-center gap-1.5 ${
              activeTab === 'postgres'
                ? 'bg-purple-800 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{isUrdu ? '3. PostgreSQL سیٹنگ' : '3. PostgreSQL Setup'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Result Alert */}
          {syncResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-start gap-2.5 font-urdu-sans animate-in fade-in duration-150 ${
                syncResult.success
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                  : 'bg-red-50 text-red-950 border-red-300'
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">{syncResult.message}</p>
                {syncResult.success && syncResult.lotsCount !== undefined && (
                  <div className="text-xs text-stone-700 mt-1 font-numbers flex items-center gap-3 flex-wrap">
                    <span>📦 <strong>{syncResult.lotsCount}</strong> لاٹس</span>
                    <span>👥 <strong>{syncResult.customersCount}</strong> گاہک کھاتے</span>
                    <span>🚜 <strong>{syncResult.vendorsCount}</strong> زمیندار</span>
                    {syncResult.dbEngine && (
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-mono text-[10px]">
                        {syncResult.dbEngine}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: UPLOAD */}
          {activeTab === 'upload' && (
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 font-urdu-sans flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>{isUrdu ? 'دکان کی شناختی معلومات (Shop Cloud Credentials)' : 'Shop Cloud Credentials'}</span>
                  </h4>
                  <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-lg font-urdu-sans">
                    PostgreSQL Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                      {isUrdu ? 'دکان کا کلاؤڈ کوڈ (Shop Cloud ID)' : 'Shop Cloud ID'}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={config.shopCloudId}
                        onChange={(e) => setConfig({ ...config, shopCloudId: e.target.value.toUpperCase() })}
                        placeholder="MANDI-786"
                        className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-mono font-bold uppercase text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleCopyShopId}
                        className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs flex items-center justify-center transition"
                        title="کوڈ کاپی کریں"
                      >
                        {copiedId ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                      {isUrdu ? 'سیکیورٹی پن کوڈ (Cloud PIN)' : 'Cloud PIN'}
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={config.shopPin}
                      onChange={(e) => setConfig({ ...config, shopPin: e.target.value })}
                      placeholder="1234"
                      className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-stone-500 font-urdu-sans">
                  💡 {isUrdu
                    ? 'یہ کوڈ اور پن دوسری ڈیوائس پر درج کر کے تمام روزنامچہ اور کھاتہ حاصل کیا جا سکتا ہے۔'
                    : 'Use this Shop ID and PIN on your other mobile/laptop to download your shop data.'}
                </p>
              </div>

              {/* Data Summary Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 font-urdu-sans block">
                    {isUrdu ? 'موجودہ لاٹس' : 'Active Lots'}
                  </span>
                  <strong className="text-base font-bold text-emerald-950 font-numbers">{lots.length}</strong>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 font-urdu-sans block">
                    {isUrdu ? 'گاہک کھاتے' : 'Buyers Khata'}
                  </span>
                  <strong className="text-base font-bold text-emerald-950 font-numbers">{customers.length}</strong>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 font-urdu-sans block">
                    {isUrdu ? 'زمیندار ڈائرکٹری' : 'Vendors'}
                  </span>
                  <strong className="text-base font-bold text-emerald-950 font-numbers">{vendors.length}</strong>
                </div>
              </div>

              {/* Upload Action Button */}
              <button
                type="submit"
                disabled={isSyncing}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-bold text-sm sm:text-base font-urdu-sans transition shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{isUrdu ? 'PostgreSQL پر محفوظ ہو رہا ہے...' : 'Syncing to PostgreSQL...'}</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-5 h-5" />
                    <span>{isUrdu ? 'PostgreSQL کلاؤڈ پر ڈیٹا اپ لوڈ کریں' : 'Upload Data to PostgreSQL'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: DOWNLOAD */}
          {activeTab === 'download' && (
            <form onSubmit={handleDownload} className="space-y-4">
              <div className="bg-blue-50/90 p-4 rounded-2xl border border-blue-200 text-xs font-urdu-sans text-blue-950 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-blue-900">
                  <Smartphone className="w-4 h-4" />
                  <span>{isUrdu ? 'دوسری ڈیوائس پر ڈیٹا لانے کا طریقہ:' : 'Download instructions:'}</span>
                </p>
                <p>
                  {isUrdu
                    ? 'ماسٹر موبائل پر اپ لوڈ کرنے کے بعد، اس ڈیوائس پر وہی Shop Cloud ID اور PIN درج کر کے ڈاؤن لوڈ بٹن دبائیں۔'
                    : 'Enter the Shop Cloud ID and PIN from your primary device to download all records.'}
                </p>
              </div>

              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                    {isUrdu ? 'دکان کا کلاؤڈ کوڈ (Shop Cloud ID)' : 'Shop Cloud ID'}
                  </label>
                  <input
                    type="text"
                    value={downloadShopId}
                    onChange={(e) => setDownloadShopId(e.target.value.toUpperCase())}
                    placeholder="MANDI-786"
                    className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-mono font-bold uppercase text-blue-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1 font-urdu-sans">
                    {isUrdu ? 'سیکیورٹی پن کوڈ (Cloud PIN)' : 'Security PIN'}
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    value={downloadPin}
                    onChange={(e) => setDownloadPin(e.target.value)}
                    placeholder="1234"
                    className="w-full px-3 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Download Action Button */}
              <button
                type="submit"
                disabled={isSyncing}
                className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-2xl font-bold text-sm sm:text-base font-urdu-sans transition shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{isUrdu ? 'PostgreSQL سے ڈیٹا ڈاؤن لوڈ ہو رہا ہے...' : 'Downloading from PostgreSQL...'}</span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="w-5 h-5" />
                    <span>{isUrdu ? 'کلاؤڈ سے تازہ ترین ڈیٹا حاصل کریں (Download & Merge)' : 'Download & Sync Data Now'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: POSTGRESQL CONFIGURATION & URL FORMAT */}
          {activeTab === 'postgres' && (
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 space-y-2">
                <div className="flex items-center gap-2 text-purple-950">
                  <Server className="w-5 h-5 text-purple-700" />
                  <h4 className="font-bold text-sm font-urdu-sans">
                    {isUrdu ? 'پوسٹگریس کیول (PostgreSQL) کنکشن کی تفصیلات' : 'PostgreSQL Database Connection'}
                  </h4>
                </div>
                <p className="text-xs text-purple-900 font-urdu-sans leading-relaxed">
                  {isUrdu
                    ? 'ہم مکمل طور پر PostgreSQL کنکشن یو آر ایل سپورٹ کرتے ہیں (جیسے Supabase, Neon.tech, AWS RDS, Cloud SQL یا لوکل PostgreSQL)۔ نیچے اپنا کنکشن اسٹرنگ درج کریں اور ٹیسٹ کریں۔'
                    : 'We natively support PostgreSQL. You can use hosted PostgreSQL providers like Supabase, Neon.tech, AWS RDS, Cloud SQL, Railway, or local PostgreSQL.'}
                </p>
              </div>

              {/* Recommended Connection URL Format */}
              <div className="bg-stone-900 text-stone-200 p-4 rounded-2xl border border-stone-800 space-y-2.5">
                <span className="text-xs font-bold text-amber-400 font-urdu-sans block">
                  {isUrdu ? 'کنکشن یو آر ایل کا فارمیٹ (PostgreSQL URL Format):' : 'Supported PostgreSQL Connection URL Format:'}
                </span>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto break-all select-all">
                  postgresql://username:password@host:5432/database?sslmode=require
                </div>

                <div className="text-[11px] text-stone-400 space-y-1 font-urdu-sans">
                  <p>• <strong>Supabase:</strong> postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres</p>
                  <p>• <strong>Neon.tech:</strong> postgresql://[USER]:[PASSWORD]@[ENDPOINT].us-east-2.aws.neon.tech/neondb?sslmode=require</p>
                  <p>• <strong>Local / Docker:</strong> postgresql://postgres:password@localhost:5432/mandi_db</p>
                </div>
              </div>

              {/* PostgreSQL Connection URL Input Form */}
              <form onSubmit={handleSavePostgresUrl} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1 font-urdu-sans">
                    {isUrdu ? 'آپ کا PostgreSQL کنکشن یو آر ایل (PostgreSQL Connection URL):' : 'Your PostgreSQL Connection URL:'}
                  </label>
                  <textarea
                    rows={2}
                    value={postgresUrlInput}
                    onChange={(e) => setPostgresUrlInput(e.target.value)}
                    placeholder="postgresql://username:password@host:5432/dbname?sslmode=require"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                  <span className="text-[11px] text-stone-500 font-urdu-sans block mt-1">
                    {isUrdu
                      ? 'اگر آپ نے سرور کی .env فائل میں DATABASE_URL سیٹ کیا ہے تو اسے خالی چھوڑا جا سکتا ہے۔'
                      : 'Leave blank to use the backend server DATABASE_URL environment variable.'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleTestPostgres}
                    disabled={isTestingDb}
                    className="flex-1 py-2.5 px-3 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm font-urdu-sans transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isTestingDb ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isUrdu ? 'کنکشن ٹیسٹ ہو رہا ہے...' : 'Testing Connection...'}</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>{isUrdu ? 'کنکشن ٹیسٹ کریں (Test DB)' : 'Test Connection'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-bold text-xs sm:text-sm font-urdu-sans transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isUrdu ? 'محفوظ کریں' : 'Save'}</span>
                  </button>
                </div>
              </form>

              {/* DB Test Result Banner */}
              {dbTestResult && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs font-urdu-sans ${
                    dbTestResult.success
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                      : 'bg-red-50 text-red-950 border-red-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {dbTestResult.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold">{dbTestResult.message}</p>
                      {dbTestResult.version && (
                        <p className="text-[11px] font-mono text-stone-600 truncate">{dbTestResult.version}</p>
                      )}
                      {dbTestResult.serverTime && (
                        <p className="text-[11px] font-mono text-emerald-800">
                          Server Time: {new Date(dbTestResult.serverTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Close Button */}
        <div className="p-3.5 bg-stone-100 border-t border-stone-200 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-stone-600 font-urdu-sans">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span className="hidden sm:inline">{isUrdu ? 'آف لائن IndexedDB + کلاؤڈ PostgreSQL ہم آہنگی فعال ہے' : 'Offline-first IndexedDB + PostgreSQL Cloud Sync'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs sm:text-sm font-urdu-sans transition shadow-xs cursor-pointer active:scale-95"
          >
            {isUrdu ? 'بند کریں (Close)' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
