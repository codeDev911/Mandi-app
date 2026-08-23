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
 * Detects if a connection string belongs to Neon PostgreSQL (*.neon.tech)
 */
export function isNeonPostgresUrl(url?: string): boolean {
  if (!url) return false;
  return url.toLowerCase().includes('.neon.tech');
}

/**
 * Extracts host from a PostgreSQL connection string
 * e.g. postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
 */
export function extractNeonHost(connectionString: string): string | null {
  try {
    const clean = connectionString.trim();
    const atIndex = clean.indexOf('@');
    if (atIndex === -1) return null;
    const afterAt = clean.slice(atIndex + 1);
    const slashIndex = afterAt.indexOf('/');
    const hostPort = slashIndex !== -1 ? afterAt.slice(0, slashIndex) : afterAt;
    const host = hostPort.split(':')[0];
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Executes direct Serverless SQL query on Neon via Neon's official HTTPS /sql endpoint
 * This works natively in all browsers, mobile webviews, and Capacitor APKs without requiring a Node.js server.
 */
export async function executeNeonHttpQuery<T = any>(
  connectionString: string,
  query: string,
  params: any[] = []
): Promise<{ ok: boolean; rows?: T[]; error?: string; rowCount?: number }> {
  const host = extractNeonHost(connectionString);
  if (!host) {
    return { ok: false, error: 'Invalid Neon host in connection string' };
  }

  const endpoint = `https://${host}/sql`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': connectionString.trim(),
      },
      body: JSON.stringify({
        query,
        params,
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        ok: false,
        error: data.error || data.message || `Neon HTTP Error (${res.status})`,
      };
    }

    return {
      ok: true,
      rows: data.rows || [],
      rowCount: data.rowCount ?? data.rows?.length ?? 0,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Neon HTTPS direct connection failed',
    };
  }
}

async function safeFetchJson<T = any>(
  url: string,
  options: RequestInit,
  endpointName: string
): Promise<{ ok: boolean; status: number; data?: T; errorText?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (!text || text.trim().startsWith('<!') || text.trim().startsWith('<html') || !contentType.includes('application/json')) {
      return {
        ok: false,
        status: res.status,
        errorText: `سرور سے درست JSON جواب موصول نہیں ہوا۔ (موبائل / براؤزر میں API سرور بند ہے یا لوکل موڈ میں چل رہا ہے)`,
      };
    }

    try {
      const data = JSON.parse(text);
      return {
        ok: res.ok,
        status: res.status,
        data,
        errorText: !res.ok ? data?.message || `Server returned ${res.status}` : undefined,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        errorText: `سرور کا جواب درست JSON فارمیٹ میں نہیں تھا`,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      errorText: err?.message || 'نیٹ ورک رابطہ ممکن نہیں ہو سکا',
    };
  }
}

/**
 * Test PostgreSQL Database connection via Direct Neon HTTPS or server endpoint
 */
export async function testPostgresConnection(customUrl?: string): Promise<{
  success: boolean;
  message: string;
  serverTime?: string;
  version?: string;
}> {
  const cleanUrl = (customUrl || getStoredCloudConfig().postgresUrl || '').trim();
  if (!cleanUrl) {
    return {
      success: false,
      message: 'براہ کرم پہلے سیٹنگز یا کلاؤڈ سنک میں PostgreSQL ڈیٹا بیس کا URL درج کریں۔',
    };
  }

  // 1. If Neon PostgreSQL, test via direct Serverless HTTPS API first
  if (isNeonPostgresUrl(cleanUrl)) {
    const neonRes = await executeNeonHttpQuery<{ now: string; version: string }>(
      cleanUrl,
      'SELECT NOW() as now, version() as version;'
    );

    if (neonRes.ok && neonRes.rows && neonRes.rows.length > 0) {
      // Auto-ensure schema exists
      await executeNeonHttpQuery(
        cleanUrl,
        `CREATE TABLE IF NOT EXISTS mandi_sync_data (
          shop_id VARCHAR(100) PRIMARY KEY,
          shop_pin VARCHAR(50),
          payload JSONB NOT NULL,
          lots_count INT DEFAULT 0,
          customers_count INT DEFAULT 0,
          vendors_count INT DEFAULT 0,
          last_uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_downloaded_at TIMESTAMP WITH TIME ZONE,
          client_device TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`
      );

      return {
        success: true,
        message: 'Neon PostgreSQL (Direct Serverless HTTPS) رابطہ کامیاب رہا! ڈیٹا بیس آن لائن اور تیار ہے۔',
        serverTime: neonRes.rows[0].now,
        version: neonRes.rows[0].version,
      };
    }
  }

  // 2. Fallback to Server API route
  const result = await safeFetchJson<{
    success: boolean;
    message: string;
    serverTime?: string;
    version?: string;
  }>('/api/db/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionUrl: cleanUrl }),
  }, 'db/test');

  if (result.ok && result.data) {
    return result.data;
  }

  return {
    success: false,
    message: result.errorText || 'PostgreSQL کنکشن ٹیسٹ ناکام رہا۔ براہ کرم ڈیٹا بیس کا URL چیک کریں۔',
  };
}

/**
 * Uploads local offline data to PostgreSQL database via Direct Neon HTTPS or backend API
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

  const cleanPostgresUrl = config.postgresUrl?.trim() || getStoredCloudConfig().postgresUrl?.trim() || undefined;
  const cleanShopId = config.shopCloudId.trim().toUpperCase();
  const cleanPin = config.shopPin.trim();
  const clientDevice = typeof navigator !== 'undefined' ? navigator.userAgent : 'Client App';

  // 1. If Neon PostgreSQL is used, execute direct Serverless HTTPS upsert
  if (cleanPostgresUrl && isNeonPostgresUrl(cleanPostgresUrl)) {
    try {
      // Ensure table
      await executeNeonHttpQuery(
        cleanPostgresUrl,
        `CREATE TABLE IF NOT EXISTS mandi_sync_data (
          shop_id VARCHAR(100) PRIMARY KEY,
          shop_pin VARCHAR(50),
          payload JSONB NOT NULL,
          lots_count INT DEFAULT 0,
          customers_count INT DEFAULT 0,
          vendors_count INT DEFAULT 0,
          last_uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_downloaded_at TIMESTAMP WITH TIME ZONE,
          client_device TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );`
      );

      const payloadJson = JSON.stringify({
        settings: data.settings,
        lots: data.lots,
        customers: data.customers,
        vendors: data.vendors,
      });

      const upsertSql = `
        INSERT INTO mandi_sync_data (
          shop_id, shop_pin, payload, lots_count, customers_count, vendors_count, last_uploaded_at, client_device, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, NOW())
        ON CONFLICT (shop_id) DO UPDATE SET
          shop_pin = EXCLUDED.shop_pin,
          payload = EXCLUDED.payload,
          lots_count = EXCLUDED.lots_count,
          customers_count = EXCLUDED.customers_count,
          vendors_count = EXCLUDED.vendors_count,
          last_uploaded_at = NOW(),
          client_device = EXCLUDED.client_device,
          updated_at = NOW()
        RETURNING last_uploaded_at;
      `;

      const neonRes = await executeNeonHttpQuery<{ last_uploaded_at: string }>(
        cleanPostgresUrl,
        upsertSql,
        [cleanShopId, cleanPin, payloadJson, data.lots.length, data.customers.length, data.vendors.length, clientDevice]
      );

      if (neonRes.ok) {
        const uploadedTime = neonRes.rows?.[0]?.last_uploaded_at || timestamp;
        const updatedConfig: CloudSyncMetadata = {
          ...config,
          lastUploadedAt: uploadedTime,
          lastSyncedDevice: 'Neon PostgreSQL (Direct HTTPS)',
          totalSyncedLots: data.lots.length,
        };
        saveStoredCloudConfig(updatedConfig);
        saveLocalBackupVault(config.shopCloudId, config.shopPin, data, uploadedTime);

        return {
          success: true,
          message: 'ڈیٹا کامیابی سے Neon PostgreSQL کلاؤڈ پر محفوظ ہو گیا ہے!',
          timestamp,
          lastUploadedAt: uploadedTime,
          lastDownloadedAt: config.lastDownloadedAt,
          lotsCount: data.lots.length,
          customersCount: data.customers.length,
          vendorsCount: data.vendors.length,
          dbEngine: 'Neon PostgreSQL',
        };
      }
    } catch (neonErr) {
      console.warn('Neon direct HTTPS upload failed, attempting fallback:', neonErr);
    }
  }

  try {
    // 2. Try server PostgreSQL sync endpoint
    const fetchResult = await safeFetchJson<{
      success: boolean;
      message?: string;
      lastUploadedAt?: string;
    }>('/api/db/sync-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: cleanShopId,
        pin: cleanPin,
        connectionUrl: cleanPostgresUrl,
        payload: {
          settings: data.settings,
          lots: data.lots,
          customers: data.customers,
          vendors: data.vendors,
        },
      }),
    }, 'db/sync-upload');

    if (fetchResult.ok && fetchResult.data) {
      const json = fetchResult.data;
      const updatedConfig: CloudSyncMetadata = {
        ...config,
        lastUploadedAt: json.lastUploadedAt || timestamp,
        lastSyncedDevice: 'PostgreSQL Server API',
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

    throw new Error(fetchResult.errorText || 'سرور سے رابطہ ناکام رہا');
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
      message: `ڈیٹا لوکل والٹ میں محفوظ ہو گیا (PostgreSQL نوٹ: ${serverErr?.message || 'آف لائن موڈ'})`,
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
 * Downloads data from PostgreSQL database via Direct Neon HTTPS or backend API
 */
export async function downloadDataFromCloud(
  shopCloudId: string,
  shopPin: string,
  postgresUrl?: string
): Promise<CloudSyncResult> {
  const timestamp = new Date().toISOString();
  const cleanShopId = shopCloudId.trim().toUpperCase();
  const cleanPin = shopPin.trim();
  const cleanPostgresUrl = (postgresUrl || getStoredCloudConfig().postgresUrl || '').trim() || undefined;

  if (!cleanShopId) {
    return {
      success: false,
      message: 'دکان کا کلاؤڈ شناختی کوڈ (Shop Cloud ID) درج کریں۔',
      timestamp,
    };
  }

  // 1. If Neon PostgreSQL is used, execute direct Serverless HTTPS download
  if (cleanPostgresUrl && isNeonPostgresUrl(cleanPostgresUrl)) {
    try {
      const selectSql = `
        SELECT shop_id, shop_pin, payload, lots_count, customers_count, vendors_count, last_uploaded_at, last_downloaded_at
        FROM mandi_sync_data
        WHERE shop_id = $1;
      `;

      const neonRes = await executeNeonHttpQuery<{
        shop_id: string;
        shop_pin?: string;
        payload: any;
        lots_count: number;
        customers_count: number;
        vendors_count: number;
        last_uploaded_at: string;
        last_downloaded_at?: string;
      }>(cleanPostgresUrl, selectSql, [cleanShopId]);

      if (neonRes.ok && neonRes.rows && neonRes.rows.length > 0) {
        const row = neonRes.rows[0];

        // PIN Verification
        if (row.shop_pin && cleanPin && row.shop_pin !== cleanPin) {
          return {
            success: false,
            message: 'غلط پن کوڈ (Invalid PIN)! اس دکان کا پن درست درج کریں۔',
            timestamp,
          };
        }

        // Update download timestamp
        await executeNeonHttpQuery(
          cleanPostgresUrl,
          'UPDATE mandi_sync_data SET last_downloaded_at = NOW() WHERE shop_id = $1;',
          [cleanShopId]
        );

        const currentConfig = getStoredCloudConfig();
        const updatedConfig: CloudSyncMetadata = {
          ...currentConfig,
          shopCloudId: cleanShopId,
          shopPin: cleanPin,
          postgresUrl: postgresUrl || currentConfig.postgresUrl,
          lastDownloadedAt: timestamp,
          lastUploadedAt: row.last_uploaded_at || currentConfig.lastUploadedAt,
        };
        saveStoredCloudConfig(updatedConfig);

        return {
          success: true,
          message: 'Neon PostgreSQL سے تمام ریکارڈز کامیابی سے ڈاؤن لوڈ ہو گئے!',
          timestamp,
          lastUploadedAt: row.last_uploaded_at,
          lastDownloadedAt: timestamp,
          lotsCount: row.lots_count || row.payload?.lots?.length || 0,
          customersCount: row.customers_count || row.payload?.customers?.length || 0,
          vendorsCount: row.vendors_count || row.payload?.vendors?.length || 0,
          data: row.payload,
          dbEngine: 'Neon PostgreSQL (Direct HTTPS)',
        };
      }
    } catch (neonErr) {
      console.warn('Neon direct HTTPS download failed, attempting API fallback:', neonErr);
    }
  }

  try {
    // 2. Try server PostgreSQL sync endpoint
    const fetchResult = await safeFetchJson<{
      success: boolean;
      message?: string;
      lastUploadedAt?: string;
      lastDownloadedAt?: string;
      lotsCount?: number;
      customersCount?: number;
      vendorsCount?: number;
      data?: any;
    }>('/api/db/sync-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: cleanShopId,
        pin: cleanPin,
        connectionUrl: cleanPostgresUrl,
      }),
    }, 'db/sync-download');

    if (fetchResult.ok && fetchResult.data) {
      const json = fetchResult.data;
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

    if (fetchResult.status === 404 || fetchResult.status === 401) {
      return {
        success: false,
        message: fetchResult.errorText || 'کوئی ریکارڈ نہیں ملا یا غلط پن کوڈ درج کیا گیا ہے۔',
        timestamp,
      };
    }

    throw new Error(fetchResult.errorText || 'سرور سے رابطہ ناکام رہا');
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
