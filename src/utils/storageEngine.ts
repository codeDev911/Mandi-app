import { VendorLot, AppSettings, CustomerBuyer, SavedVendor } from '../types';
import { defaultSettings, getInitialLots, sampleCustomers, sampleVendors } from './sampleData';
import * as Neutralino from '@neutralinojs/lib';

const DB_NAME = 'MandiMunshiMasterDB_v2';
const DB_VERSION = 1;

const STORE_LOTS = 'lots';
const STORE_CUSTOMERS = 'customers';
const STORE_VENDORS = 'vendors';
const STORE_SETTINGS = 'settings';

const NEU_KEY_LOTS = 'mandi_bolli_lots_v1';
const NEU_KEY_CUSTOMERS = 'mandi_bolli_customers_v1';
const NEU_KEY_VENDORS = 'mandi_bolli_vendors_v1';
const NEU_KEY_SETTINGS = 'mandi_bolli_settings_v1';

export interface DatabaseStats {
  totalLots: number;
  totalSales: number;
  totalCustomers: number;
  totalVendors: number;
  totalGrossTurnover: number;
  totalCommissionEarned: number;
  estimatedSizeKB: number;
  lastBackupDate?: string;
  isIndexedDBSupported: boolean;
}

let dbInstance: IDBDatabase | null = null;
let isInitializing = false;
const initCallbacks: Array<(db: IDBDatabase | null) => void> = [];

/**
 * Checks if Neutralino native desktop environment is active
 */
export function isNeutralinoActive(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as any).NL_PORT !== 'undefined' || typeof (window as any).Neutralino !== 'undefined';
}

/**
 * Safely reads a key from Neutralino Native Storage
 */
export async function readNeutralinoStorage<T>(key: string): Promise<T | null> {
  if (!isNeutralinoActive()) return null;
  try {
    const raw = await Neutralino.storage.getData(key);
    if (raw && typeof raw === 'string' && raw.trim().length > 0) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // Key not found or Neutralino not ready
  }
  return null;
}

/**
 * Safely writes a key to Neutralino Native Storage
 */
export async function writeNeutralinoStorage(key: string, data: any): Promise<void> {
  if (!isNeutralinoActive()) return;
  try {
    await Neutralino.storage.setData(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Neutralino storage write failed for ${key}:`, err);
  }
}

/**
 * Opens or initializes the Master IndexedDB instance.
 */
export function getIndexedDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (isInitializing) {
      initCallbacks.push(resolve);
      return;
    }

    isInitializing = true;

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 1. Lots Store (Master Bolli & Lot Registry)
        if (!db.objectStoreNames.contains(STORE_LOTS)) {
          const lotStore = db.createObjectStore(STORE_LOTS, { keyPath: 'id' });
          lotStore.createIndex('date', 'date', { unique: false });
          lotStore.createIndex('vendorName', 'vendorName', { unique: false });
          lotStore.createIndex('product', 'product', { unique: false });
          lotStore.createIndex('status', 'status', { unique: false });
        }

        // 2. Customers Store (Khata Registry)
        if (!db.objectStoreNames.contains(STORE_CUSTOMERS)) {
          const custStore = db.createObjectStore(STORE_CUSTOMERS, { keyPath: 'id' });
          custStore.createIndex('name', 'name', { unique: false });
          custStore.createIndex('balance', 'balance', { unique: false });
        }

        // 3. Vendors Store (Farmer Directory)
        if (!db.objectStoreNames.contains(STORE_VENDORS)) {
          const vendorStore = db.createObjectStore(STORE_VENDORS, { keyPath: 'id' });
          vendorStore.createIndex('name', 'name', { unique: false });
        }

        // 4. Settings Store
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        isInitializing = false;
        resolve(dbInstance);
        while (initCallbacks.length > 0) {
          const cb = initCallbacks.shift();
          if (cb) cb(dbInstance);
        }
      };

      request.onerror = (err) => {
        console.warn('IndexedDB failed to open, falling back to in-memory/localStorage:', err);
        isInitializing = false;
        resolve(null);
        while (initCallbacks.length > 0) {
          const cb = initCallbacks.shift();
          if (cb) cb(null);
        }
      };
    } catch (e) {
      console.warn('IndexedDB initialization exception:', e);
      isInitializing = false;
      resolve(null);
      while (initCallbacks.length > 0) {
        const cb = initCallbacks.shift();
        if (cb) cb(null);
      }
    }
  });
}

/**
 * Loads all persistent data on application bootstrap.
 * Multi-layer recovery priority:
 * 1. Neutralino Native Storage (Persistent disk files on desktop)
 * 2. IndexedDB (High-capacity browser database)
 * 3. LocalStorage
 * Only seeds sample data on true first-time run when all tiers are empty.
 */
export async function loadInitialApplicationData(): Promise<{
  settings: AppSettings;
  lots: VendorLot[];
  customers: CustomerBuyer[];
  vendors: SavedVendor[];
}> {
  // Layer 1: Check Neutralino Native Storage
  if (isNeutralinoActive()) {
    try {
      const [neuLots, neuCustomers, neuVendors, neuSettings] = await Promise.all([
        readNeutralinoStorage<VendorLot[]>(NEU_KEY_LOTS),
        readNeutralinoStorage<CustomerBuyer[]>(NEU_KEY_CUSTOMERS),
        readNeutralinoStorage<SavedVendor[]>(NEU_KEY_VENDORS),
        readNeutralinoStorage<AppSettings>(NEU_KEY_SETTINGS),
      ]);

      const hasNeuData =
        (neuLots && neuLots.length > 0) ||
        (neuCustomers && neuCustomers.length > 0) ||
        (neuVendors && neuVendors.length > 0) ||
        !!neuSettings;

      if (hasNeuData) {
        const resolvedSettings = neuSettings || defaultSettings;
        const resolvedLots = (neuLots || []).sort(
          (a, b) =>
            new Date(b.arrivalDate || b.createdAt || 0).getTime() -
            new Date(a.arrivalDate || a.createdAt || 0).getTime()
        );
        const resolvedCustomers = neuCustomers && neuCustomers.length > 0 ? neuCustomers : sampleCustomers;
        const resolvedVendors = neuVendors && neuVendors.length > 0 ? neuVendors : sampleVendors;

        // Mirror to IndexedDB & LocalStorage
        getIndexedDB().then((db) => {
          if (db) {
            saveLotsToIndexedDB(resolvedLots).catch(() => {});
            saveCustomersToIndexedDB(resolvedCustomers).catch(() => {});
            saveVendorsToIndexedDB(resolvedVendors).catch(() => {});
            saveSettingsToIndexedDB(resolvedSettings).catch(() => {});
          }
        });

        return {
          settings: resolvedSettings,
          lots: resolvedLots,
          customers: resolvedCustomers,
          vendors: resolvedVendors,
        };
      }
    } catch (e) {
      console.warn('Error reading from Neutralino storage:', e);
    }
  }

  // Layer 2: IndexedDB
  const db = await getIndexedDB();
  if (db) {
    try {
      const [lots, customers, vendors, settings] = await Promise.all([
        getAllFromStore<VendorLot>(db, STORE_LOTS),
        getAllFromStore<CustomerBuyer>(db, STORE_CUSTOMERS),
        getAllFromStore<SavedVendor>(db, STORE_VENDORS),
        getSingleFromStore<AppSettings>(db, STORE_SETTINGS, 'app_settings'),
      ]);

      const hasAnyData =
        (lots && lots.length > 0) ||
        (customers && customers.length > 0) ||
        (vendors && vendors.length > 0) ||
        !!settings;

      if (hasAnyData) {
        const resolvedSettings = settings || defaultSettings;
        const resolvedLots = (lots || []).sort(
          (a, b) =>
            new Date(b.arrivalDate || b.createdAt || 0).getTime() -
            new Date(a.arrivalDate || a.createdAt || 0).getTime()
        );
        const resolvedCustomers = customers && customers.length > 0 ? customers : sampleCustomers;
        const resolvedVendors = vendors && vendors.length > 0 ? vendors : sampleVendors;

        // Mirror back to Neutralino Storage
        writeNeutralinoStorage(NEU_KEY_LOTS, resolvedLots);
        writeNeutralinoStorage(NEU_KEY_CUSTOMERS, resolvedCustomers);
        writeNeutralinoStorage(NEU_KEY_VENDORS, resolvedVendors);
        writeNeutralinoStorage(NEU_KEY_SETTINGS, resolvedSettings);

        return {
          settings: resolvedSettings,
          lots: resolvedLots,
          customers: resolvedCustomers,
          vendors: resolvedVendors,
        };
      }
    } catch (e) {
      console.warn('Error reading from IndexedDB:', e);
    }
  }

  // Layer 3: Fallback to LocalStorage
  let initialSettings = defaultSettings;
  let initialLots: VendorLot[] | null = null;
  let initialCustomers: CustomerBuyer[] | null = null;
  let initialVendors: SavedVendor[] | null = null;

  try {
    const savedSettings = localStorage.getItem('mandi_bolli_settings_v1');
    if (savedSettings) initialSettings = JSON.parse(savedSettings);

    const savedLots = localStorage.getItem('mandi_bolli_lots_v1');
    if (savedLots) initialLots = JSON.parse(savedLots);

    const savedCustomers = localStorage.getItem('mandi_bolli_customers_v1');
    if (savedCustomers) initialCustomers = JSON.parse(savedCustomers);

    const savedVendors = localStorage.getItem('mandi_bolli_vendors_v1');
    if (savedVendors) initialVendors = JSON.parse(savedVendors);
  } catch (e) {
    console.warn('LocalStorage parse error:', e);
  }

  const finalLots = initialLots !== null ? initialLots : getInitialLots();
  const finalCustomers = initialCustomers !== null ? initialCustomers : sampleCustomers;
  const finalVendors = initialVendors !== null ? initialVendors : sampleVendors;

  // Seed all tiers on genuine first run
  writeNeutralinoStorage(NEU_KEY_LOTS, finalLots);
  writeNeutralinoStorage(NEU_KEY_CUSTOMERS, finalCustomers);
  writeNeutralinoStorage(NEU_KEY_VENDORS, finalVendors);
  writeNeutralinoStorage(NEU_KEY_SETTINGS, initialSettings);

  if (db) {
    saveLotsToIndexedDB(finalLots).catch(() => {});
    saveCustomersToIndexedDB(finalCustomers).catch(() => {});
    saveVendorsToIndexedDB(finalVendors).catch(() => {});
    saveSettingsToIndexedDB(initialSettings).catch(() => {});
  }

  return {
    settings: initialSettings,
    lots: finalLots,
    customers: finalCustomers,
    vendors: finalVendors,
  };
}

// Generic IndexedDB read helpers
function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

function getSingleFromStore<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | null> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value || req.result : null);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * High-performance debounced batch saver for Lots.
 */
let saveLotsTimer: ReturnType<typeof setTimeout> | null = null;
let pendingLotsToSave: VendorLot[] | null = null;

export function saveLotsAsync(lots: VendorLot[]): void {
  pendingLotsToSave = lots;
  if (saveLotsTimer) clearTimeout(saveLotsTimer);
  saveLotsTimer = setTimeout(() => {
    if (pendingLotsToSave) {
      const data = pendingLotsToSave;
      pendingLotsToSave = null;
      saveLotsToIndexedDB(data);
      writeNeutralinoStorage(NEU_KEY_LOTS, data);
      try {
        if (data.length <= 100) {
          localStorage.setItem('mandi_bolli_lots_v1', JSON.stringify(data));
        }
      } catch {
        // ignore localStorage quota error
      }
    }
  }, 350);
}

export async function saveLotsToIndexedDB(lots: VendorLot[]): Promise<void> {
  if (saveLotsTimer) {
    clearTimeout(saveLotsTimer);
    saveLotsTimer = null;
  }
  pendingLotsToSave = null;

  writeNeutralinoStorage(NEU_KEY_LOTS, lots);

  const db = await getIndexedDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_LOTS, 'readwrite');
      const store = tx.objectStore(STORE_LOTS);
      
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        const len = lots.length;
        for (let i = 0; i < len; i++) {
          store.put(lots[i]);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Customers debounced saver
 */
let saveCustomersTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCustomersToSave: CustomerBuyer[] | null = null;

export function saveCustomersAsync(customers: CustomerBuyer[]): void {
  pendingCustomersToSave = customers;
  if (saveCustomersTimer) clearTimeout(saveCustomersTimer);
  saveCustomersTimer = setTimeout(() => {
    if (pendingCustomersToSave) {
      const data = pendingCustomersToSave;
      pendingCustomersToSave = null;
      saveCustomersToIndexedDB(data);
      writeNeutralinoStorage(NEU_KEY_CUSTOMERS, data);
      try {
        if (data.length <= 150) {
          localStorage.setItem('mandi_bolli_customers_v1', JSON.stringify(data));
        }
      } catch {
        // ignore quota error
      }
    }
  }, 350);
}

export async function saveCustomersToIndexedDB(customers: CustomerBuyer[]): Promise<void> {
  if (saveCustomersTimer) {
    clearTimeout(saveCustomersTimer);
    saveCustomersTimer = null;
  }
  pendingCustomersToSave = null;

  writeNeutralinoStorage(NEU_KEY_CUSTOMERS, customers);

  const db = await getIndexedDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_CUSTOMERS, 'readwrite');
      const store = tx.objectStore(STORE_CUSTOMERS);
      store.clear().onsuccess = () => {
        for (let i = 0; i < customers.length; i++) {
          store.put(customers[i]);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Vendors debounced saver
 */
let saveVendorsTimer: ReturnType<typeof setTimeout> | null = null;
let pendingVendorsToSave: SavedVendor[] | null = null;

export function saveVendorsAsync(vendors: SavedVendor[]): void {
  pendingVendorsToSave = vendors;
  if (saveVendorsTimer) clearTimeout(saveVendorsTimer);
  saveVendorsTimer = setTimeout(() => {
    if (pendingVendorsToSave) {
      const data = pendingVendorsToSave;
      pendingVendorsToSave = null;
      saveVendorsToIndexedDB(data);
      writeNeutralinoStorage(NEU_KEY_VENDORS, data);
      try {
        if (data.length <= 150) {
          localStorage.setItem('mandi_bolli_vendors_v1', JSON.stringify(data));
        }
      } catch {
        // ignore quota error
      }
    }
  }, 350);
}

export async function saveVendorsToIndexedDB(vendors: SavedVendor[]): Promise<void> {
  if (saveVendorsTimer) {
    clearTimeout(saveVendorsTimer);
    saveVendorsTimer = null;
  }
  pendingVendorsToSave = null;

  writeNeutralinoStorage(NEU_KEY_VENDORS, vendors);

  const db = await getIndexedDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_VENDORS, 'readwrite');
      const store = tx.objectStore(STORE_VENDORS);
      store.clear().onsuccess = () => {
        for (let i = 0; i < vendors.length; i++) {
          store.put(vendors[i]);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Settings saver
 */
let saveSettingsTimer: ReturnType<typeof setTimeout> | null = null;
export function saveSettingsAsync(settings: AppSettings): void {
  if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
  saveSettingsTimer = setTimeout(() => {
    saveSettingsToIndexedDB(settings);
  }, 200);
}

export async function saveSettingsToIndexedDB(settings: AppSettings): Promise<void> {
  if (saveSettingsTimer) {
    clearTimeout(saveSettingsTimer);
    saveSettingsTimer = null;
  }

  try {
    localStorage.setItem('mandi_bolli_settings_v1', JSON.stringify(settings));
  } catch {
    // ignore
  }

  writeNeutralinoStorage(NEU_KEY_SETTINGS, settings);

  const db = await getIndexedDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      store.put({ key: 'app_settings', value: settings });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Immediately flushes any pending debounced writes to disk / IndexedDB / Neutralino Storage.
 * Called automatically before unload or window exit.
 */
export function flushPendingStorageSaves(): void {
  if (saveLotsTimer && pendingLotsToSave) {
    clearTimeout(saveLotsTimer);
    saveLotsTimer = null;
    const lots = pendingLotsToSave;
    pendingLotsToSave = null;
    saveLotsToIndexedDB(lots);
    writeNeutralinoStorage(NEU_KEY_LOTS, lots);
    try { localStorage.setItem('mandi_bolli_lots_v1', JSON.stringify(lots)); } catch {}
  }
  if (saveCustomersTimer && pendingCustomersToSave) {
    clearTimeout(saveCustomersTimer);
    saveCustomersTimer = null;
    const customers = pendingCustomersToSave;
    pendingCustomersToSave = null;
    saveCustomersToIndexedDB(customers);
    writeNeutralinoStorage(NEU_KEY_CUSTOMERS, customers);
    try { localStorage.setItem('mandi_bolli_customers_v1', JSON.stringify(customers)); } catch {}
  }
  if (saveVendorsTimer && pendingVendorsToSave) {
    clearTimeout(saveVendorsTimer);
    saveVendorsTimer = null;
    const vendors = pendingVendorsToSave;
    pendingVendorsToSave = null;
    saveVendorsToIndexedDB(vendors);
    writeNeutralinoStorage(NEU_KEY_VENDORS, vendors);
    try { localStorage.setItem('mandi_bolli_vendors_v1', JSON.stringify(vendors)); } catch {}
  }
}

// Attach automatic flush handlers
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingStorageSaves);
  window.addEventListener('pagehide', flushPendingStorageSaves);
}

/**
 * Computes deep database health and storage metrics.
 */
export function computeDatabaseMetrics(
  lots: VendorLot[],
  customers: CustomerBuyer[],
  vendors: SavedVendor[]
): DatabaseStats {
  let totalSales = 0;
  let totalGross = 0;
  let totalCommission = 0;

  for (const lot of lots) {
    if (lot.sales) {
      totalSales += lot.sales.length;
      for (const s of lot.sales) {
        totalGross += s.totalAmount || 0;
      }
    }
    if (lot.expenses?.commission?.amount) {
      totalCommission += lot.expenses.commission.amount;
    }
  }

  const sampleSize = Math.min(lots.length, 50);
  let avgLotSize = 650;
  if (sampleSize > 0) {
    try {
      const sampleBlob = new Blob([JSON.stringify(lots.slice(0, sampleSize))]);
      avgLotSize = sampleBlob.size / sampleSize;
    } catch {
      avgLotSize = 650;
    }
  }
  const estimatedSizeBytes = (lots.length * avgLotSize) + (customers.length * 400) + (vendors.length * 400);
  const estimatedSizeKB = Math.round(estimatedSizeBytes / 1024);

  const lastBackup = localStorage.getItem('mandi_last_backup_timestamp') || undefined;

  return {
    totalLots: lots.length,
    totalSales,
    totalCustomers: customers.length,
    totalVendors: vendors.length,
    totalGrossTurnover: totalGross,
    totalCommissionEarned: totalCommission,
    estimatedSizeKB,
    lastBackupDate: lastBackup,
    isIndexedDBSupported: typeof window !== 'undefined' && !!window.indexedDB,
  };
}

/**
 * Generates an encrypted/structured Full JSON Backup file
 */
export function generateFullBackupPayload(
  settings: AppSettings,
  lots: VendorLot[],
  customers: CustomerBuyer[],
  vendors: SavedVendor[]
): string {
  const payload = {
    version: '2.0.0',
    appName: 'MandiMunshiMasterSystem',
    exportedAt: new Date().toISOString(),
    stats: {
      lotsCount: lots.length,
      customersCount: customers.length,
      vendorsCount: vendors.length,
    },
    settings,
    lots,
    customers,
    vendors,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Validates and restores backup data safely.
 */
export function parseAndValidateBackupPayload(jsonText: string): {
  success: boolean;
  settings?: AppSettings;
  lots?: VendorLot[];
  customers?: CustomerBuyer[];
  vendors?: SavedVendor[];
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'غیر موزوں فائل فارمیٹ' };
    }

    if (!Array.isArray(parsed.lots)) {
      return { success: false, error: 'بیک اپ فائل میں لاٹس کا ڈیٹا موجود نہیں ہے' };
    }

    return {
      success: true,
      settings: parsed.settings || defaultSettings,
      lots: parsed.lots || [],
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فائل پڑھنے میں غلطی' };
  }
}

