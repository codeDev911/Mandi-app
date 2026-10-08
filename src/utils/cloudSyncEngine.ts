import { VendorLot, AppSettings, CustomerBuyer, SavedVendor, ShopExpense, DrawerAdjustment, SyncProgressState } from '../types';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { Capacitor } from '@capacitor/core';

export interface CloudSyncMetadata {
  shopCloudId: string;
  shopPin: string;
  endpointUrl?: string; // AWS_ENDPOINT_URL_S3 e.g. "https://br-solitary-dream-aysdl8uh.storage.c-5.us-east-2.aws.neon.tech"
  accessKeyId?: string; // AWS_ACCESS_KEY_ID e.g. "nak_live_..."
  secretAccessKey?: string; // AWS_SECRET_ACCESS_KEY e.g. "nsk_live_..."
  region?: string; // AWS_REGION e.g. "us-east-2"
  bucketName?: string; // e.g. "mandi-data"
  apiProxyUrl?: string; // Optional custom backend server URL (e.g. for standalone Android / external deployment)
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
      } else if (key === 'API_PROXY_URL' || key === 'BACKEND_URL' || key === 'PROXY_URL') {
        result.apiProxyUrl = value;
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
        apiProxyUrl: sanitizeS3String(parsed.apiProxyUrl || ''),
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
    apiProxyUrl: '',
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
      apiProxyUrl: sanitizeS3String(config.apiProxyUrl || ''),
    };
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cleanedConfig));
  } catch {
    // ignore
  }
}

/**
 * Resolves an API URL using relative path or optional custom backend proxy
 */
export function resolveApiUrl(path: string, customProxyUrl?: string): string {
  if (customProxyUrl && customProxyUrl.trim()) {
    let base = customProxyUrl.trim();
    while (base.endsWith('/')) {
      base = base.slice(0, -1);
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }
  return path;
}

/**
 * Detects whether the app is running in a standalone mobile/desktop environment
 * without an active local Node.js Express server on the current origin (e.g. Capacitor Android APK).
 */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // ignore
  }
  const origin = window.location.origin || '';
  const protocol = window.location.protocol || '';
  if (protocol === 'capacitor:' || protocol === 'file:') return true;
  if (origin.includes('localhost') && !origin.includes(':3000') && !origin.includes(':8080')) return true;
  return false;
}

/**
 * Safely converts an S3 GetObject response body into a string across
 * Browser, Capacitor Native, and Node environments without hanging.
 */
async function extractBodyString(body: any): Promise<string> {
  if (!body) return '';
  if (typeof body === 'string') return body;
  if (typeof body.transformToString === 'function') {
    try {
      return await body.transformToString();
    } catch {
      // Fallback below
    }
  }
  if (typeof body.text === 'function') {
    try {
      return await body.text();
    } catch {
      // ignore
    }
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return await body.text();
  }
  if (body instanceof ArrayBuffer) {
    return new TextDecoder('utf-8').decode(body);
  }
  if (body instanceof Uint8Array) {
    return new TextDecoder('utf-8').decode(body);
  }
  if (typeof (body as any)[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    for await (const chunk of body) {
      if (typeof chunk === 'string') {
        chunks.push(new TextEncoder().encode(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      } else if (chunk instanceof ArrayBuffer) {
        chunks.push(new Uint8Array(chunk));
      }
    }
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder('utf-8').decode(merged);
  }
  return String(body);
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
 * Translates low-level S3 and AWS errors into user-friendly Urdu and English messages
 */
export function formatS3Error(err: any, bucketName?: string): string {
  const code = err?.name || err?.Code || err?.code || '';
  const rawMsg = err?.message || String(err || '');
  const lowerMsg = rawMsg.toLowerCase();

  if (code === 'InvalidAccessKeyId' || rawMsg.includes('InvalidAccessKeyId') || rawMsg.includes('Access Key Id you provided does not exist')) {
    return 'غلط AWS_ACCESS_KEY_ID: فراہم کردہ ایکسس کی درست نہیں ہے یا منسوخ ہو چکی ہے۔ (Invalid Access Key ID)';
  }

  if (code === 'SignatureDoesNotMatch' || rawMsg.includes('SignatureDoesNotMatch')) {
    return 'غلط AWS_SECRET_ACCESS_KEY: سیکریٹ کی میل نہیں کھا رہی۔ براہ کرم خفیہ کی دوبارہ چیک کریں۔ (Secret Key mismatch)';
  }

  if (code === 'NoSuchBucket' || code === 'NotFound' || rawMsg.includes('NoSuchBucket') || err?.$metadata?.httpStatusCode === 404) {
    return `بکٹ "${bucketName || ''}" موجود نہیں ہے۔ براہ کرم بکٹ کا نام درست درج کریں۔ (Bucket "${bucketName || ''}" not found)`;
  }

  if (code === 'AccessDenied' || rawMsg.includes('AccessDenied') || err?.$metadata?.httpStatusCode === 403) {
    return `اجازت نہیں ہے (Access Denied): بکٹ "${bucketName || ''}" میں ڈیٹا لکھنے یا پڑھنے کے حقوق نہیں ہیں۔`;
  }

  if (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('networkerror') ||
    lowerMsg.includes('network request failed') ||
    lowerMsg.includes('cors') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('econnrefused')
  ) {
    return 'کلاؤڈ سرور سے نیٹ ورک رابطہ قائم نہیں ہو سکا (Network/CORS: Failed to fetch)۔ براہ کرم انٹرنیٹ یا S3 Endpoint URL چیک کریں۔ پروڈکشن میں اگر سرور الگ ہے تو Proxy URL دیں یا S3 بکٹ پر CORS فعال کریں۔';
  }

  return rawMsg || 'S3 کنکشن میں نامعلوم مسئلہ پیش آیا';
}

/**
 * Instantiates an in-browser S3Client with custom credentials
 */
export function getClientS3Instance(config: Partial<CloudSyncMetadata>): { client: S3Client; bucketName: string; isAws: boolean } | null {
  let endpoint = sanitizeS3String(config.endpointUrl);
  let accessKeyId = sanitizeS3String(config.accessKeyId);
  let secretAccessKey = sanitizeS3String(config.secretAccessKey);
  let region = sanitizeS3String(config.region || 'us-east-2');
  let bucketName = sanitizeS3String(config.bucketName || 'mandi-data');

  while (endpoint.endsWith('/')) {
    endpoint = endpoint.slice(0, -1);
  }

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const normalizedEndpoint = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
  const isAws = normalizedEndpoint.includes('amazonaws.com') && !normalizedEndpoint.includes('neon.tech');

  const client = new S3Client({
    endpoint: normalizedEndpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: !isAws,
    maxAttempts: 2,
  });

  return { client, bucketName, isAws };
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
  // 1. Try Express backend proxy route if not in standalone mode or if custom proxy is set
  if (!isStandaloneApp() || config.apiProxyUrl?.trim()) {
    const testApiUrl = resolveApiUrl('/api/s3/test', config.apiProxyUrl);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(testApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.success) {
          return {
            success: true,
            message: data.message || 'S3 Object Storage connection verified successfully!',
            endpoint: data.endpoint,
            bucketName: data.bucketName,
            availableBuckets: data.availableBuckets,
            storageEngine: data.storageEngine || 'S3-Compatible Object Storage (Neon)',
          };
        } else if (data && !data.success && data.message) {
          return {
            success: false,
            message: data.message,
          };
        }
      }
    } catch {
      // If proxy is not reachable, fallback to direct client-side S3 call below
    }
  }

  // 2. Direct client-side S3 connection test
  const s3Instance = getClientS3Instance(config);
  if (!s3Instance) {
    return {
      success: false,
      message: 'براہ کرم اینڈپوائنٹ URL، ایکسس کی، اور سیکریٹ کی درج کریں (Missing S3 credentials)',
    };
  }

  const { client, bucketName, isAws } = s3Instance;

  try {
    // Attempt to auto-configure CORS on the bucket if credentials permit
    try {
      await client.send(
        new PutBucketCorsCommand({
          Bucket: bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        })
      );
    } catch {
      // Ignore if user credentials do not allow PutBucketCors
    }

    let buckets: string[] = [];
    let listSuccess = false;
    try {
      const listRes = await client.send(new ListBucketsCommand({}));
      buckets = (listRes.Buckets || []).map((b) => b.Name || '');
      listSuccess = true;
    } catch {
      // Scoped credentials may restrict ListBuckets
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
      } else if (!listSuccess) {
        return {
          success: false,
          message: formatS3Error(headErr, bucketName),
        };
      }
    }

    // Direct probe test
    const probeKey = `backups/.probe_${Date.now()}.tmp`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: probeKey,
          Body: JSON.stringify({ probe: true, timestamp: new Date().toISOString() }),
          ContentType: 'application/json',
        })
      );

      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: probeKey,
          })
        );
      } catch {
        // ignore delete failure
      }
    } catch (probeErr: any) {
      return {
        success: false,
        message: formatS3Error(probeErr, bucketName),
      };
    }

    return {
      success: true,
      message: 'S3 آبجیکٹ اسٹوریج کنکشن اور اپ لوڈ/ڈاؤن لوڈ حقوق تصدیق شدہ ہیں!',
      endpoint: config.endpointUrl,
      bucketName,
      availableBuckets: buckets,
      storageEngine: isAws ? 'AWS S3 Storage' : 'S3-Compatible Object Storage (Neon)',
    };
  } catch (err: any) {
    return {
      success: false,
      message: formatS3Error(err, bucketName),
    };
  }
}

/**
 * Direct client-side fallback upload
 */
async function uploadDirectS3Client(
  config: CloudSyncMetadata,
  data: any,
  cleanShopId: string,
  cleanPin: string,
  totalPayloadBytes: number,
  timestamp: string,
  onProgress?: (progress: SyncProgressState) => void
): Promise<CloudSyncResult> {
  const s3 = getClientS3Instance(config);
  if (!s3) {
    throw new Error('S3 Client initialization failed. Check Endpoint, Access Key, and Secret Key.');
  }
  const { client, bucketName } = s3;
  const objectKey = `backups/${cleanShopId}.json`;

  // Auto-attempt CORS enablement on the bucket so other clients/browsers can also read/write directly
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
  } catch {
    // Ignore if not allowed or already enabled
  }

  onProgress?.({
    stage: 'transferring',
    direction: 'upload',
    loadedBytes: Math.round(totalPayloadBytes * 0.4),
    totalBytes: totalPayloadBytes,
    percentage: 50,
    speedBytesPerSec: 0,
    estimatedSecondsLeft: 2,
    message: 'Direct browser S3 upload in progress...',
  });

  const uploadEnvelope = {
    version: '2.0.0',
    storageType: 'neon_s3_object_storage',
    shopId: cleanShopId,
    shopPin: cleanPin,
    uploadedAt: timestamp,
    stats: {
      lotsCount: data.lots?.length || 0,
      customersCount: data.customers?.length || 0,
      vendorsCount: data.vendors?.length || 0,
      expensesCount: data.expenses?.length || 0,
      drawerCount: data.drawerAdjustments?.length || 0,
    },
    payload: data,
  };

  const payloadJson = JSON.stringify(uploadEnvelope);

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: payloadJson,
      ContentType: 'application/json; charset=utf-8',
    }),
    { abortSignal: AbortSignal.timeout(20000) }
  );

  const updatedConfig: CloudSyncMetadata = {
    ...config,
    lastUploadedAt: timestamp,
    lastSyncedDevice: 'S3 Object Storage (Direct Browser Client)',
    totalSyncedLots: data.lots?.length || 0,
  };
  saveStoredCloudConfig(updatedConfig);
  saveLocalBackupVault(cleanShopId, cleanPin, data, timestamp);

  onProgress?.({
    stage: 'completed',
    direction: 'upload',
    loadedBytes: totalPayloadBytes,
    totalBytes: totalPayloadBytes,
    percentage: 100,
    speedBytesPerSec: 0,
    estimatedSecondsLeft: 0,
    message: 'Data successfully backed up to S3 Cloud!',
    resultSummary: {
      lotsCount: data.lots?.length || 0,
      customersCount: data.customers?.length || 0,
      vendorsCount: data.vendors?.length || 0,
      expensesCount: data.expenses?.length || 0,
      drawerCount: data.drawerAdjustments?.length || 0,
    },
  });

  return {
    success: true,
    message: 'Data successfully uploaded to S3 Object Storage!',
    timestamp,
    lastUploadedAt: timestamp,
    lotsCount: data.lots?.length || 0,
    customersCount: data.customers?.length || 0,
    vendorsCount: data.vendors?.length || 0,
    expensesCount: data.expenses?.length || 0,
    drawerAdjustmentsCount: data.drawerAdjustments?.length || 0,
    logsCount: data.systemLogs?.length || 0,
    storageEngine: 'S3-Compatible Object Storage (Neon)',
    bucketName,
    objectKey,
  };
}

/**
 * Direct client-side fallback download
 */
async function downloadDirectS3Client(
  mergedConfig: CloudSyncMetadata,
  cleanShopId: string,
  cleanPin: string,
  timestamp: string,
  onProgress?: (progress: SyncProgressState) => void
): Promise<CloudSyncResult> {
  const s3 = getClientS3Instance(mergedConfig);
  if (!s3) {
    throw new Error('S3 Client initialization failed. Check Endpoint, Access Key, and Secret Key.');
  }
  const { client, bucketName } = s3;
  const objectKey = `backups/${cleanShopId}.json`;

  onProgress?.({
    stage: 'transferring',
    direction: 'download',
    loadedBytes: 0,
    totalBytes: 0,
    percentage: 45,
    speedBytesPerSec: 0,
    estimatedSecondsLeft: 2,
    message: 'Direct browser S3 download in progress...',
  });

  let getRes;
  try {
    getRes = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }),
      { abortSignal: AbortSignal.timeout(15000) }
    );
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      throw new Error(`No backup found for Shop ID "${cleanShopId}" in bucket "${bucketName}". Please upload data first.`);
    }
    throw err;
  }

  const bodyStr = await extractBodyString(getRes.Body);
  if (!bodyStr) {
    throw new Error('Empty backup file received from cloud.');
  }

  const parsedEnvelope = JSON.parse(bodyStr);
  const storedPin = parsedEnvelope.shopPin || parsedEnvelope.pin;
  if (storedPin && cleanPin && storedPin !== cleanPin) {
    throw new Error('Invalid security PIN code. Please enter the correct PIN.');
  }

  const payload = parsedEnvelope.payload || parsedEnvelope;
  const totalBytesReceived = bodyStr.length;

  const updatedConfig: CloudSyncMetadata = {
    ...mergedConfig,
    shopCloudId: cleanShopId,
    shopPin: cleanPin,
    lastDownloadedAt: timestamp,
    lastUploadedAt: parsedEnvelope.uploadedAt || mergedConfig.lastUploadedAt,
    totalSyncedLots: payload.lots?.length || 0,
  };
  saveStoredCloudConfig(updatedConfig);

  onProgress?.({
    stage: 'completed',
    direction: 'download',
    loadedBytes: totalBytesReceived,
    totalBytes: totalBytesReceived,
    percentage: 100,
    speedBytesPerSec: 0,
    estimatedSecondsLeft: 0,
    message: 'Data successfully downloaded and restored from S3 Object Storage!',
    resultSummary: {
      lotsCount: payload.lots?.length || 0,
      customersCount: payload.customers?.length || 0,
      vendorsCount: payload.vendors?.length || 0,
      expensesCount: payload.expenses?.length || 0,
      drawerCount: payload.drawerAdjustments?.length || 0,
    },
  });

  return {
    success: true,
    message: 'ڈیٹا کامیابی سے S3 آبجیکٹ اسٹوریج سے ڈاؤن لوڈ ہو گیا!',
    timestamp,
    lastUploadedAt: parsedEnvelope.uploadedAt,
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

/**
 * Upload entire Mandi dataset to S3 Object Storage with progressive byte-level tracking
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
  },
  onProgress?: (progress: SyncProgressState) => void
): Promise<CloudSyncResult> {
  const cleanShopId = String(config.shopCloudId || 'MANDI-786').trim().toUpperCase();
  const cleanPin = String(config.shopPin || '1234').trim();
  const timestamp = new Date().toISOString();

  // Validate credentials presence first
  const endpoint = sanitizeS3String(config.endpointUrl);
  const accessKeyId = sanitizeS3String(config.accessKeyId);
  const secretAccessKey = sanitizeS3String(config.secretAccessKey);

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    const errMsg = 'براہ کرم پہلے Tab 3 میں S3 کریڈنشلز (Endpoint URL, Access Key, Secret Key) درج کریں۔';
    onProgress?.({
      stage: 'error',
      direction: 'upload',
      loadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
      speedBytesPerSec: 0,
      estimatedSecondsLeft: 0,
      error: errMsg,
    });
    return {
      success: false,
      message: errMsg,
      timestamp,
    };
  }

  // 1. Initial packaging state
  onProgress?.({
    stage: 'preparing',
    direction: 'upload',
    loadedBytes: 0,
    totalBytes: 0,
    percentage: 5,
    speedBytesPerSec: 0,
    estimatedSecondsLeft: 0,
    message: 'Packaging and preparing data payload...',
  });

  const payloadString = JSON.stringify({
    shopId: cleanShopId,
    pin: cleanPin,
    endpointUrl: config.endpointUrl,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    bucketName: config.bucketName,
    payload: data,
  });

  const totalPayloadBytes = new Blob([payloadString]).size;

  onProgress?.({
    stage: 'preparing',
    direction: 'upload',
    loadedBytes: 0,
    totalBytes: totalPayloadBytes,
    percentage: 10,
    speedBytesPerSec: 0,
    estimatedSecondsLeft: 0,
    message: 'Connecting to S3 Object Storage...',
  });

  // In standalone mobile/desktop environments (Capacitor Android) without custom proxy,
  // do NOT attempt requesting /api/s3/upload on localhost. Immediately use direct S3 client!
  if (isStandaloneApp() && !config.apiProxyUrl?.trim()) {
    return await uploadDirectS3Client(
      config,
      data,
      cleanShopId,
      cleanPin,
      totalPayloadBytes,
      timestamp,
      onProgress
    );
  }

  return new Promise<CloudSyncResult>((resolve) => {
    let isSettled = false;
    const uploadApiUrl = resolveApiUrl('/api/s3/upload', config.apiProxyUrl);
    const xhr = new XMLHttpRequest();
    xhr.timeout = 10000; // Strict 10-second timeout

    const safetyTimer = setTimeout(() => {
      if (!isSettled) {
        try { xhr.abort(); } catch {}
        fallbackToDirect();
      }
    }, 10500);

    const fallbackToDirect = async (initialErrMsg?: string) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(safetyTimer);

      onProgress?.({
        stage: 'preparing',
        direction: 'upload',
        loadedBytes: 0,
        totalBytes: totalPayloadBytes,
        percentage: 15,
        speedBytesPerSec: 0,
        estimatedSecondsLeft: 0,
        message: 'Direct Cloud Storage connection in progress...',
      });

      try {
        const fallbackResult = await uploadDirectS3Client(
          config,
          data,
          cleanShopId,
          cleanPin,
          totalPayloadBytes,
          timestamp,
          onProgress
        );
        resolve(fallbackResult);
      } catch (directErr: any) {
        const errMsg = initialErrMsg || formatS3Error(directErr, config.bucketName);
        onProgress?.({
          stage: 'error',
          direction: 'upload',
          loadedBytes: 0,
          totalBytes: totalPayloadBytes,
          percentage: 0,
          speedBytesPerSec: 0,
          estimatedSecondsLeft: 0,
          error: errMsg,
        });

        resolve({
          success: false,
          message: errMsg,
          timestamp,
        });
      }
    };

    xhr.open('POST', uploadApiUrl);
    xhr.setRequestHeader('Content-Type', 'application/json');

    const startTime = Date.now();

    // Byte-level upload transfer progress (handles up to hundreds of MBs seamlessly)
    xhr.upload.onprogress = (evt) => {
      const loaded = evt.loaded;
      const total = evt.lengthComputable && evt.total > 0 ? evt.total : totalPayloadBytes;
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? loaded / elapsed : 0;
      const remaining = Math.max(0, total - loaded);
      const secondsLeft = speed > 0 ? Math.ceil(remaining / speed) : 0;
      const percent = Math.min(95, Math.max(10, Math.round((loaded / total) * 90)));

      onProgress?.({
        stage: 'transferring',
        direction: 'upload',
        loadedBytes: loaded,
        totalBytes: total,
        percentage: percent,
        speedBytesPerSec: speed,
        estimatedSecondsLeft: secondsLeft,
        message: `Transferring to cloud: ${(loaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB`,
      });
    };

    xhr.onload = async () => {
      try {
        let result: any = null;
        try {
          result = JSON.parse(xhr.responseText);
        } catch {
          result = { message: xhr.responseText || 'Server returned invalid response' };
        }

        if (xhr.status >= 200 && xhr.status < 300 && result?.success) {
          const updatedConfig: CloudSyncMetadata = {
            ...config,
            lastUploadedAt: result.lastUploadedAt || timestamp,
            lastSyncedDevice: 'S3 Object Storage (Neon Cloud)',
            totalSyncedLots: data.lots.length,
          };
          saveStoredCloudConfig(updatedConfig);
          saveLocalBackupVault(cleanShopId, cleanPin, data, timestamp);

          onProgress?.({
            stage: 'completed',
            direction: 'upload',
            loadedBytes: totalPayloadBytes,
            totalBytes: totalPayloadBytes,
            percentage: 100,
            speedBytesPerSec: 0,
            estimatedSecondsLeft: 0,
            message: result.message || 'Data successfully uploaded to S3 Object Storage!',
            resultSummary: {
              lotsCount: data.lots.length,
              customersCount: data.customers.length,
              vendorsCount: data.vendors.length,
              expensesCount: data.expenses?.length || 0,
              drawerCount: data.drawerAdjustments?.length || 0,
            },
          });

          isSettled = true;
          clearTimeout(safetyTimer);
          resolve({
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
          });
        } else {
          await fallbackToDirect(result?.message);
        }
      } catch (err: any) {
        await fallbackToDirect();
      }
    };

    xhr.onerror = async () => {
      await fallbackToDirect();
    };

    xhr.ontimeout = async () => {
      await fallbackToDirect();
    };

    xhr.onabort = async () => {
      await fallbackToDirect();
    };

    xhr.send(payloadString);
  });
}

/**
 * Download Mandi dataset from S3 Object Storage with progressive byte-level tracking
 */
export async function downloadDataFromCloud(
  shopId: string,
  pin: string,
  s3ConfigOverride?: Partial<CloudSyncMetadata>,
  onProgress?: (progress: SyncProgressState) => void
): Promise<CloudSyncResult> {
  const currentConfig = getStoredCloudConfig();
  const mergedConfig: CloudSyncMetadata = {
    ...currentConfig,
    ...s3ConfigOverride,
  };

  const cleanShopId = String(shopId || mergedConfig.shopCloudId).trim().toUpperCase();
  const cleanPin = String(pin || mergedConfig.shopPin || '').trim();
  const timestamp = new Date().toISOString();

  // Validate credentials presence first
  const endpoint = sanitizeS3String(mergedConfig.endpointUrl);
  const accessKeyId = sanitizeS3String(mergedConfig.accessKeyId);
  const secretAccessKey = sanitizeS3String(mergedConfig.secretAccessKey);

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    const errMsg = 'براہ کرم پہلے Tab 3 میں S3 کریڈنشلز (Endpoint URL, Access Key, Secret Key) درج کریں۔';
    onProgress?.({
      stage: 'error',
      direction: 'download',
      loadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
      speedBytesPerSec: 0,
      estimatedSecondsLeft: 0,
      error: errMsg,
    });
    return {
      success: false,
      message: errMsg,
      timestamp,
    };
  }

  onProgress?.({
    stage: 'preparing',
    direction: 'download',
    loadedBytes: 0,
    totalBytes: 0,
    percentage: 10,
    speedBytesPerSec: 0,
    estimatedSecondsLeft: 0,
    message: 'Connecting to S3 Object Storage...',
  });

  // In standalone mobile/desktop environments (Capacitor Android) without custom proxy,
  // do NOT attempt requesting /api/s3/download on localhost. Immediately use direct S3 client!
  if (isStandaloneApp() && !mergedConfig.apiProxyUrl?.trim()) {
    return await downloadDirectS3Client(
      mergedConfig,
      cleanShopId,
      cleanPin,
      timestamp,
      onProgress
    );
  }

  return new Promise<CloudSyncResult>((resolve) => {
    let isSettled = false;
    const downloadApiUrl = resolveApiUrl('/api/s3/download', mergedConfig.apiProxyUrl);
    const xhr = new XMLHttpRequest();
    xhr.timeout = 8000; // Strict 8-second timeout so it never sticks indefinitely

    const safetyTimer = setTimeout(() => {
      if (!isSettled) {
        try { xhr.abort(); } catch {}
        fallbackToDirect();
      }
    }, 8500);

    const fallbackToDirect = async (initialErrMsg?: string) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(safetyTimer);

      onProgress?.({
        stage: 'preparing',
        direction: 'download',
        loadedBytes: 0,
        totalBytes: 0,
        percentage: 20,
        speedBytesPerSec: 0,
        estimatedSecondsLeft: 0,
        message: 'Direct Cloud Storage connection in progress...',
      });

      try {
        const fallbackResult = await downloadDirectS3Client(
          mergedConfig,
          cleanShopId,
          cleanPin,
          timestamp,
          onProgress
        );
        resolve(fallbackResult);
      } catch (directErr: any) {
        const errMsg = initialErrMsg || formatS3Error(directErr, mergedConfig.bucketName);
        onProgress?.({
          stage: 'error',
          direction: 'download',
          loadedBytes: 0,
          totalBytes: 0,
          percentage: 0,
          speedBytesPerSec: 0,
          estimatedSecondsLeft: 0,
          error: errMsg,
        });

        resolve({
          success: false,
          message: errMsg,
          timestamp,
        });
      }
    };

    xhr.open('POST', downloadApiUrl);
    xhr.setRequestHeader('Content-Type', 'application/json');

    const startTime = Date.now();

    xhr.onprogress = (evt) => {
      if (isSettled) return;
      const loaded = evt.loaded;
      const total = evt.lengthComputable && evt.total > 0 ? evt.total : 0;
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = elapsed > 0 ? loaded / elapsed : 0;
      const remaining = total > loaded ? total - loaded : 0;
      const secondsLeft = speed > 0 && remaining > 0 ? Math.ceil(remaining / speed) : 0;
      const percent = total > 0 ? Math.min(95, Math.max(10, Math.round((loaded / total) * 90))) : 50;

      onProgress?.({
        stage: 'transferring',
        direction: 'download',
        loadedBytes: loaded,
        totalBytes: total,
        percentage: percent,
        speedBytesPerSec: speed,
        estimatedSecondsLeft: secondsLeft,
        message: total > 0
          ? `Downloading from cloud: ${(loaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB`
          : `Receiving from cloud: ${(loaded / 1024 / 1024).toFixed(1)} MB`,
      });
    };

    xhr.onload = async () => {
      if (isSettled) return;
      try {
        let result: any = null;
        try {
          result = JSON.parse(xhr.responseText);
        } catch {
          result = { message: xhr.responseText || 'Server returned invalid response' };
        }

        if (xhr.status >= 200 && xhr.status < 300 && result?.success && result?.data) {
          isSettled = true;
          clearTimeout(safetyTimer);
          const totalBytesReceived = xhr.responseText.length;
          const updatedConfig: CloudSyncMetadata = {
            ...mergedConfig,
            shopCloudId: cleanShopId,
            shopPin: cleanPin,
            lastDownloadedAt: timestamp,
            lastUploadedAt: result.lastUploadedAt || mergedConfig.lastUploadedAt,
            totalSyncedLots: result.lotsCount,
          };
          saveStoredCloudConfig(updatedConfig);

          onProgress?.({
            stage: 'completed',
            direction: 'download',
            loadedBytes: totalBytesReceived,
            totalBytes: totalBytesReceived,
            percentage: 100,
            speedBytesPerSec: 0,
            estimatedSecondsLeft: 0,
            message: result.message || 'Data successfully downloaded and restored from S3 Object Storage!',
            resultSummary: {
              lotsCount: result.lotsCount || result.data.lots?.length || 0,
              customersCount: result.customersCount || result.data.customers?.length || 0,
              vendorsCount: result.vendorsCount || result.data.vendors?.length || 0,
              expensesCount: result.expensesCount || result.data.expenses?.length || 0,
              drawerCount: result.drawerCount || result.data.drawerAdjustments?.length || 0,
            },
          });

          resolve({
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
          });
        } else {
          await fallbackToDirect(result?.message);
        }
      } catch (err: any) {
        await fallbackToDirect();
      }
    };

    xhr.onerror = async () => {
      await fallbackToDirect();
    };

    xhr.ontimeout = async () => {
      await fallbackToDirect();
    };

    xhr.onabort = async () => {
      await fallbackToDirect();
    };

    const downloadRequestPayload = JSON.stringify({
      shopId: cleanShopId,
      pin: cleanPin,
      endpointUrl: mergedConfig.endpointUrl,
      accessKeyId: mergedConfig.accessKeyId,
      secretAccessKey: mergedConfig.secretAccessKey,
      region: mergedConfig.region,
      bucketName: mergedConfig.bucketName,
    });

    xhr.send(downloadRequestPayload);
  });
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
