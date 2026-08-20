var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_pg = __toESM(require("pg"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var { Pool } = import_pg.default;
var PORT = 3e3;
function getPostgresPool(customUrl) {
  const connectionString = customUrl?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    return null;
  }
  return new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    // Allows Supabase, Neon, AWS RDS, Cloud SQL SSL connections
    connectionTimeoutMillis: 1e4,
    idleTimeoutMillis: 3e4,
    max: 10
  });
}
async function initializePostgresSchema(pool) {
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
  const app = (0, import_express.default)();
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasEnvDatabaseUrl: Boolean(process.env.DATABASE_URL),
      dbEngine: "PostgreSQL",
      recommendedUrlFormat: "postgresql://username:password@host:5432/database?sslmode=require"
    });
  });
  app.post("/api/db/test", async (req, res) => {
    const { connectionUrl } = req.body || {};
    const pool = getPostgresPool(connectionUrl);
    if (!pool) {
      return res.status(400).json({
        success: false,
        message: "No PostgreSQL connection string provided in request or DATABASE_URL env variable.",
        hint: "Provide a valid PostgreSQL connection URL (e.g. postgresql://user:password@host:5432/dbname)"
      });
    }
    try {
      const client = await pool.connect();
      try {
        const queryRes = await client.query("SELECT NOW() as now, version() as version;");
        await initializePostgresSchema(pool);
        res.json({
          success: true,
          message: "PostgreSQL connection successful! Database is online and ready.",
          serverTime: queryRes.rows[0]?.now,
          version: queryRes.rows[0]?.version,
          dbEngine: "PostgreSQL"
        });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("PostgreSQL Connection Test Failed:", err);
      res.status(500).json({
        success: false,
        message: `PostgreSQL connection error: ${err?.message || "Failed to connect"}`,
        code: err?.code
      });
    } finally {
      if (connectionUrl) {
        await pool.end().catch(() => {
        });
      }
    }
  });
  app.post("/api/db/sync-upload", async (req, res) => {
    const { shopId, pin, connectionUrl, payload } = req.body || {};
    if (!shopId || !payload) {
      return res.status(400).json({
        success: false,
        message: "Missing shopId or data payload for upload."
      });
    }
    const pool = getPostgresPool(connectionUrl);
    if (!pool) {
      return res.status(400).json({
        success: false,
        message: "No PostgreSQL connection available. Please provide your PostgreSQL URL or configure DATABASE_URL."
      });
    }
    const cleanShopId = String(shopId).trim().toUpperCase();
    const cleanPin = String(pin || "1234").trim();
    const lots = payload.lots || [];
    const customers = payload.customers || [];
    const vendors = payload.vendors || [];
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const clientDevice = req.headers["user-agent"] || "Web/Mobile Client";
    try {
      await initializePostgresSchema(pool);
      const client = await pool.connect();
      try {
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
          clientDevice
        ]);
        await client.query(
          `INSERT INTO mandi_sync_logs (shop_id, action, lots_count, client_device) VALUES ($1, $2, $3, $4)`,
          [cleanShopId, "UPLOAD", lots.length, clientDevice]
        );
        const row = result.rows[0];
        res.json({
          success: true,
          message: "Data successfully uploaded and synced with PostgreSQL database!",
          lastUploadedAt: row?.last_uploaded_at || timestamp,
          lastDownloadedAt: row?.last_downloaded_at || null,
          lotsCount: lots.length,
          customersCount: customers.length,
          vendorsCount: vendors.length,
          dbEngine: "PostgreSQL"
        });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("PostgreSQL Upload Error:", err);
      res.status(500).json({
        success: false,
        message: `PostgreSQL Upload Error: ${err?.message || "Failed to save to database"}`
      });
    } finally {
      if (connectionUrl) {
        await pool.end().catch(() => {
        });
      }
    }
  });
  app.post("/api/db/sync-download", async (req, res) => {
    const { shopId, pin, connectionUrl } = req.body || {};
    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: "Please provide a Shop Cloud ID to download data."
      });
    }
    const pool = getPostgresPool(connectionUrl);
    if (!pool) {
      return res.status(400).json({
        success: false,
        message: "No PostgreSQL connection available. Please provide your PostgreSQL URL or configure DATABASE_URL."
      });
    }
    const cleanShopId = String(shopId).trim().toUpperCase();
    const cleanPin = String(pin || "").trim();
    const clientDevice = req.headers["user-agent"] || "Web/Mobile Client";
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
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
            message: `No data found in PostgreSQL database for Shop ID: "${cleanShopId}". Please upload data first from your primary device.`
          });
        }
        const row = queryRes.rows[0];
        if (row.shop_pin && cleanPin && row.shop_pin !== cleanPin) {
          return res.status(401).json({
            success: false,
            message: "Invalid PIN code. Please enter the correct Security PIN for this shop."
          });
        }
        await client.query(
          `UPDATE mandi_sync_data SET last_downloaded_at = $1 WHERE shop_id = $2`,
          [timestamp, cleanShopId]
        );
        await client.query(
          `INSERT INTO mandi_sync_logs (shop_id, action, lots_count, client_device) VALUES ($1, $2, $3, $4)`,
          [cleanShopId, "DOWNLOAD", row.lots_count || 0, clientDevice]
        );
        let parsedPayload = row.payload;
        if (typeof parsedPayload === "string") {
          try {
            parsedPayload = JSON.parse(parsedPayload);
          } catch {
          }
        }
        res.json({
          success: true,
          message: "Data successfully downloaded from PostgreSQL database!",
          lastUploadedAt: row.last_uploaded_at,
          lastDownloadedAt: timestamp,
          lotsCount: row.lots_count,
          customersCount: row.customers_count,
          vendorsCount: row.vendors_count,
          data: parsedPayload,
          dbEngine: "PostgreSQL"
        });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("PostgreSQL Download Error:", err);
      res.status(500).json({
        success: false,
        message: `PostgreSQL Download Error: ${err?.message || "Failed to download data"}`
      });
    } finally {
      if (connectionUrl) {
        await pool.end().catch(() => {
        });
      }
    }
  });
  app.get("/api/db/status", async (req, res) => {
    const shopId = String(req.query.shopId || "").trim().toUpperCase();
    const customUrl = req.query.connectionUrl ? String(req.query.connectionUrl) : void 0;
    const pool = getPostgresPool(customUrl);
    if (!pool || !shopId) {
      return res.json({
        configured: Boolean(pool),
        hasData: false,
        lastUploadedAt: null,
        lastDownloadedAt: null
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
            lastDownloadedAt: null
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
          dbEngine: "PostgreSQL"
        });
      } finally {
        client.release();
      }
    } catch (err) {
      res.json({
        configured: true,
        hasData: false,
        error: String(err)
      });
    } finally {
      if (customUrl) {
        await pool.end().catch(() => {
        });
      }
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sabzi Mandi server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
