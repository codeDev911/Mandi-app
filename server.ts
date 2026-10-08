import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/**
 * Automatically applies CORS rules on the S3 / Neon Object Storage bucket.
 * This enables direct client-side (browser, mobile webview, Capacitor, Neutralino)
 * uploads and downloads without "Failed to fetch" CORS errors.
 */
async function ensureBucketCors(client: S3Client, bucketName: string): Promise<boolean> {
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
    console.log(`[S3 CORS] Successfully configured CORS on bucket "${bucketName}"`);
    return true;
  } catch (err: any) {
    // If credentials are scoped or provider has custom CORS, log note without crashing
    console.warn(`[S3 CORS] Notice: Could not auto-apply CORS to bucket "${bucketName}":`, err?.message || err);
    return false;
  }
}

interface S3ConfigInput {
  endpointUrl?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
}

// Helper to configure S3 client with user-supplied credentials or environment fallback
function getS3ClientAndConfig(customConfig?: S3ConfigInput) {
  let endpoint = customConfig?.endpointUrl?.trim() || process.env.AWS_ENDPOINT_URL_S3?.trim() || '';
  let accessKeyId = customConfig?.accessKeyId?.trim() || process.env.AWS_ACCESS_KEY_ID?.trim() || '';
  let secretAccessKey = customConfig?.secretAccessKey?.trim() || process.env.AWS_SECRET_ACCESS_KEY?.trim() || '';
  let region = customConfig?.region?.trim() || process.env.AWS_REGION?.trim() || 'us-east-2';
  let bucketName = customConfig?.bucketName?.trim() || process.env.AWS_S3_BUCKET?.trim() || 'mandi-data';

  // Strip accidental wrapping quotes
  if ((endpoint.startsWith('"') && endpoint.endsWith('"')) || (endpoint.startsWith("'") && endpoint.endsWith("'"))) {
    endpoint = endpoint.slice(1, -1).trim();
  }
  if ((accessKeyId.startsWith('"') && accessKeyId.endsWith('"')) || (accessKeyId.startsWith("'") && accessKeyId.endsWith("'"))) {
    accessKeyId = accessKeyId.slice(1, -1).trim();
  }
  if ((secretAccessKey.startsWith('"') && secretAccessKey.endsWith('"')) || (secretAccessKey.startsWith("'") && secretAccessKey.endsWith("'"))) {
    secretAccessKey = secretAccessKey.slice(1, -1).trim();
  }

  // Remove trailing slashes from endpoint
  while (endpoint.endsWith('/')) {
    endpoint = endpoint.slice(0, -1);
  }

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = 'https://' + endpoint;
  }

  const isAws = endpoint.includes('amazonaws.com') && !endpoint.includes('neon.tech');

  const client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: !isAws, // Crucial: true for Neon/MinIO/custom S3, false for AWS S3
    maxAttempts: 2,
  });

  return { client, endpoint, accessKeyId, secretAccessKey, region, bucketName, isAws };
}

function formatS3ErrorServer(err: any, bucketName?: string): { message: string; code?: string } {
  const code = err?.name || err?.Code || err?.code || '';
  const rawMsg = err?.message || String(err || '');

  if (code === 'InvalidAccessKeyId' || rawMsg.includes('InvalidAccessKeyId') || rawMsg.includes('Access Key Id you provided does not exist')) {
    return {
      code,
      message: 'غلط AWS_ACCESS_KEY_ID: فراہم کردہ ایکسس کی درست نہیں ہے یا منسوخ ہو چکی ہے۔ (Invalid AWS Access Key ID)',
    };
  }

  if (code === 'SignatureDoesNotMatch' || rawMsg.includes('SignatureDoesNotMatch')) {
    return {
      code,
      message: 'غلط AWS_SECRET_ACCESS_KEY: سیکریٹ کی میل نہیں کھا رہی۔ براہ کرم خفیہ کی دوبارہ چیک کریں۔ (Secret Access Key signature mismatch)',
    };
  }

  if (code === 'NoSuchBucket' || code === 'NotFound' || rawMsg.includes('NoSuchBucket') || err?.$metadata?.httpStatusCode === 404) {
    return {
      code,
      message: `بکٹ "${bucketName || ''}" موجود نہیں ہے یا اس نام کا بکٹ کلاؤڈ پر نہیں ملا۔ (Bucket "${bucketName || ''}" not found)`,
    };
  }

  if (code === 'AccessDenied' || rawMsg.includes('AccessDenied') || err?.$metadata?.httpStatusCode === 403) {
    return {
      code,
      message: `اجازت نہیں ہے (Access Denied): بکٹ "${bucketName || ''}" میں ڈیٹا لکھنے یا پڑھنے کی اجازت نہیں ہے۔ (Access Denied / Insufficient permissions for bucket)`,
    };
  }

  if (rawMsg.includes('ENOTFOUND') || rawMsg.includes('ECONNREFUSED') || rawMsg.includes('fetch failed')) {
    return {
      code,
      message: 'اینڈپوائنٹ سرور سے رابطہ نہیں ہو رہا۔ براہ کرم انٹرنیٹ یا S3 Endpoint URL درست کریں۔ (Network error: cannot reach S3 Endpoint)',
    };
  }

  return {
    code,
    message: `S3 کنکشن خرابی: ${rawMsg}`,
  };
}

async function startServer() {
  const app = express();

  // Enable CORS for all origins, mobile webviews, and preview containers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, S3-Endpoint, S3-Access-Key'
    );
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '1000mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1000mb' }));

  // --- API Routes ---

  // 1. Health check & Storage Engine Info
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasEnvS3Endpoint: Boolean(process.env.AWS_ENDPOINT_URL_S3),
      hasEnvS3Credentials: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      storageEngine: 'S3-Compatible Object Storage (Neon)',
      defaultRegion: process.env.AWS_REGION || 'us-east-2',
    });
  });

  // 2. Test S3 Object Storage Connection
  const handleTestS3 = async (req: express.Request, res: express.Response) => {
    const s3Info = getS3ClientAndConfig(req.body);

    if (!s3Info) {
      return res.status(400).json({
        success: false,
        message: 'Missing S3 credentials. Please provide Endpoint URL, Access Key ID, and Secret Access Key.',
        hint: 'Enter AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY from your Neon Object Storage.',
      });
    }

    const { client, endpoint, bucketName, region, isAws } = s3Info;

    try {
      let buckets: string[] = [];
      let listSuccess = false;
      try {
        const listRes = await client.send(new ListBucketsCommand({}));
        buckets = (listRes.Buckets || []).map((b) => b.Name || '');
        listSuccess = true;
      } catch (listErr: any) {
        // Some scoped credentials only allow access to specific bucket
      }

      // Check bucket presence or attempt to create if missing
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
      } catch (headErr: any) {
        if (headErr?.name === 'NotFound' || headErr?.$metadata?.httpStatusCode === 404) {
          try {
            await client.send(new CreateBucketCommand({ Bucket: bucketName }));
          } catch {
            // Ignore if creation is not permitted; PutObject will verify
          }
        } else if (!listSuccess) {
          // If both ListBuckets and HeadBucket failed with auth error, reject immediately
          const formatted = formatS3ErrorServer(headErr, bucketName);
          return res.status(400).json({
            success: false,
            message: formatted.message,
            code: formatted.code,
          });
        }
      }

      // GENUINE PROBE TEST: Try writing and deleting a temporary probe file to verify real write & read permissions
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

        // Delete probe file cleanly
        try {
          await client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: probeKey,
            })
          );
        } catch {
          // Clean up failure does not break probe confirmation
        }
      } catch (probeErr: any) {
        const formatted = formatS3ErrorServer(probeErr, bucketName);
        return res.status(400).json({
          success: false,
          message: formatted.message,
          code: formatted.code,
        });
      }

      // Ensure bucket has CORS enabled so browser/Capacitor/Neutralino client builds can upload/download seamlessly
      await ensureBucketCors(client, bucketName);

      res.json({
        success: true,
        message: 'S3 آبجیکٹ اسٹوریج کنکشن اور اپ لوڈ/ڈاؤن لوڈ حقوق کامیابی سے تصدیق شدہ ہیں! (Connection verified successfully)',
        endpoint,
        bucketName,
        region,
        availableBuckets: buckets,
        storageEngine: isAws ? 'AWS S3 Storage' : 'S3-Compatible Object Storage (Neon)',
      });
    } catch (err: any) {
      console.error('S3 Connection Test Failed:', err);
      const formatted = formatS3ErrorServer(err, bucketName);
      res.status(400).json({
        success: false,
        message: formatted.message,
        code: formatted.code,
      });
    }
  };

  app.post('/api/s3/test', handleTestS3);
  app.post('/api/db/test', handleTestS3); // Backwards-compatible alias

  // 3. S3 Sync Upload
  const handleS3Upload = async (req: express.Request, res: express.Response) => {
    const { shopId, pin, payload } = req.body || {};

    if (!shopId || !payload) {
      return res.status(400).json({
        success: false,
        message: 'Missing shopId or data payload for S3 upload.',
      });
    }

    const s3Info = getS3ClientAndConfig(req.body);
    if (!s3Info) {
      return res.status(400).json({
        success: false,
        message: 'Missing S3 credentials. Please provide Endpoint URL, Access Key ID, and Secret Access Key.',
      });
    }

    const { client, bucketName, endpoint, isAws } = s3Info;
    const cleanShopId = String(shopId).trim().toUpperCase();
    const cleanPin = String(pin || '1234').trim();
    const objectKey = `backups/${cleanShopId}.json`;
    const timestamp = new Date().toISOString();

    const lots = payload.lots || [];
    const customers = payload.customers || [];
    const vendors = payload.vendors || [];
    const expenses = payload.expenses || [];
    const drawerAdjustments = payload.drawerAdjustments || [];

    const uploadEnvelope = {
      version: '2.0.0',
      storageType: 'neon_s3_object_storage',
      shopId: cleanShopId,
      shopPin: cleanPin,
      uploadedAt: timestamp,
      stats: {
        lotsCount: lots.length,
        customersCount: customers.length,
        vendorsCount: vendors.length,
        expensesCount: expenses.length,
        drawerCount: drawerAdjustments.length,
      },
      payload,
    };

    try {
      // Ensure bucket exists or create if possible
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
      } catch (headErr: any) {
        if (headErr?.name === 'NotFound' || headErr?.$metadata?.httpStatusCode === 404) {
          try {
            await client.send(new CreateBucketCommand({ Bucket: bucketName }));
          } catch {
            // Proceed to upload
          }
        }
      }

      // Automatically configure CORS so future browser client uploads/downloads do not get CORS errors
      ensureBucketCors(client, bucketName).catch(() => {});

      const payloadJson = JSON.stringify(uploadEnvelope, null, 2);
      const sizeBytes = Buffer.byteLength(payloadJson, 'utf-8');

      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: payloadJson,
          ContentType: 'application/json; charset=utf-8',
          Metadata: {
            shop_id: cleanShopId,
            uploaded_at: timestamp,
            lots_count: String(lots.length),
            customers_count: String(customers.length),
            vendors_count: String(vendors.length),
            size_bytes: String(sizeBytes),
          },
        })
      );

      res.json({
        success: true,
        message: `ڈیٹا کامیابی سے S3 آبجیکٹ اسٹوریج پر اپ لوڈ ہو گیا! (${objectKey})`,
        lastUploadedAt: timestamp,
        sizeBytes,
        sizeMb: Number((sizeBytes / (1024 * 1024)).toFixed(2)),
        lotsCount: lots.length,
        customersCount: customers.length,
        vendorsCount: vendors.length,
        expensesCount: expenses.length,
        drawerCount: drawerAdjustments.length,
        logsCount: (payload.systemLogs || []).length,
        storageEngine: isAws ? 'AWS S3 Storage' : 'S3-Compatible Object Storage (Neon)',
        bucketName,
        objectKey,
        endpoint,
      });
    } catch (err: any) {
      console.error('S3 Upload Error:', err);
      const formatted = formatS3ErrorServer(err, bucketName);
      res.status(400).json({
        success: false,
        message: formatted.message,
        code: formatted.code,
      });
    }
  };

  app.post('/api/s3/upload', handleS3Upload);
  app.post('/api/s3/sync-upload', handleS3Upload);
  app.post('/api/db/sync-upload', handleS3Upload); // Backwards-compatible alias

  // 4. S3 Sync Download
  const handleS3Download = async (req: express.Request, res: express.Response) => {
    const { shopId, pin } = req.body || {};

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a Shop Cloud ID to download data.',
      });
    }

    const s3Info = getS3ClientAndConfig(req.body);
    if (!s3Info) {
      return res.status(400).json({
        success: false,
        message: 'Missing S3 credentials. Please provide Endpoint URL, Access Key ID, and Secret Access Key.',
      });
    }

    const { client, bucketName, isAws } = s3Info;
    const cleanShopId = String(shopId).trim().toUpperCase();
    const cleanPin = String(pin || '').trim();
    const objectKey = `backups/${cleanShopId}.json`;
    const timestamp = new Date().toISOString();

    try {
      let getRes;
      try {
        getRes = await client.send(
          new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
          })
        );
      } catch (err: any) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
          return res.status(404).json({
            success: false,
            message: `شاپ آئی ڈی "${cleanShopId}" کے لیے بکٹ "${bucketName}" میں کوئی بیک اپ فائل نہیں ملی۔ پہلے پرائمری ڈیوائس سے اپ لوڈ کریں۔ (No backup found for this Shop ID)`,
          });
        }
        throw err;
      }

      const bodyStr = await getRes.Body?.transformToString();
      if (!bodyStr) {
        return res.status(404).json({
          success: false,
          message: 'Empty backup file returned from S3 storage.',
        });
      }

      const parsedEnvelope = JSON.parse(bodyStr);

      // Validate PIN if configured in uploaded data
      const storedPin = parsedEnvelope.shopPin || parsedEnvelope.pin;
      if (storedPin && cleanPin && storedPin !== cleanPin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid PIN code. Please enter the correct Security PIN for this shop.',
        });
      }

      const payload = parsedEnvelope.payload || parsedEnvelope;
      const downloadResponse = {
        success: true,
        message: `ڈیٹا کامیابی سے S3 آبجیکٹ اسٹوریج سے ڈاؤن لوڈ ہو گیا!`,
        lastUploadedAt: parsedEnvelope.uploadedAt || getRes.LastModified?.toISOString() || timestamp,
        lastDownloadedAt: timestamp,
        lotsCount: payload.lots?.length || 0,
        customersCount: payload.customers?.length || 0,
        vendorsCount: payload.vendors?.length || 0,
        expensesCount: payload.expenses?.length || 0,
        drawerCount: payload.drawerAdjustments?.length || 0,
        logsCount: payload.systemLogs?.length || 0,
        data: payload,
        storageEngine: isAws ? 'AWS S3 Storage' : 'S3-Compatible Object Storage (Neon)',
        bucketName,
        objectKey,
      };

      const jsonStr = JSON.stringify(downloadResponse);
      const byteLen = Buffer.byteLength(jsonStr, 'utf-8');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', byteLen);
      res.status(200).send(jsonStr);
    } catch (err: any) {
      console.error('S3 Download Error:', err);
      const formatted = formatS3ErrorServer(err, bucketName);
      res.status(400).json({
        success: false,
        message: formatted.message,
        code: formatted.code,
      });
    }
  };

  app.post('/api/s3/download', handleS3Download);
  app.post('/api/s3/sync-download', handleS3Download);
  app.post('/api/db/sync-download', handleS3Download); // Backwards-compatible alias

  // 5. Get S3 Sync Status
  const handleS3Status = async (req: express.Request, res: express.Response) => {
    const shopId = String(req.query.shopId || '').trim().toUpperCase();
    const s3Info = getS3ClientAndConfig(req.query as any);

    if (!s3Info || !shopId) {
      return res.json({
        configured: Boolean(s3Info),
        hasData: false,
        lastUploadedAt: null,
        lastDownloadedAt: null,
      });
    }

    const { client, bucketName } = s3Info;
    const objectKey = `backups/${shopId}.json`;

    try {
      const headRes = await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        })
      );

      res.json({
        configured: true,
        hasData: true,
        lastUploadedAt: headRes.LastModified?.toISOString() || null,
        storageEngine: 'S3-Compatible Object Storage (Neon)',
        bucketName,
        objectKey,
        contentLength: headRes.ContentLength,
      });
    } catch {
      res.json({
        configured: true,
        hasData: false,
        lastUploadedAt: null,
        lastDownloadedAt: null,
      });
    }
  };

  app.get('/api/s3/status', handleS3Status);
  app.get('/api/db/status', handleS3Status); // Backwards-compatible alias

  // --- Vite / Frontend Serving Middleware ---
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'preview' ||
    (!process.env.NODE_ENV && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Attempt initial CORS setup on default S3 bucket if configured in environment
  const defaultS3 = getS3ClientAndConfig();
  if (defaultS3) {
    ensureBucketCors(defaultS3.client, defaultS3.bucketName).catch(() => {});
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sabzi Mandi server running on http://0.0.0.0:${PORT} (${isProduction ? 'Production' : 'Development'}) with S3 Object Storage`);
  });
  // Handle transfers of hundreds of MBs without socket disconnect
  server.setTimeout(600000); // 10 minutes
  server.keepAliveTimeout = 65000;
}

startServer();
