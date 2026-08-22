import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const PORT = 3000;

// Helper to get PostgreSQL Pool with strict priority for URL from client form input
function getPostgresPool(customUrl?: string): pg.Pool | null {
  const rawUrl = customUrl?.trim() || process.env.DATABASE_URL?.trim();
  if (!rawUrl) {
    return null;
  }

  const connectionString = rawUrl;
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const isSslDisabled = connectionString.includes('sslmode=disable');

  return new Pool({
    connectionString,
    ssl: isLocal || isSslDisabled
      ? false
      : { rejectUnauthorized: false }, // Allows Neon, Supabase, Cloud SQL, Railway, Render
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
    max: 10,
  });
}

// Auto-initialize PostgreSQL tables if not present
async function initializePostgresSchema(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query(`
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

      CREATE TABLE IF NOT EXISTS mandi_sync_logs (
        id SERIAL PRIMARY KEY,
        shop_id VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        lots_count INT DEFAULT 0,
        client_device TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- API Routes ---

  // 1. Health check & PostgreSQL availability
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasEnvDatabaseUrl: Boolean(process.env.DATABASE_URL),
      dbEngine: 'PostgreSQL',
      recommendedUrlFormat: 'postgresql://username:password@host:5432/database?sslmode=require',
    });
  });

  // 2. Test PostgreSQL Database Connection
  app.post('/api/db/test', async (req, res) => {
    const { connectionUrl } = req.body || {};
    const pool = getPostgresPool(connectionUrl);

    if (!pool) {
      return res.status(400).json({
        success: false,
        message: 'No PostgreSQL connection string provided in request or DATABASE_URL env variable.',
        hint: 'Provide a valid PostgreSQL connection URL (e.g. postgresql://user:password@host:5432/dbname)',
      });
    }

    try {
      const client = await pool.connect();
      try {
        const queryRes = await client.query('SELECT NOW() as now, version() as version;');
        await initializePostgresSchema(pool);
        res.json({
          success: true,
          message: 'PostgreSQL connection successful! Database is online and ready.',
          serverTime: queryRes.rows[0]?.now,
          version: queryRes.rows[0]?.version,
          dbEngine: 'PostgreSQL',
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('PostgreSQL Connection Test Failed:', err);
      res.status(500).json({
        success: false,
        message: `PostgreSQL connection error: ${err?.message || 'Failed to connect'}`,
        code: err?.code,
      });
    } finally {
      // Close pool if created temporarily for test
      if (connectionUrl) {
        await pool.end().catch(() => {});
      }
    }
  });

  // 3. PostgreSQL Sync Upload
  app.post('/api/db/sync-upload', async (req, res) => {
    const { shopId, pin, connectionUrl, payload } = req.body || {};

    if (!shopId || !payload) {
      return res.status(400).json({
        success: false,
        message: 'Missing shopId or data payload for upload.',
      });
    }

    const pool = getPostgresPool(connectionUrl);
    if (!pool) {
      return res.status(400).json({
        success: false,
        message: 'No PostgreSQL connection available. Please provide your PostgreSQL URL or configure DATABASE_URL.',
      });
    }

    const cleanShopId = String(shopId).trim().toUpperCase();
    const cleanPin = String(pin || '1234').trim();
    const lots = payload.lots || [];
    const customers = payload.customers || [];
    const vendors = payload.vendors || [];
    const timestamp = new Date().toISOString();
    const clientDevice = req.headers['user-agent'] || 'Web/Mobile Client';

    try {
      await initializePostgresSchema(pool);
      const client = await pool.connect();
      try {
        // Upsert into mandi_sync_data
        const upsertQuery = `
          INSERT INTO mandi_sync_data (
            shop_id, shop_pin, payload, lots_count, customers_count, vendors_count,
            last_uploaded_at, client_device, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7)
          ON CONFLICT (shop_id) DO UPDATE SET
            shop_pin = EXCLUDED.shop_pin,
            payload = EXCLUDED.payload,
            lots_count = EXCLUDED.lots_count,
            customers_count = EXCLUDED.customers_count,
            vendors_count = EXCLUDED.vendors_count,
            last_uploaded_at = EXCLUDED.last_uploaded_at,
            client_device = EXCLUDED.client_device,
            updated_at = EXCLUDED.updated_at
          RETURNING last_uploaded_at, last_downloaded_at;
        `;

        const result = await client.query(upsertQuery, [
          cleanShopId,
          cleanPin,
          JSON.stringify(payload),
          lots.length,
          customers.length,
          vendors.length,
          timestamp,
          clientDevice,
        ]);

        // Log upload activity
        await client.query(
          `INSERT INTO mandi_sync_logs (shop_id, action, lots_count, client_device) VALUES ($1, $2, $3, $4)`,
          [cleanShopId, 'UPLOAD', lots.length, clientDevice]
        );

        const row = result.rows[0];
        res.json({
          success: true,
          message: 'Data successfully uploaded and synced with PostgreSQL database!',
          lastUploadedAt: row?.last_uploaded_at || timestamp,
          lastDownloadedAt: row?.last_downloaded_at || null,
          lotsCount: lots.length,
          customersCount: customers.length,
          vendorsCount: vendors.length,
          dbEngine: 'PostgreSQL',
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('PostgreSQL Upload Error:', err);
      res.status(500).json({
        success: false,
        message: `PostgreSQL Upload Error: ${err?.message || 'Failed to save to database'}`,
      });
    } finally {
      if (connectionUrl) {
        await pool.end().catch(() => {});
      }
    }
  });

  // 4. PostgreSQL Sync Download
  app.post('/api/db/sync-download', async (req, res) => {
    const { shopId, pin, connectionUrl } = req.body || {};

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a Shop Cloud ID to download data.',
      });
    }

    const pool = getPostgresPool(connectionUrl);
    if (!pool) {
      return res.status(400).json({
        success: false,
        message: 'No PostgreSQL connection available. Please provide your PostgreSQL URL or configure DATABASE_URL.',
      });
    }

    const cleanShopId = String(shopId).trim().toUpperCase();
    const cleanPin = String(pin || '').trim();
    const clientDevice = req.headers['user-agent'] || 'Web/Mobile Client';
    const timestamp = new Date().toISOString();

    try {
      await initializePostgresSchema(pool);
      const client = await pool.connect();
      try {
        const queryRes = await client.query(
          `SELECT shop_id, shop_pin, payload, lots_count, customers_count, vendors_count, last_uploaded_at, last_downloaded_at
           FROM mandi_sync_data WHERE shop_id = $1`,
          [cleanShopId]
        );

        if (queryRes.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: `No data found in PostgreSQL database for Shop ID: "${cleanShopId}". Please upload data first from your primary device.`,
          });
        }

        const row = queryRes.rows[0];

        // Validate PIN if configured on row
        if (row.shop_pin && cleanPin && row.shop_pin !== cleanPin) {
          return res.status(401).json({
            success: false,
            message: 'Invalid PIN code. Please enter the correct Security PIN for this shop.',
          });
        }

        // Update last_downloaded_at timestamp
        await client.query(
          `UPDATE mandi_sync_data SET last_downloaded_at = $1 WHERE shop_id = $2`,
          [timestamp, cleanShopId]
        );

        // Log download activity
        await client.query(
          `INSERT INTO mandi_sync_logs (shop_id, action, lots_count, client_device) VALUES ($1, $2, $3, $4)`,
          [cleanShopId, 'DOWNLOAD', row.lots_count || 0, clientDevice]
        );

        let parsedPayload = row.payload;
        if (typeof parsedPayload === 'string') {
          try {
            parsedPayload = JSON.parse(parsedPayload);
          } catch {
            // keep as is
          }
        }

        res.json({
          success: true,
          message: 'Data successfully downloaded from PostgreSQL database!',
          lastUploadedAt: row.last_uploaded_at,
          lastDownloadedAt: timestamp,
          lotsCount: row.lots_count,
          customersCount: row.customers_count,
          vendorsCount: row.vendors_count,
          data: parsedPayload,
          dbEngine: 'PostgreSQL',
        });
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.error('PostgreSQL Download Error:', err);
      res.status(500).json({
        success: false,
        message: `PostgreSQL Download Error: ${err?.message || 'Failed to download data'}`,
      });
    } finally {
      if (connectionUrl) {
        await pool.end().catch(() => {});
      }
    }
  });

  // 5. Get DB Sync Status and Last Upload/Download Timestamps
  app.get('/api/db/status', async (req, res) => {
    const shopId = String(req.query.shopId || '').trim().toUpperCase();
    const customUrl = req.query.connectionUrl ? String(req.query.connectionUrl) : undefined;
    const pool = getPostgresPool(customUrl);

    if (!pool || !shopId) {
      return res.json({
        configured: Boolean(pool),
        hasData: false,
        lastUploadedAt: null,
        lastDownloadedAt: null,
      });
    }

    try {
      const client = await pool.connect();
      try {
        const queryRes = await client.query(
          `SELECT shop_id, lots_count, customers_count, vendors_count, last_uploaded_at, last_downloaded_at
           FROM mandi_sync_data WHERE shop_id = $1`,
          [shopId]
        );

        if (queryRes.rows.length === 0) {
          return res.json({
            configured: true,
            hasData: false,
            lastUploadedAt: null,
            lastDownloadedAt: null,
          });
        }

        const row = queryRes.rows[0];
        res.json({
          configured: true,
          hasData: true,
          lastUploadedAt: row.last_uploaded_at,
          lastDownloadedAt: row.last_downloaded_at,
          lotsCount: row.lots_count,
          customersCount: row.customers_count,
          vendorsCount: row.vendors_count,
          dbEngine: 'PostgreSQL',
        });
      } finally {
        client.release();
      }
    } catch (err) {
      res.json({
        configured: true,
        hasData: false,
        error: String(err),
      });
    } finally {
      if (customUrl) {
        await pool.end().catch(() => {});
      }
    }
  });

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sabzi Mandi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
