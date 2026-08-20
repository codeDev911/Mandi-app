import { VendorLot, AppSettings, CustomerBuyer, SavedVendor } from '../types';

export interface CloudSyncMetadata {
  shopCloudId: string;
  shopPin: string;
  postgresUrl?: string; // Custom PostgreSQL connection URL e.g. postgresql://user:pass@host:5432/dbname
  autoSync?: boolean;
  lastUploadedAt?: string; // ISO String
  lastDownloadedAt?: string; // ISO String
  lastSyncedDevice?: string;
  totalSyncedLots?: number;
  totalSyncedSales?: number;
}

export interface CloudSyncResult {
  success: boolean;
  message: string;
  timestamp: string;
  lastUploadedAt?: string;
  lastDownloadedAt?: string;
  lotsCount?: number;
  customersCount?: number;
  vendorsCount?: number;
  dbEngine?: string;
  data?: {
    settings?: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
  };
}

const CLOUD_CONFIG_KEY = 'mandi_postgres_sync_config_v3';
const LOCAL_VAULT_PREFIX = 'mandi_cloud_server_vault_';

export function getStoredCloudConfig(): CloudSyncMetadata {
  try {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        shopCloudId: parsed.shopCloudId || 'MANDI-786',
        shopPin: parsed.shopPin || '1234',
        postgresUrl: parsed.postgresUrl || '',
        autoSync: parsed.autoSync || false,
        lastUploadedAt: parsed.lastUploadedAt || undefined,
        lastDownloadedAt: parsed.lastDownloadedAt || undefined,
        lastSyncedDevice: parsed.lastSyncedDevice,
        totalSyncedLots: parsed.totalSyncedLots,
      };
    }
  } catch {
    // ignore
  }
  return {
    shopCloudId: 'MANDI-786',
    shopPin: '1234',
    postgresUrl: '',
    autoSync: false,
    lastUploadedAt: undefined,
    lastDownloadedAt: undefined,
  };
}

export function saveStoredCloudConfig(config: CloudSyncMetadata): void {
  try {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Format timestamp nicely for Urdu & English with Date & Time
 */
export function formatSyncDateTime(isoString?: string | null, isUrdu = false): string {
  if (!isoString) {
    return isUrdu ? 'ابھی تک نہیں ہوا (Never)' : 'Never';
  }

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const day = date.getDate();
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsUr = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
    const month = isUrdu ? monthsUr[date.getMonth()] : monthsEn[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? (isUrdu ? 'شام' : 'PM') : (isUrdu ? 'صبح' : 'AM');
    hours = hours % 12 || 12;

    if (isUrdu) {
      return `${day} ${month} ${year}، ${hours}:${minutes} ${ampm}`;
    }
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return String(isoString);
  }
}

/**
 * Test PostgreSQL Database connection via server endpoint
 */
export async function testPostgresConnection(customUrl?: string): Promise<{
  success: boolean;
  message: string;
  serverTime?: string;
  version?: string;
}> {
  try {
    const res = await fetch('/api/db/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionUrl: customUrl?.trim() || undefined }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: `سرور یا نیٹ ورک سے رابطہ نہیں ہو سکا: ${err?.message || 'Server Offline'}`,
    };
  }
}

/**
 * Uploads local offline data to PostgreSQL database via backend API
 */
export async function uploadDataToCloud(
  config: CloudSyncMetadata,
  data: {
    settings: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
  }
): Promise<CloudSyncResult> {
  const timestamp = new Date().toISOString();

  if (!config.shopCloudId.trim()) {
    return {
      success: false,
      message: 'دکان کا کلاؤڈ آئی ڈی (Shop Cloud ID) درج کرنا لازمی ہے۔',
      timestamp,
    };
  }

  try {
    // 1. Try server PostgreSQL sync endpoint first
    const res = await fetch('/api/db/sync-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: config.shopCloudId.trim().toUpperCase(),
        pin: config.shopPin.trim(),
        connectionUrl: config.postgresUrl?.trim() || undefined,
        payload: {
          settings: data.settings,
          lots: data.lots,
          customers: data.customers,
          vendors: data.vendors,
        },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const updatedConfig: CloudSyncMetadata = {
        ...config,
        lastUploadedAt: json.lastUploadedAt || timestamp,
        lastSyncedDevice: 'PostgreSQL Cloud Database Sync',
        totalSyncedLots: data.lots.length,
      };
      saveStoredCloudConfig(updatedConfig);

      // Also backup locally as offline snapshot
      saveLocalBackupVault(config.shopCloudId, config.shopPin, data, timestamp);

      return {
        success: true,
        message: 'ڈیٹا کامیابی سے PostgreSQL ڈیٹا بیس پر اپ لوڈ ہو گیا ہے!',
        timestamp,
        lastUploadedAt: json.lastUploadedAt || timestamp,
        lastDownloadedAt: config.lastDownloadedAt,
        lotsCount: data.lots.length,
        customersCount: data.customers.length,
        vendorsCount: data.vendors.length,
        dbEngine: 'PostgreSQL',
      };
    }

    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.message || `Server returned ${res.status}`);
  } catch (serverErr: any) {
    console.warn('Server PostgreSQL upload failed, storing offline vault backup:', serverErr);

    // Offline Local Vault fallback
    saveLocalBackupVault(config.shopCloudId, config.shopPin, data, timestamp);

    const updatedConfig: CloudSyncMetadata = {
      ...config,
      lastUploadedAt: timestamp,
      lastSyncedDevice: 'Local Offline Storage Backup',
      totalSyncedLots: data.lots.length,
    };
    saveStoredCloudConfig(updatedConfig);

    return {
      success: true,
      message: `ڈیٹا لوکل والٹ میں بیک اپ ہو گیا (PostgreSQL نوٹ: ${serverErr?.message || 'آف لائن موڈ'})`,
      timestamp,
      lastUploadedAt: timestamp,
      lastDownloadedAt: config.lastDownloadedAt,
      lotsCount: data.lots.length,
      customersCount: data.customers.length,
      vendorsCount: data.vendors.length,
    };
  }
}

/**
 * Downloads data from PostgreSQL database via backend API
 */
export async function downloadDataFromCloud(
  shopCloudId: string,
  shopPin: string,
  postgresUrl?: string
): Promise<CloudSyncResult> {
  const timestamp = new Date().toISOString();
  const cleanShopId = shopCloudId.trim().toUpperCase();
  const cleanPin = shopPin.trim();

  if (!cleanShopId) {
    return {
      success: false,
      message: 'دکان کا کلاؤڈ شناختی کوڈ (Shop Cloud ID) درج کریں۔',
      timestamp,
    };
  }

  try {
    // 1. Try server PostgreSQL sync endpoint first
    const res = await fetch('/api/db/sync-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: cleanShopId,
        pin: cleanPin,
        connectionUrl: postgresUrl?.trim() || undefined,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const currentConfig = getStoredCloudConfig();
      const updatedConfig: CloudSyncMetadata = {
        ...currentConfig,
        shopCloudId: cleanShopId,
        shopPin: cleanPin,
        postgresUrl: postgresUrl || currentConfig.postgresUrl,
        lastDownloadedAt: json.lastDownloadedAt || timestamp,
        lastUploadedAt: json.lastUploadedAt || currentConfig.lastUploadedAt,
      };
      saveStoredCloudConfig(updatedConfig);

      return {
        success: true,
        message: 'PostgreSQL ڈیٹا بیس سے تازہ ترین ریکارڈز کامیابی سے ڈاؤن لوڈ ہو گئے!',
        timestamp,
        lastUploadedAt: json.lastUploadedAt,
        lastDownloadedAt: json.lastDownloadedAt || timestamp,
        lotsCount: json.lotsCount || json.data?.lots?.length || 0,
        customersCount: json.customersCount || json.data?.customers?.length || 0,
        vendorsCount: json.vendorsCount || json.data?.vendors?.length || 0,
        data: json.data,
        dbEngine: 'PostgreSQL',
      };
    }

    const errJson = await res.json().catch(() => null);
    if (res.status === 404 || res.status === 401) {
      return {
        success: false,
        message: errJson?.message || 'کوئی ریکارڈ نہیں ملا یا غلط پن کوڈ درج کیا گیا ہے۔',
        timestamp,
      };
    }
    throw new Error(errJson?.message || `Server returned ${res.status}`);
  } catch (serverErr: any) {
    console.warn('Server PostgreSQL download failed, checking offline vault:', serverErr);

    // Fallback to local storage vault if available
    const localData = getLocalBackupVault(cleanShopId, cleanPin);
    if (localData) {
      const currentConfig = getStoredCloudConfig();
      const updatedConfig: CloudSyncMetadata = {
        ...currentConfig,
        shopCloudId: cleanShopId,
        shopPin: cleanPin,
        lastDownloadedAt: timestamp,
      };
      saveStoredCloudConfig(updatedConfig);

      return {
        success: true,
        message: 'لوکل بیک اپ سے ڈیٹا بحال ہو گیا ہے۔',
        timestamp,
        lastUploadedAt: localData.updatedAt,
        lastDownloadedAt: timestamp,
        lotsCount: localData.payload.lots?.length || 0,
        customersCount: localData.payload.customers?.length || 0,
        vendorsCount: localData.payload.vendors?.length || 0,
        data: localData.payload,
      };
    }

    return {
      success: false,
      message: `ڈیٹا حاصل نہیں ہو سکا: ${serverErr?.message || 'سرور سے رابطہ ناکام رہا'}`,
      timestamp,
    };
  }
}

function saveLocalBackupVault(
  shopId: string,
  pin: string,
  payload: { settings: AppSettings; lots: VendorLot[]; customers: CustomerBuyer[]; vendors: SavedVendor[] },
  updatedAt: string
) {
  try {
    const key = `${LOCAL_VAULT_PREFIX}${shopId.toUpperCase()}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        shopId: shopId.toUpperCase(),
        pin,
        updatedAt,
        payload,
      })
    );
  } catch {
    // ignore
  }
}

function getLocalBackupVault(shopId: string, pin: string) {
  try {
    const key = `${LOCAL_VAULT_PREFIX}${shopId.toUpperCase()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.pin && pin && parsed.pin !== pin) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
