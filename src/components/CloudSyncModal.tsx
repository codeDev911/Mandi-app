import React, { useState, useEffect } from 'react';
import { AppSettings, VendorLot, CustomerBuyer, SavedVendor, ShopExpense, DrawerAdjustment, SyncProgressState } from '../types';
import { SyncProgressModal } from './SyncProgressModal';
import {
  CloudSyncMetadata,
  getStoredCloudConfig,
  saveStoredCloudConfig,
  uploadDataToCloud,
  downloadDataFromCloud,
  testS3Connection,
  parseS3CredentialsBlock,
  formatSyncDateTime,
  CloudSyncResult,
} from '../utils/cloudSyncEngine';
import { getSystemLogs } from '../utils/systemLogs';
import { sound } from '../utils/sound';
import {
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Wifi,
  WifiOff,
  Key,
  X,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Database,
  ArrowUpRight,
  ArrowDownLeft,
  Save,
  CheckCircle,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Server,
  FolderArchive,
  Receipt,
  Users,
  Boxes,
  Lock,
} from 'lucide-react';

interface CloudSyncModalProps {
  isOpen: boolean;
  settings: AppSettings;
  lots: VendorLot[];
  customers: CustomerBuyer[];
  vendors: SavedVendor[];
  expenses?: ShopExpense[];
  drawerAdjustments?: DrawerAdjustment[];
  onApplyCloudData: (data: {
    settings?: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
    expenses?: ShopExpense[];
    drawerAdjustments?: DrawerAdjustment[];
    systemLogs?: any[];
  }) => void;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  settings,
  lots,
  customers,
  vendors,
  expenses = [],
  drawerAdjustments = [],
  onApplyCloudData,
  onClose,
}) => {
  const isUrdu = settings.language === 'ur';

  const [activeTab, setActiveTab] = useState<'upload' | 'download' | 's3_config'>('upload');
  const [config, setConfig] = useState<CloudSyncMetadata>(getStoredCloudConfig());
  const [downloadShopId, setDownloadShopId] = useState(config.shopCloudId);
  const [downloadPin, setDownloadPin] = useState(config.shopPin);

  // S3 Specific Form Fields
  const [endpointUrl, setEndpointUrl] = useState(config.endpointUrl || '');
  const [accessKeyId, setAccessKeyId] = useState(config.accessKeyId || '');
  const [secretAccessKey, setSecretAccessKey] = useState(config.secretAccessKey || '');
  const [region, setRegion] = useState(config.region || 'us-east-2');
  const [bucketName, setBucketName] = useState(config.bucketName || 'mandi-data');
  const [apiProxyUrl, setApiProxyUrl] = useState(config.apiProxyUrl || '');
  const [credentialsBlock, setCredentialsBlock] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<CloudSyncResult | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [copiedId, setCopiedId] = useState(false);

  // Progressive Sync Modal State
  const [syncProgress, setSyncProgress] = useState<SyncProgressState | null>(null);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [showDownloadConfirmModal, setShowDownloadConfirmModal] = useState<boolean>(false);
  const [credentialsNotice, setCredentialsNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // S3 Connection Test State
  const [isTestingS3, setIsTestingS3] = useState(false);
  const [s3TestResult, setS3TestResult] = useState<{
    success: boolean;
    message: string;
    endpoint?: string;
    bucketName?: string;
    availableBuckets?: string[];
    storageEngine?: string;
  } | null>(null);

  // Keyboard Escape listener
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

  // Update local state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredCloudConfig();
      setConfig(stored);
      setDownloadShopId(stored.shopCloudId);
      setDownloadPin(stored.shopPin);
      setEndpointUrl(stored.endpointUrl || '');
      setAccessKeyId(stored.accessKeyId || '');
      setSecretAccessKey(stored.secretAccessKey || '');
      setRegion(stored.region || 'us-east-2');
      setBucketName(stored.bucketName || 'mandi-data');
      setApiProxyUrl(stored.apiProxyUrl || '');
      setSyncResult(null);
      setS3TestResult(null);
      setCredentialsNotice(null);
      setSaveNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentS3Config: CloudSyncMetadata = {
    ...config,
    endpointUrl: endpointUrl.trim(),
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
    region: region.trim() || 'us-east-2',
    bucketName: bucketName.trim() || 'mandi-data',
    apiProxyUrl: apiProxyUrl.trim(),
  };

  const hasConfiguredS3 = Boolean(endpointUrl.trim() && accessKeyId.trim() && secretAccessKey.trim());

  const handleUpload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSyncing(true);
    setSyncResult(null);
    setSyncProgress({
      stage: 'preparing',
      direction: 'upload',
      loadedBytes: 0,
      totalBytes: 0,
      percentage: 5,
      speedBytesPerSec: 0,
      estimatedSecondsLeft: 0,
      message: 'Preparing data package...',
    });
    setShowProgressModal(true);
    sound.playPop();

    const systemLogs = getSystemLogs();

    const result = await uploadDataToCloud(
      currentS3Config,
      {
        settings,
        lots,
        customers,
        vendors,
        expenses,
        drawerAdjustments,
        systemLogs,
      },
      (progress) => {
        setSyncProgress(progress);
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

  const handleRequestDownload = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!downloadShopId.trim()) return;
    sound.playPop();
    setShowDownloadConfirmModal(true);
  };

  const executeDownload = async () => {
    setShowDownloadConfirmModal(false);
    setIsSyncing(true);
    setSyncResult(null);
    setSyncProgress({
      stage: 'preparing',
      direction: 'download',
      loadedBytes: 0,
      totalBytes: 0,
      percentage: 5,
      speedBytesPerSec: 0,
      estimatedSecondsLeft: 0,
      message: 'Connecting to S3 Cloud...',
    });
    setShowProgressModal(true);
    sound.playPop();

    const result = await downloadDataFromCloud(
      downloadShopId,
      downloadPin,
      currentS3Config,
      (progress) => {
        setSyncProgress(progress);
      }
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

  const handleParseCredentialsBlock = () => {
    if (!credentialsBlock.trim()) {
      setCredentialsNotice({
        type: 'error',
        message: isUrdu ? 'براہ کرم کریڈنشلز بلاک پیسٹ کریں' : 'Please paste the S3 credentials block first',
      });
      return;
    }

    const parsed = parseS3CredentialsBlock(credentialsBlock);
    if (parsed.endpointUrl) setEndpointUrl(parsed.endpointUrl);
    if (parsed.accessKeyId) setAccessKeyId(parsed.accessKeyId);
    if (parsed.secretAccessKey) setSecretAccessKey(parsed.secretAccessKey);
    if (parsed.region) setRegion(parsed.region);
    if (parsed.bucketName) setBucketName(parsed.bucketName);
    if (parsed.apiProxyUrl) setApiProxyUrl(parsed.apiProxyUrl);

    sound.playCashChime();
    setCredentialsNotice({
      type: 'success',
      message: isUrdu
        ? 'S3 کریڈنشلز کامیابی سے نکال لیے گئے اور فارم میں درج ہو گئے ہیں!'
        : 'S3 Credentials extracted and filled into the form successfully!',
    });
    setTimeout(() => setCredentialsNotice(null), 5000);
  };

  const handleTestS3 = async () => {
    setIsTestingS3(true);
    setS3TestResult(null);
    sound.playPop();

    const res = await testS3Connection(currentS3Config);
    setIsTestingS3(false);
    setS3TestResult(res);

    if (res.success) {
      sound.playCashChime();
      saveStoredCloudConfig(currentS3Config);
      setConfig(currentS3Config);
    }
  };

  const handleSaveS3Config = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playTick();
    saveStoredCloudConfig(currentS3Config);
    setConfig(currentS3Config);
    setSaveNotice(isUrdu ? 'S3 آبجیکٹ اسٹوریج کی تفصیلات محفوظ ہو گئیں!' : 'S3 Object Storage settings saved!');
    setTimeout(() => setSaveNotice(null), 4000);
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
                  {isUrdu ? 'S3 کلاؤڈ آبجیکٹ اسٹوریج و ہم آہنگی' : 'S3 Object Storage Cloud Sync'}
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
                {hasConfiguredS3 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                    Neon S3
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-200/80 font-urdu-sans mt-0.5">
                {isUrdu
                  ? 'نیون (Neon) اور AWS S3 ہم آہنگ آبجیکٹ اسٹوریج برائے موبائل، ٹیبلٹ و کمپیوٹر'
                  : 'S3-compatible object storage (Neon / AWS) for seamless cross-device data backup'}
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
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition flex items-center justify-center gap-1.5 cursor-pointer ${
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
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition flex items-center justify-center gap-1.5 cursor-pointer ${
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
              setActiveTab('s3_config');
              setSyncResult(null);
            }}
            className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold font-urdu-sans transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 's3_config'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>{isUrdu ? '3. S3 سیٹنگز' : '3. S3 Storage Setup'}</span>
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
                    <span>💸 <strong>{syncResult.expensesCount}</strong> اخراجات</span>
                    {syncResult.storageEngine && (
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-mono text-[10px]">
                        {syncResult.storageEngine}
                      </span>
                    )}
                  </div>
                )}
                {syncResult.objectKey && (
                  <p className="text-[11px] font-mono text-stone-600 mt-1 truncate">
                    Path: {syncResult.objectKey}
                  </p>
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
                    <span>{isUrdu ? 'دکان کی کلاؤڈ شناختی معلومات (Shop Cloud Credentials)' : 'Shop Cloud Credentials'}</span>
                  </h4>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-lg font-urdu-sans ${
                      hasConfiguredS3
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {hasConfiguredS3 ? 'S3 Storage Active' : 'Default / Local Storage'}
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
                        className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs flex items-center justify-center transition cursor-pointer"
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
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
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 font-urdu-sans block">
                    {isUrdu ? 'دکان اخراجات' : 'Shop Expenses'}
                  </span>
                  <strong className="text-base font-bold text-emerald-950 font-numbers">{expenses.length}</strong>
                </div>
              </div>

              {!hasConfiguredS3 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs font-urdu-sans">
                  <span className="text-amber-900">
                    {isUrdu
                      ? 'نوٹ: Neon S3 کی ترتیبات Tab 3 میں درج کر کے کلاؤڈ ڈیٹا محفوظ کریں۔'
                      : 'Tip: Add your Neon S3 credentials in Tab 3 to sync to object storage.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('s3_config')}
                    className="text-amber-800 font-bold underline whitespace-nowrap cursor-pointer"
                  >
                    {isUrdu ? 'S3 سیٹنگز کھولیں' : 'Open Setup'}
                  </button>
                </div>
              )}

              {/* Upload Action Button */}
              <button
                type="submit"
                disabled={isSyncing}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl font-bold text-sm sm:text-base font-urdu-sans transition shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{isUrdu ? 'S3 اسٹوریج پر محفوظ ہو رہا ہے...' : 'Syncing to S3 Object Storage...'}</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-5 h-5" />
                    <span>{isUrdu ? 'S3 کلاؤڈ پر تمام ڈیٹا اپ لوڈ کریں' : 'Upload All Data to S3 Storage'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: DOWNLOAD */}
          {activeTab === 'download' && (
            <form onSubmit={handleRequestDownload} className="space-y-4">
              <div className="bg-blue-50/90 p-4 rounded-2xl border border-blue-200 text-xs font-urdu-sans text-blue-950 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-blue-900">
                  <Smartphone className="w-4 h-4" />
                  <span>{isUrdu ? 'دوسری ڈیوائس پر ڈیٹا لانے کا طریقہ:' : 'Download instructions:'}</span>
                </p>
                <p>
                  {isUrdu
                    ? 'ماسٹر موبائل یا کمپیوٹر پر اپ لوڈ کرنے کے بعد، اس ڈیوائس پر وہی Shop Cloud ID اور PIN درج کر کے ڈاؤن لوڈ بٹن دبائیں۔'
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
                    <span>{isUrdu ? 'S3 سے ڈیٹا ڈاؤن لوڈ ہو رہا ہے...' : 'Downloading from S3 Storage...'}</span>
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

          {/* TAB 3: S3 OBJECT STORAGE CONFIGURATION & CREDENTIALS */}
          {activeTab === 's3_config' && (
            <div className="space-y-4">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-950">
                  <Server className="w-5 h-5 text-amber-700" />
                  <h4 className="font-bold text-sm font-urdu-sans">
                    {isUrdu ? 'نیون (Neon) اور S3 آبجیکٹ اسٹوریج کنکشن' : 'Neon / S3 Object Storage Credentials'}
                  </h4>
                </div>
                <p className="text-xs text-amber-900 font-urdu-sans leading-relaxed">
                  {isUrdu
                    ? 'نیون آبجیکٹ اسٹوریج (Neon Object Storage) یا کسی بھی S3 ہم آہنگ سروس کے کریڈنشلز نیچے درج کریں۔ آپ مکمل بلاک بھی براہ راست پیسٹ کر سکتے ہیں۔'
                    : 'Enter your S3-compatible credentials (such as Neon Object Storage, MinIO, or AWS S3). You can paste the credentials block directly.'}
                </p>
              </div>

              {/* Quick Paste Block Box */}
              <div className="bg-stone-900 text-stone-200 p-4 rounded-2xl border border-stone-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 font-urdu-sans flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isUrdu ? 'نیون S3 کریڈنشلز بلاک براہ راست پیسٹ کریں:' : 'Quick Paste Credentials Block:'}</span>
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">Neon.tech S3 Format</span>
                </div>

                <textarea
                  rows={4}
                  dir="ltr"
                  value={credentialsBlock}
                  onChange={(e) => setCredentialsBlock(e.target.value)}
                  placeholder={`AWS_ENDPOINT_URL_S3="https://...storage...aws.neon.tech"\nAWS_ACCESS_KEY_ID="nak_live_..."\nAWS_SECRET_ACCESS_KEY="nsk_live_..."\nAWS_REGION="us-east-2"`}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-emerald-400 placeholder:text-stone-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParseCredentialsBlock}
                    className="py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isUrdu ? 'فارم میں خودکار بھریں (Auto-Fill Form)' : 'Extract & Fill Form'}</span>
                  </button>
                </div>

                {credentialsNotice && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs font-urdu-sans flex items-center gap-2 ${
                      credentialsNotice.type === 'success'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                        : 'bg-rose-950/80 text-rose-300 border-rose-600'
                    }`}
                  >
                    {credentialsNotice.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    )}
                    <span>{credentialsNotice.message}</span>
                  </div>
                )}
              </div>

              {/* S3 Credentials Form */}
              <form onSubmit={handleSaveS3Config} className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3">
                {/* 1. Endpoint URL */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1 font-urdu-sans flex items-center justify-between">
                    <span>{isUrdu ? 'اینڈ پوائنٹ URL (AWS_ENDPOINT_URL_S3):' : 'S3 Endpoint URL (AWS_ENDPOINT_URL_S3):'}</span>
                    <span className="text-[10px] font-mono text-stone-400">Required</span>
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    placeholder="https://br-solitary-dream-aysdl8uh.storage.c-5.us-east-2.aws.neon.tech"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    required
                  />
                </div>

                {/* 2. Access Key ID */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1 font-urdu-sans flex items-center justify-between">
                    <span>{isUrdu ? 'ایکسس کی آئی ڈی (AWS_ACCESS_KEY_ID):' : 'Access Key ID (AWS_ACCESS_KEY_ID):'}</span>
                    <span className="text-[10px] font-mono text-stone-400">nak_live_...</span>
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    placeholder="nak_live_7e98911cde9a4bba8dbd3ee59c16c23c"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    required
                  />
                </div>

                {/* 3. Secret Access Key */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1 font-urdu-sans flex items-center justify-between">
                    <span>{isUrdu ? 'سیکریٹ ایکسس کی (AWS_SECRET_ACCESS_KEY):' : 'Secret Access Key (AWS_SECRET_ACCESS_KEY):'}</span>
                    <span className="text-[10px] font-mono text-stone-400">nsk_live_...</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSecretKey ? 'text' : 'password'}
                      dir="ltr"
                      value={secretAccessKey}
                      onChange={(e) => setSecretAccessKey(e.target.value)}
                      placeholder="nsk_live_8a85583b865c703a70e1125df78145c73b704f29ae21d2dd4349f244406c143b"
                      className="w-full px-3 py-2 pr-10 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                    >
                      {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 4. Region and Bucket */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1 font-urdu-sans">
                      {isUrdu ? 'ریجن (AWS_REGION):' : 'AWS Region:'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="us-east-2"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1 font-urdu-sans">
                      {isUrdu ? 'بکٹ کا نام (Bucket Name):' : 'Bucket Name:'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={bucketName}
                      onChange={(e) => setBucketName(e.target.value)}
                      placeholder="mandi-data"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 5. Optional Backend Proxy URL for standalone production/Capacitor builds */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1 font-urdu-sans flex items-center justify-between">
                    <span>{isUrdu ? 'پراکسی سرور URL (اختیاری):' : 'Backend Server / Proxy URL (Optional):'}</span>
                    <span className="text-[10px] text-stone-400 font-sans">خالی چھوڑیں اگر ایپ خود ہوسٹ ہے</span>
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={apiProxyUrl}
                    onChange={(e) => setApiProxyUrl(e.target.value)}
                    placeholder="https://your-app.com (خالی چھوڑیں اگر مقامی سرور چل رہا ہے)"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:ring-2 focus:ring-amber-600 focus:outline-none"
                  />
                  <p className="text-[10px] text-stone-500 mt-1 font-urdu-sans">
                    {isUrdu
                      ? 'نوٹ: پروڈکشن میں براہ راست S3 اپ لوڈ کیلئے بکٹ پر CORS خودکار ترتیب دیا جاتا ہے۔ اگر آپ الگ سرور استعمال کرتے ہیں تو پتہ یہاں درج کر سکتے ہیں۔'
                      : 'Note: S3 uploads work directly or via server proxy. Bucket CORS is auto-configured to allow seamless production builds.'}
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestS3}
                    disabled={isTestingS3 || !endpointUrl || !accessKeyId || !secretAccessKey}
                    className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm font-urdu-sans transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    {isTestingS3 ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isUrdu ? 'S3 کنکشن ٹیسٹ ہو رہا ہے...' : 'Testing S3 Connection...'}</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>{isUrdu ? 'S3 کنکشن ٹیسٹ کریں (Test Connection)' : 'Test S3 Connection'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    className="py-2.5 px-4 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-bold text-xs sm:text-sm font-urdu-sans transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isUrdu ? 'محفوظ کریں' : 'Save'}</span>
                  </button>
                </div>

                {saveNotice && (
                  <div className="p-2.5 rounded-xl border bg-emerald-50 text-emerald-900 border-emerald-300 text-xs font-urdu-sans flex items-center gap-2 animate-in fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-bold">{saveNotice}</span>
                  </div>
                )}
              </form>

              {/* S3 Test Result Banner */}
              {s3TestResult && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs font-urdu-sans animate-in fade-in duration-150 ${
                    s3TestResult.success
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                      : 'bg-red-50 text-red-950 border-red-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {s3TestResult.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold">{s3TestResult.message}</p>
                      {s3TestResult.bucketName && (
                        <p className="text-[11px] font-mono text-stone-600 truncate">
                          Bucket: {s3TestResult.bucketName} ({s3TestResult.storageEngine || 'Neon S3'})
                        </p>
                      )}
                      {s3TestResult.endpoint && (
                        <p className="text-[11px] font-mono text-emerald-800 truncate">
                          Endpoint: {s3TestResult.endpoint}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-stone-50 px-4 py-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500 font-urdu-sans flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">
              {isUrdu ? 'آف لائن IndexedDB + کلاؤڈ S3 آبجیکٹ اسٹوریج فعال ہے' : 'Offline-first IndexedDB + S3 Cloud Storage'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold transition cursor-pointer"
          >
            {isUrdu ? 'بند کریں' : 'Close'}
          </button>
        </div>
      </div>

      {/* Progressive Download Confirmation Modal - Zero browser alert/confirm */}
      {showDownloadConfirmModal && (
        <div
          dir="ltr"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-slate-700 text-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 font-sans">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <CloudDownload className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white">
                    Confirm Cloud Data Restore
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    S3 Object Storage Backup
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDownloadConfirmModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-4">
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">Shop ID:</span>
                  <span className="font-mono font-bold text-blue-400">{downloadShopId || config.shopCloudId}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-400">S3 Bucket:</span>
                  <span className="font-mono text-emerald-400">{bucketName || 'mandi-data'}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Action:</span>
                  <span className="text-amber-300 font-bold">Sync & Restore Data</span>
                </div>
              </div>

              <div className="bg-blue-950/40 border border-blue-800/40 p-3 rounded-2xl text-xs text-blue-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Safe restore: Data is transferred with progressive byte-level verification and automatic local snapshot safety before applying to the database.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDownloadConfirmModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDownload}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-900/30 active:scale-95"
                >
                  <CloudDownload className="w-4 h-4" />
                  <span>Start Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Progressive Sync Modal */}
      <SyncProgressModal
        isOpen={showProgressModal}
        progress={syncProgress}
        onClose={() => setShowProgressModal(false)}
        onRetry={() => {
          if (syncProgress?.direction === 'upload') {
            handleUpload();
          } else {
            executeDownload();
          }
        }}
      />
    </div>
  );
};
