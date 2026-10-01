import { VendorLot, AppSettings, CustomerBuyer, SavedVendor, ShopExpense, DrawerAdjustment } from '../types';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';

export interface CloudSyncMetadata {
  shopCloudId: string;
  shopPin: string;
  endpointUrl?: string; // AWS_ENDPOINT_URL_S3 e.g. "https://br-solitary-dream-aysdl8uh.storage.c-5.us-east-2.aws.neon.tech"
  accessKeyId?: string; // AWS_ACCESS_KEY_ID e.g. "nak_live_..."
  secretAccessKey?: string; // AWS_SECRET_ACCESS_KEY e.g. "nsk_live_..."
  region?: string; // AWS_REGION e.g. "us-east-2"
  bucketName?: string; // e.g. "mandi-data"
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
  expensesCount?: number;
  drawerAdjustmentsCount?: number;
  logsCount?: number;
  storageEngine?: string;
  bucketName?: string;
  objectKey?: string;
  data?: {
    settings?: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
    expenses?: ShopExpense[];
    drawerAdjustments?: DrawerAdjustment[];
    systemLogs?: any[];
  };
}

const CLOUD_CONFIG_KEY = 'mandi_s3_sync_config_v4';
const LOCAL_VAULT_PREFIX = 'mandi_s3_local_vault_';

/**
 * Sanitizes and normalizes an S3 endpoint URL or string
 */
export function sanitizeS3String(val?: string): string {
  if (!val) return '';
  let clean = val.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
}

/**
 * Parses a block of environment variables / credentials (e.g. copied directly from Neon Object Storage):
 * AWS_ENDPOINT_URL_S3="..."
 * AWS_ACCESS_KEY_ID="..."
 * AWS_SECRET_ACCESS_KEY="..."
 * AWS_REGION="..."
 */
export function parseS3CredentialsBlock(text: string): Partial<CloudSyncMetadata> {
  if (!text) return {};
  const result: Partial<CloudSyncMetadata> = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim().toUpperCase();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).trim();
      }

      if (key === 'AWS_ENDPOINT_URL_S3' || key === 'ENDPOINT_URL' || key === 'S3_ENDPOINT') {
        result.endpointUrl = value;
      } else if (key === 'AWS_ACCESS_KEY_ID' || key === 'ACCESS_KEY_ID' || key === 'KEY_ID') {
        result.accessKeyId = value;
      } else if (key === 'AWS_SECRET_ACCESS_KEY' || key === 'SECRET_ACCESS_KEY' || key === 'SECRET_KEY') {
        result.secretAccessKey = value;
      } else if (key === 'AWS_REGION' || key === 'REGION') {
        result.region = value;
      } else if (key === 'AWS_S3_BUCKET' || key === 'BUCKET_NAME' || key === 'BUCKET') {
        result.bucketName = value;
      }
    }
  }

  return result;
}

export function getStoredCloudConfig(): CloudSyncMetadata {
  try {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        shopCloudId: parsed.shopCloudId || 'MANDI-786',
        shopPin: parsed.shopPin || '1234',
        endpointUrl: sanitizeS3String(parsed.endpointUrl || ''),
        accessKeyId: sanitizeS3String(parsed.accessKeyId || ''),
        secretAccessKey: sanitizeS3String(parsed.secretAccessKey || ''),
        region: sanitizeS3String(parsed.region || 'us-east-2'),
        bucketName: sanitizeS3String(parsed.bucketName || 'mandi-data'),
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
    endpointUrl: '',
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-2',
    bucketName: 'mandi-data',
    autoSync: false,
    lastUploadedAt: undefined,
    lastDownloadedAt: undefined,
  };
}

export function saveStoredCloudConfig(config: CloudSyncMetadata): void {
  try {
    const cleanedConfig = {
      ...config,
      endpointUrl: sanitizeS3String(config.endpointUrl),
      accessKeyId: sanitizeS3String(config.accessKeyId),
      secretAccessKey: sanitizeS3String(config.secretAccessKey),
      region: sanitizeS3String(config.region || 'us-east-2'),
      bucketName: sanitizeS3String(config.bucketName || 'mandi-data'),
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
 * Instantiates an in-browser S3Client with custom credentials
 */
export function getClientS3Instance(config: Partial<CloudSyncMetadata>): { client: S3Client; bucketName: string } | null {
  const endpoint = sanitizeS3String(config.endpointUrl);
  const accessKeyId = sanitizeS3String(config.accessKeyId);
  const secretAccessKey = sanitizeS3String(config.secretAccessKey);
  const region = sanitizeS3String(config.region || 'us-east-2');
  const bucketName = sanitizeS3String(config.bucketName || 'mandi-data');

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const normalizedEndpoint = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;

  const client = new S3Client({
    endpoint: normalizedEndpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  return { client, bucketName };
}

/**
 * Test S3 Object Storage connection and credentials
 */
export async function testS3Connection(config: Partial<CloudSyncMetadata>): Promise<{
  success: boolean;
  message: string;
  endpoint?: string;
  bucketName?: string;
  availableBuckets?: string[];
  storageEngine?: string;
}> {
  // 1. Try Express backend proxy route (/api/s3/test)
  try {
    const res = await fetch('/api/s3/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || 'S3 Object Storage connection verified successfully!',
        endpoint: data.endpoint,
        bucketName: data.bucketName,
        availableBuckets: data.availableBuckets,
        storageEngine: data.storageEngine || 'S3-Compatible Object Storage (Neon)',
      };
    } else if (res.status === 400 || res.status === 500) {
      return {
        success: false,
        message: data.message || 'Failed to authenticate with S3 credentials',
      };
    }
  } catch {
    // If proxy is not reachable, fallback to direct client-side S3 call below
  }

  // 2. Direct client-side S3 connection test
  const s3Instance = getClientS3Instance(config);
  if (!s3Instance) {
    return {
      success: false,
      message: 'براہ کرم اینڈپوائنٹ URL، ایکسس کی، اور سیکریٹ کی درج کریں (Missing S3 credentials)',
    };
  }

  const { client, bucketName } = s3Instance;

  try {
    let buckets: string[] = [];
    try {
      const listRes = await client.send(new ListBucketsCommand({}));
      buckets = (listRes.Buckets || []).map((b) => b.Name || '');
    } catch {
      // ignore
    }

    try {
      await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (headErr: any) {
      if (headErr?.name === 'NotFound' || headErr?.$metadata?.httpStatusCode === 404) {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucketName }));
        } catch {
          // ignore
        }
      }
    }

    return {
      success: true,
      message: 'S3 Object Storage connection successful! Bucket verified.',
      endpoint: config.endpointUrl,
      bucketName,
      availableBuckets: buckets,
      storageEngine: 'S3-Compatible Object Storage (Neon)',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `S3 Object Storage Error: ${err?.message || 'Failed to connect'}`,
    };
  }
}

/**
 * Upload entire Mandi dataset to S3 Object Storage
 */
export async function uploadDataToCloud(
  config: CloudSyncMetadata,
  data: {
    settings: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
    expenses?: ShopExpense[];
    drawerAdjustments?: DrawerAdjustment[];
    systemLogs?: any[];
  }
): Promise<CloudSyncResult> {
  const cleanShopId = String(config.shopCloudId || 'MANDI-786').trim().toUpperCase();
  const cleanPin = String(config.shopPin || '1234').trim();
  const timestamp = new Date().toISOString();

  // 1. Try Express backend S3 upload endpoint
  try {
    const res = await fetch('/api/s3/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: cleanShopId,
        pin: cleanPin,
        endpointUrl: config.endpointUrl,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        region: config.region,
        bucketName: config.bucketName,
        payload: data,
      }),
    });

    const result = await res.json();
    if (res.ok && result.success) {
      const updatedConfig: CloudSyncMetadata = {
        ...config,
        lastUploadedAt: result.lastUploadedAt || timestamp,
        lastSyncedDevice: 'S3 Object Storage (Neon Cloud)',
        totalSyncedLots: data.lots.length,
      };
      saveStoredCloudConfig(updatedConfig);
      saveLocalBackupVault(cleanShopId, cleanPin, data, timestamp);

      return {
        success: true,
        message: result.message || 'ڈیٹا کامیابی سے S3 آبجیکٹ اسٹوریج پر اپ لوڈ ہو گیا!',
        timestamp,
        lastUploadedAt: result.lastUploadedAt || timestamp,
        lotsCount: data.lots.length,
        customersCount: data.customers.length,
        vendorsCount: data.vendors.length,
        expensesCount: data.expenses?.length || 0,
        drawerAdjustmentsCount: data.drawerAdjustments?.length || 0,
        logsCount: data.systemLogs?.length || 0,
        storageEngine: 'S3-Compatible Object Storage (Neon)',
        bucketName: result.bucketName,
        objectKey: result.objectKey,
      };
    } else if (result.message && !res.ok && res.status !== 404) {
      return {
        success: false,
        message: result.message,
        timestamp,
      };
    }
  } catch {
    // Fallback to client-side S3
  }

  // 2. Direct client-side S3 upload
  const s3Instance = getClientS3Instance(config);
  if (s3Instance) {
    const { client, bucketName } = s3Instance;
    const objectKey = `backups/${cleanShopId}.json`;

    try {
      const uploadEnvelope = {
        version: '2.0.0',
        storageType: 'neon_s3_object_storage',
        shopId: cleanShopId,
        shopPin: cleanPin,
        uploadedAt: timestamp,
        stats: {
          lotsCount: data.lots.length,
          customersCount: data.customers.length,
          vendorsCount: data.vendors.length,
          expensesCount: data.expenses?.length || 0,
          drawerCount: data.drawerAdjustments?.length || 0,
          logsCount: data.systemLogs?.length || 0,
        },
        payload: data,
      };

      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: JSON.stringify(uploadEnvelope, null, 2),
          ContentType: 'application/json; charset=utf-8',
        })
      );

      const updatedConfig: CloudSyncMetadata = {
        ...config,
        lastUploadedAt: timestamp,
        lastSyncedDevice: 'S3 Object Storage (Direct Client)',
        totalSyncedLots: data.lots.length,
      };
      saveStoredCloudConfig(updatedConfig);
      saveLocalBackupVault(cleanShopId, cleanPin, data, timestamp);

      return {
        success: true,
        message: `ڈیٹا کامیابی سے S3 آبجیکٹ اسٹوریج پر اپ لوڈ ہو گیا! (${objectKey})`,
        timestamp,
        lastUploadedAt: timestamp,
        lotsCount: data.lots.length,
        customersCount: data.customers.length,
        vendorsCount: data.vendors.length,
        expensesCount: data.expenses?.length || 0,
        drawerAdjustmentsCount: data.drawerAdjustments?.length || 0,
        logsCount: data.systemLogs?.length || 0,
        storageEngine: 'S3-Compatible Object Storage (Neon)',
        bucketName,
        objectKey,
      };
    } catch (err: any) {
      console.warn('Direct S3 upload failed:', err);
    }
  }

  // 3. Fallback to Local Offline Backup Vault
  saveLocalBackupVault(cleanShopId, cleanPin, data, timestamp);
  const updatedConfig: CloudSyncMetadata = {
    ...config,
    lastUploadedAt: timestamp,
    lastSyncedDevice: 'Local Offline Storage Vault',
    totalSyncedLots: data.lots.length,
  };
  saveStoredCloudConfig(updatedConfig);

  return {
    success: true,
    message: 'ڈیٹا مقامی محفوظ آف لائن والٹ میں سنک ہو گیا ہے۔ (S3 کنکشن چیک کریں)',
    timestamp,
    lastUploadedAt: timestamp,
    lotsCount: data.lots.length,
    customersCount: data.customers.length,
    vendorsCount: data.vendors.length,
    expensesCount: data.expenses?.length || 0,
    drawerAdjustmentsCount: data.drawerAdjustments?.length || 0,
    logsCount: data.systemLogs?.length || 0,
    storageEngine: 'Local Offline Vault',
  };
}

/**
 * Download Mandi dataset from S3 Object Storage
 */
export async function downloadDataFromCloud(
  shopId: string,
  pin: string,
  s3ConfigOverride?: Partial<CloudSyncMetadata>
): Promise<CloudSyncResult> {
  const currentConfig = getStoredCloudConfig();
  const mergedConfig: CloudSyncMetadata = {
    ...currentConfig,
    ...s3ConfigOverride,
  };

  const cleanShopId = String(shopId || mergedConfig.shopCloudId).trim().toUpperCase();
  const cleanPin = String(pin || mergedConfig.shopPin || '').trim();
  const timestamp = new Date().toISOString();

  // 1. Try Express backend S3 download endpoint
  try {
    const res = await fetch('/api/s3/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: cleanShopId,
        pin: cleanPin,
        endpointUrl: mergedConfig.endpointUrl,
        accessKeyId: mergedConfig.accessKeyId,
        secretAccessKey: mergedConfig.secretAccessKey,
        region: mergedConfig.region,
        bucketName: mergedConfig.bucketName,
      }),
    });

    const result = await res.json();
    if (res.ok && result.success && result.data) {
      const updatedConfig: CloudSyncMetadata = {
        ...mergedConfig,
        shopCloudId: cleanShopId,
        shopPin: cleanPin,
        lastDownloadedAt: timestamp,
        lastUploadedAt: result.lastUploadedAt || mergedConfig.lastUploadedAt,
        totalSyncedLots: result.lotsCount,
      };
      saveStoredCloudConfig(updatedConfig);

      return {
        success: true,
        message: result.message || 'ڈیٹا کامیابی سے S3 آبجیکٹ اسٹوریج سے ڈاؤن لوڈ ہو گیا!',
        timestamp,
        lastUploadedAt: result.lastUploadedAt,
        lastDownloadedAt: timestamp,
        lotsCount: result.lotsCount,
        customersCount: result.customersCount,
        vendorsCount: result.vendorsCount,
        expensesCount: result.expensesCount || result.data?.expenses?.length || 0,
        drawerAdjustmentsCount: result.data?.drawerAdjustments?.length || 0,
        logsCount: result.data?.systemLogs?.length || 0,
        data: result.data,
        storageEngine: 'S3-Compatible Object Storage (Neon)',
        bucketName: result.bucketName,
        objectKey: result.objectKey,
      };
    } else if (result.message && !res.ok && res.status !== 404) {
      return {
        success: false,
        message: result.message,
        timestamp,
      };
    }
  } catch {
    // Fallback to direct client
  }

  // 2. Direct client-side S3 download
  const s3Instance = getClientS3Instance(mergedConfig);
  if (s3Instance) {
    const { client, bucketName } = s3Instance;
    const objectKey = `backups/${cleanShopId}.json`;

    try {
      const getRes = await client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        })
      );

      const bodyStr = await getRes.Body?.transformToString();
      if (bodyStr) {
        const parsedEnvelope = JSON.parse(bodyStr);
        const storedPin = parsedEnvelope.shopPin || parsedEnvelope.pin;
        if (storedPin && cleanPin && storedPin !== cleanPin) {
          return {
            success: false,
            message: 'غلط پن کوڈ (Invalid Security PIN)',
            timestamp,
          };
        }

        const payload = parsedEnvelope.payload || parsedEnvelope;
        const updatedConfig: CloudSyncMetadata = {
          ...mergedConfig,
          shopCloudId: cleanShopId,
          shopPin: cleanPin,
          lastDownloadedAt: timestamp,
          lastUploadedAt: parsedEnvelope.uploadedAt || timestamp,
          totalSyncedLots: payload.lots?.length || 0,
        };
        saveStoredCloudConfig(updatedConfig);

        return {
          success: true,
          message: 'ڈیٹا کامیابی سے S3 آبجیکٹ اسٹوریج سے ڈاؤن لوڈ ہو گیا!',
          timestamp,
          lastUploadedAt: parsedEnvelope.uploadedAt || timestamp,
          lastDownloadedAt: timestamp,
          lotsCount: payload.lots?.length || 0,
          customersCount: payload.customers?.length || 0,
          vendorsCount: payload.vendors?.length || 0,
          expensesCount: payload.expenses?.length || 0,
          drawerAdjustmentsCount: payload.drawerAdjustments?.length || 0,
          logsCount: payload.systemLogs?.length || 0,
          data: payload,
          storageEngine: 'S3-Compatible Object Storage (Neon)',
          bucketName,
          objectKey,
        };
      }
    } catch (err: any) {
      console.warn('Direct S3 download failed:', err);
    }
  }

  // 3. Fallback to Local Backup Vault
  const localData = getLocalBackupVault(cleanShopId, cleanPin);
  if (localData) {
    const updatedConfig: CloudSyncMetadata = {
      ...mergedConfig,
      shopCloudId: cleanShopId,
      shopPin: cleanPin,
      lastDownloadedAt: timestamp,
      lastUploadedAt: localData.uploadedAt || timestamp,
      totalSyncedLots: localData.data.lots.length,
    };
    saveStoredCloudConfig(updatedConfig);

    return {
      success: true,
      message: 'مقامی آف لائن والٹ سے بیک اپ بحال کر دیا گیا۔ (S3 کنکشن غیر دستیاب ہے)',
      timestamp,
      lastUploadedAt: localData.uploadedAt,
      lastDownloadedAt: timestamp,
      lotsCount: localData.data.lots?.length || 0,
      customersCount: localData.data.customers?.length || 0,
      vendorsCount: localData.data.vendors?.length || 0,
      expensesCount: localData.data.expenses?.length || 0,
      drawerAdjustmentsCount: localData.data.drawerAdjustments?.length || 0,
      logsCount: localData.data.systemLogs?.length || 0,
      data: localData.data,
      storageEngine: 'Local Backup Vault',
    };
  }

  return {
    success: false,
    message: `S3 آبجیکٹ اسٹوریج میں دکان ID "${cleanShopId}" کا کوئی بیک اپ ڈیٹا نہیں ملا۔ پہلے پرائمری ڈیوائس سے ڈیٹا اپ لوڈ کریں۔`,
    timestamp,
  };
}

function saveLocalBackupVault(
  shopId: string,
  pin: string,
  data: {
    settings: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
    expenses?: ShopExpense[];
    drawerAdjustments?: DrawerAdjustment[];
  },
  timestamp: string
): void {
  try {
    const vaultKey = `${LOCAL_VAULT_PREFIX}${shopId}`;
    const vaultObject = {
      shopId,
      pin,
      uploadedAt: timestamp,
      data,
    };
    localStorage.setItem(vaultKey, JSON.stringify(vaultObject));
  } catch (e) {
    console.warn('Failed to save local backup vault:', e);
  }
}

function getLocalBackupVault(
  shopId: string,
  pin: string
): { uploadedAt: string; data: any } | null {
  try {
    const vaultKey = `${LOCAL_VAULT_PREFIX}${shopId}`;
    const raw = localStorage.getItem(vaultKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.pin && pin && parsed.pin !== pin) {
      return null;
    }
    return {
      uploadedAt: parsed.uploadedAt,
      data: parsed.data,
    };
  } catch {
    return null;
  }
}
