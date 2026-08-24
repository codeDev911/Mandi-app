import { VendorLot, AppSettings, CustomerBuyer, SavedVendor } from '../types';
import { neon } from '@neondatabase/serverless';

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

/**
 * Sanitizes and normalizes a PostgreSQL connection URL
 * Handles accidental quotes, psql command wrappers, spaces, and ensures SSL query parameter for cloud providers.
 */
export function sanitizePostgresUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let clean = rawUrl.trim();

  // Strip wrapping single or double quotes
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }

  // Strip CLI command prefix e.g. 'psql "postgresql://..."'
  if (clean.toLowerCase().startsWith('psql ')) {
    clean = clean.slice(5).trim();
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1).trim();
    }
  }

  // Ensure protocol
  if (clean.startsWith('postgres://')) {
    clean = 'postgresql://' + clean.slice('postgres://'.length);
  }

  // Auto-append sslmode=require for Cloud databases if missing
  if (
    (clean.includes('.neon.tech') || clean.includes('.supabase.co') || clean.includes('.render.com')) &&
    !clean.includes('sslmode=')
  ) {
    clean += clean.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }

  return clean;
}

export function getStoredCloudConfig(): CloudSyncMetadata {
  try {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        shopCloudId: parsed.shopCloudId || 'MANDI-786',
        shopPin: parsed.shopPin || '1234',
        postgresUrl: sanitizePostgresUrl(parsed.postgresUrl || ''),
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
    const cleanedConfig = {
      ...config,
      postgresUrl: sanitizePostgresUrl(config.postgresUrl),
    };
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cleanedConfig));
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
 * Safe fetch helper that gracefully handles non-JSON server responses
 */
async function safeFetchJson<T = any>(
  url: string,
  options: RequestInit,
  endpointName: string
): Promise<{ ok: boolean; status: number; data?: T; errorText?: string }> {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

    const res = await fetch(url, {
      ...options,
      signal: controller ? controller.signal : undefined,
    });

    if (timeoutId) clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    if (!text || text.trim().startsWith('<!') || text.trim().startsWith('<html') || !contentType.includes('application/json')) {
      return {
        ok: false,
        status: res.status,
        errorText: `سرور سے درست جواب موصول نہیں ہوا۔ (${endpointName})`,
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
 * Multi-Strategy PostgreSQL Database Connection Tester
 * 1. Tries Backend API Route (/api/db/test via Node pg.Pool)
 * 2. If backend is unavailable or client is in standalone mode (Capacitor/PWA/Electron), uses official @neondatabase/serverless driver
 */
export async function testPostgresConnection(customUrl?: string): Promise<{
  success: boolean;
  message: string;
  serverTime?: string;
  version?: string;
}> {
  const cleanUrl = sanitizePostgresUrl(customUrl || getStoredCloudConfig().postgresUrl || '');
  if (!cleanUrl) {
    return {
      success: false,
      message: 'براہ کرم پہلے سیٹنگز یا کلاؤڈ سنک میں PostgreSQL ڈیٹا بیس کا URL درج کریں۔',
    };
  }

  // 1. Strategy A: Try Backend Server API first (Fast, reliable, bypasses browser CORS for all cloud DBs)
  try {
    const serverRes = await safeFetchJson<{
      success: boolean;
      message: string;
      serverTime?: string;
      version?: string;
    }>('/api/db/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionUrl: cleanUrl }),
    }, 'db/test');

    if (serverRes.ok && serverRes.data && serverRes.data.success) {
      return serverRes.data;
    }
  } catch (err) {
    console.warn('Backend /api/db/test attempt bypassed, trying direct Neon driver:', err);
  }

  // 2. Strategy B: Direct Client-Side Serverless Driver for Neon PostgreSQL
  if (isNeonPostgresUrl(cleanUrl)) {
    try {
      const sql = neon(cleanUrl);
      const rows = (await sql`SELECT NOW() as now, version() as version;`) as any[];

      if (rows && rows.length > 0) {
        // Auto-ensure schema exists
        await sql`
          CREATE TABLE IF NOT EXISTS mandi_sync_data (
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
          );
        `;

        return {
          success: true,
          message: 'Neon PostgreSQL (Direct Serverless) رابطہ کامیاب رہا! ڈیٹا بیس آن لائن اور تیار ہے۔',
          serverTime: String(rows[0]?.now || new Date().toISOString()),
          version: String(rows[0]?.version || 'PostgreSQL (Neon Serverless)'),
        };
      }
    } catch (neonErr: any) {
      console.error('Neon Direct Serverless Connection Error:', neonErr);
      return {
        success: false,
        message: `Neon کلاؤڈ رابطہ میں خرابی: ${neonErr?.message || 'پاس ورڈ یا ہوسٹ کی تصدیق کریں'} (براہ کرم کنکشن اسٹرنگ چیک کریں)`,
      };
    }
  }

  return {
    success: false,
    message: 'ڈیٹا بیس سے رابطہ ممکن نہیں ہو سکا۔ براہ کرم انٹرنیٹ اور کنکشن اسٹرنگ (یوزر، پاس ورڈ اور ہوسٹ) چیک کریں۔',
  };
}

/**
 * Uploads local offline data to PostgreSQL database
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

  const cleanPostgresUrl = sanitizePostgresUrl(config.postgresUrl || getStoredCloudConfig().postgresUrl || '');
  const cleanShopId = config.shopCloudId.trim().toUpperCase();
  const cleanPin = config.shopPin.trim();
  const clientDevice = typeof navigator !== 'undefined' ? navigator.userAgent : 'Client App';

  // 1. Try Backend Server API Route first
  try {
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
        connectionUrl: cleanPostgresUrl || undefined,
        payload: {
          settings: data.settings,
          lots: data.lots,
          customers: data.customers,
          vendors: data.vendors,
        },
      }),
    }, 'db/sync-upload');

    if (fetchResult.ok && fetchResult.data && fetchResult.data.success) {
      const json = fetchResult.data;
      const updatedConfig: CloudSyncMetadata = {
        ...config,
        postgresUrl: cleanPostgresUrl,
        lastUploadedAt: json.lastUploadedAt || timestamp,
        lastSyncedDevice: 'PostgreSQL Server API',
        totalSyncedLots: data.lots.length,
      };
      saveStoredCloudConfig(updatedConfig);
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
  } catch (serverErr) {
    console.warn('Backend upload API failed, trying direct Neon driver if applicable:', serverErr);
  }

  // 2. Direct Neon Serverless Upload for Standalone / Offline-ready Mode
  if (cleanPostgresUrl && isNeonPostgresUrl(cleanPostgresUrl)) {
    try {
      const sql = neon(cleanPostgresUrl);
      await sql`
        CREATE TABLE IF NOT EXISTS mandi_sync_data (
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
        );
      `;

      const payloadObj = {
        settings: data.settings,
        lots: data.lots,
        customers: data.customers,
        vendors: data.vendors,
      };

      const rows = (await sql`
        INSERT INTO mandi_sync_data (
          shop_id, shop_pin, payload, lots_count, customers_count, vendors_count, last_uploaded_at, client_device, updated_at
        ) VALUES (
          ${cleanShopId}, ${cleanPin}, ${payloadObj}, ${data.lots.length}, ${data.customers.length}, ${data.vendors.length}, NOW(), ${clientDevice}, NOW()
        )
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
      `) as any[];

      const uploadedTime = rows?.[0]?.last_uploaded_at ? String(rows[0].last_uploaded_at) : timestamp;
      const updatedConfig: CloudSyncMetadata = {
        ...config,
        postgresUrl: cleanPostgresUrl,
        lastUploadedAt: uploadedTime,
        lastSyncedDevice: 'Neon PostgreSQL (Direct Serverless)',
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
        dbEngine: 'Neon PostgreSQL (Direct Serverless)',
      };
    } catch (neonErr: any) {
      console.error('Neon Direct Serverless Upload Error:', neonErr);
    }
  }

  // 3. Fallback to Local Offline Backup Vault
  saveLocalBackupVault(config.shopCloudId, config.shopPin, data, timestamp);
  const updatedConfig: CloudSyncMetadata = {
    ...config,
    postgresUrl: cleanPostgresUrl,
    lastUploadedAt: timestamp,
    lastSyncedDevice: 'Local Offline Storage Backup',
    totalSyncedLots: data.lots.length,
  };
  saveStoredCloudConfig(updatedConfig);

  return {
    success: true,
    message: 'ڈیٹا لوکل والٹ میں محفوظ ہو گیا (نوٹ: ڈیٹا بیس کنکشن پر نظرثانی کریں)',
    timestamp,
    lastUploadedAt: timestamp,
    lastDownloadedAt: config.lastDownloadedAt,
    lotsCount: data.lots.length,
    customersCount: data.customers.length,
    vendorsCount: data.vendors.length,
  };
}

/**
 * Downloads data from PostgreSQL database
 */
export async function downloadDataFromCloud(
  shopCloudId: string,
  shopPin: string,
  postgresUrl?: string
): Promise<CloudSyncResult> {
  const timestamp = new Date().toISOString();
  const cleanShopId = shopCloudId.trim().toUpperCase();
  const cleanPin = shopPin.trim();
  const cleanPostgresUrl = sanitizePostgresUrl(postgresUrl || getStoredCloudConfig().postgresUrl || '');

  if (!cleanShopId) {
    return {
      success: false,
      message: 'دکان کا کلاؤڈ شناختی کوڈ (Shop Cloud ID) درج کریں۔',
      timestamp,
    };
  }

  // 1. Try Backend Server API Route
  try {
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
        connectionUrl: cleanPostgresUrl || undefined,
      }),
    }, 'db/sync-download');

    if (fetchResult.ok && fetchResult.data && fetchResult.data.success) {
      const json = fetchResult.data;
      const currentConfig = getStoredCloudConfig();
      const updatedConfig: CloudSyncMetadata = {
        ...currentConfig,
        shopCloudId: cleanShopId,
        shopPin: cleanPin,
        postgresUrl: cleanPostgresUrl || currentConfig.postgresUrl,
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
  } catch (serverErr) {
    console.warn('Backend download API failed, trying direct Neon driver:', serverErr);
  }

  // 2. Direct Neon Serverless Download
  if (cleanPostgresUrl && isNeonPostgresUrl(cleanPostgresUrl)) {
    try {
      const sql = neon(cleanPostgresUrl);
      const rows = (await sql`
        SELECT shop_id, shop_pin, payload, lots_count, customers_count, vendors_count, last_uploaded_at, last_downloaded_at
        FROM mandi_sync_data
        WHERE shop_id = ${cleanShopId};
      `) as any[];

      if (rows && rows.length > 0) {
        const row = rows[0];

        // PIN Verification
        if (row.shop_pin && cleanPin && String(row.shop_pin).trim() !== cleanPin) {
          return {
            success: false,
            message: 'غلط پن کوڈ (Invalid PIN)! اس دکان کا پن درست درج کریں۔',
            timestamp,
          };
        }

        // Update download timestamp
        await sql`UPDATE mandi_sync_data SET last_downloaded_at = NOW() WHERE shop_id = ${cleanShopId};`;

        const currentConfig = getStoredCloudConfig();
        const updatedConfig: CloudSyncMetadata = {
          ...currentConfig,
          shopCloudId: cleanShopId,
          shopPin: cleanPin,
          postgresUrl: cleanPostgresUrl,
          lastDownloadedAt: timestamp,
          lastUploadedAt: row.last_uploaded_at ? String(row.last_uploaded_at) : currentConfig.lastUploadedAt,
        };
        saveStoredCloudConfig(updatedConfig);

        return {
          success: true,
          message: 'Neon PostgreSQL سے تمام ریکارڈز کامیابی سے ڈاؤن لوڈ ہو گئے!',
          timestamp,
          lastUploadedAt: row.last_uploaded_at ? String(row.last_uploaded_at) : undefined,
          lastDownloadedAt: timestamp,
          lotsCount: row.lots_count || row.payload?.lots?.length || 0,
          customersCount: row.customers_count || row.payload?.customers?.length || 0,
          vendorsCount: row.vendors_count || row.payload?.vendors?.length || 0,
          data: row.payload,
          dbEngine: 'Neon PostgreSQL (Direct Serverless)',
        };
      }
    } catch (neonErr: any) {
      console.error('Neon Direct Serverless Download Error:', neonErr);
    }
  }

  // 3. Fallback to Local Backup Vault
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
      message: 'لوکل بیک اپ والٹ سے ڈیٹا بحال ہو گیا ہے۔',
      timestamp,
      lastUploadedAt: localData.updatedAt,
      lastDownloadedAt: timestamp,
      lotsCount: localData.data?.lots?.length || 0,
      customersCount: localData.data?.customers?.length || 0,
      vendorsCount: localData.data?.vendors?.length || 0,
      data: localData.data,
      dbEngine: 'Local Backup Vault',
    };
  }

  return {
    success: false,
    message: `دکان شناختی کوڈ (${cleanShopId}) کا کوئی ریکارڈ کلاؤڈ پر نہیں ملا۔ پہلے اسی شناختی کوڈ سے ڈیٹا اپ لوڈ کریں۔`,
    timestamp,
  };
}

/**
 * Local offline snapshot cache vault
 */
function saveLocalBackupVault(
  shopId: string,
  pin: string,
  data: any,
  updatedAt: string
): void {
  try {
    const key = `${LOCAL_VAULT_PREFIX}${shopId.trim().toUpperCase()}`;
    const payload = {
      shopId,
      pin,
      updatedAt,
      data,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save local backup vault:', e);
  }
}

function getLocalBackupVault(
  shopId: string,
  pin: string
): { updatedAt: string; data: any } | null {
  try {
    const key = `${LOCAL_VAULT_PREFIX}${shopId.trim().toUpperCase()}`;
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed.pin && pin && parsed.pin.trim() !== pin.trim()) {
      return null;
    }
    return {
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      data: parsed.data,
    };
  } catch {
    return null;
  }
}
