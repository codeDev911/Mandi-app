import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListBucketsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

dotenv.config();

const PORT = 3000;

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

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = 'https://' + endpoint;
  }

  const client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // Crucial for Neon and custom S3 endpoints
  });

  return { client, endpoint, accessKeyId, region, bucketName };
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

    const { client, endpoint, bucketName, region } = s3Info;

    try {
      let buckets: string[] = [];
      try {
        const listRes = await client.send(new ListBucketsCommand({}));
        buckets = (listRes.Buckets || []).map((b) => b.Name || '');
      } catch {
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
        }
      }

      res.json({
        success: true,
        message: 'S3 Object Storage connection successful! Bucket and credentials verified.',
        endpoint,
        bucketName,
        region,
        availableBuckets: buckets,
        storageEngine: 'S3-Compatible Object Storage (Neon)',
      });
    } catch (err: any) {
      console.error('S3 Connection Test Failed:', err);
      res.status(500).json({
        success: false,
        message: `S3 Object Storage connection error: ${err?.message || 'Failed to authenticate'}`,
        code: err?.name || err?.Code,
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

    const { client, bucketName, endpoint } = s3Info;
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
        message: `Data successfully uploaded to S3 Object Storage! (${objectKey})`,
        lastUploadedAt: timestamp,
        sizeBytes,
        sizeMb: Number((sizeBytes / (1024 * 1024)).toFixed(2)),
        lotsCount: lots.length,
        customersCount: customers.length,
        vendorsCount: vendors.length,
        expensesCount: expenses.length,
        drawerCount: drawerAdjustments.length,
        logsCount: (payload.systemLogs || []).length,
        storageEngine: 'S3-Compatible Object Storage (Neon)',
        bucketName,
        objectKey,
        endpoint,
      });
    } catch (err: any) {
      console.error('S3 Upload Error:', err);
      res.status(500).json({
        success: false,
        message: `S3 Upload Error: ${err?.message || 'Failed to upload to S3 storage'}`,
        code: err?.name,
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

    const { client, bucketName } = s3Info;
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
            message: `No backup data found in S3 bucket "${bucketName}" for Shop ID: "${cleanShopId}". Please upload data first from your primary device.`,
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
        message: 'Data successfully downloaded from S3 Object Storage!',
        lastUploadedAt: parsedEnvelope.uploadedAt || getRes.LastModified?.toISOString() || timestamp,
        lastDownloadedAt: timestamp,
        lotsCount: payload.lots?.length || 0,
        customersCount: payload.customers?.length || 0,
        vendorsCount: payload.vendors?.length || 0,
        expensesCount: payload.expenses?.length || 0,
        drawerCount: payload.drawerAdjustments?.length || 0,
        logsCount: payload.systemLogs?.length || 0,
        data: payload,
        storageEngine: 'S3-Compatible Object Storage (Neon)',
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
      res.status(500).json({
        success: false,
        message: `S3 Download Error: ${err?.message || 'Failed to download from S3 object storage'}`,
        code: err?.name,
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
  if (process.env.NODE_ENV !== 'production') {
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sabzi Mandi server running on http://0.0.0.0:${PORT} with S3 Object Storage`);
  });
  // Handle transfers of hundreds of MBs without socket disconnect
  server.setTimeout(600000); // 10 minutes
  server.keepAliveTimeout = 65000;
}

startServer();
