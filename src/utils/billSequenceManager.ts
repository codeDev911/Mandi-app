import { VendorLot } from '../types';

/**
 * Daily Sequential Bill/Receipt Number Manager for Insaf Mandi
 * 
 * Rules:
 * 1. Each day starts at receipt #1.
 * 2. All lots belonging to the same vendor on the same day share the EXACT SAME receipt number.
 *    (e.g., Vendor A has 4 lots today -> all 4 lots are under receipt #1.
 *     Vendor B has 2 lots today -> all 2 lots are under receipt #2).
 * 3. When a new day arrives (date changes), the sequence resets to start from #1 again.
 */

export interface DailyVendorSequenceRecord {
  lastNumber: number;
  vendors: Record<string, number>; // normalized vendor name -> daily receipt number (1, 2, 3...)
}

const STORAGE_KEY_VENDOR_SEQ = 'mandi_bolli_daily_vendor_sequence_v2';
const STORAGE_KEY_LEGACY_BILL_SEQ = 'mandi_bolli_daily_bill_sequence_v1';

/**
 * Returns today's local date string formatted as YYYY-MM-DD
 */
export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes any input date or arrival date into YYYY-MM-DD, falling back to today
 */
export function normalizeDateKey(dateInput?: string): string {
  if (!dateInput) return getTodayDateKey();
  const trimmed = dateInput.trim();
  // Check if format is already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // Try parsing date
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return getTodayDateKey();
}

/**
 * Loads all daily vendor sequences from localStorage
 */
function loadAllDailySequences(): Record<string, DailyVendorSequenceRecord> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_VENDOR_SEQ);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error('Error loading daily vendor sequence store:', err);
  }
  return {};
}

/**
 * Saves all daily vendor sequences to localStorage
 */
function saveAllDailySequences(data: Record<string, DailyVendorSequenceRecord>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_VENDOR_SEQ, JSON.stringify(data));
    }
  } catch (err) {
    console.error('Error saving daily vendor sequence store:', err);
  }
}

/**
 * Gets or assigns a daily receipt number for a specific vendor on a specific date.
 * - Same vendor on same date ALWAYS gets the same receipt number.
 * - If vendor is new for this date, gets next sequential number (starts from 1 each new day).
 */
export function getOrAssignVendorDailyReceiptNumber(
  vendorName: string,
  targetDate?: string,
  existingLots?: VendorLot[]
): number {
  const dateKey = normalizeDateKey(targetDate);
  const cleanVendor = (vendorName || '').trim().toLowerCase();
  const allData = loadAllDailySequences();
  const dayRecord: DailyVendorSequenceRecord = allData[dateKey] || {
    lastNumber: 0,
    vendors: {},
  };

  // 1. If already assigned in persistent storage for this date
  if (cleanVendor && dayRecord.vendors[cleanVendor]) {
    return dayRecord.vendors[cleanVendor];
  }

  // 2. Check if any existing lot on this date for this vendor already has a billNumber
  if (cleanVendor && Array.isArray(existingLots) && existingLots.length > 0) {
    const matchingLot = existingLots.find((lot) => {
      if (!lot || !lot.vendorName) return false;
      const lotDate = normalizeDateKey(lot.arrivalDate);
      return lotDate === dateKey && lot.vendorName.trim().toLowerCase() === cleanVendor;
    });

    if (matchingLot && matchingLot.billNumber) {
      const parsedNum = parseInt(matchingLot.billNumber, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        dayRecord.vendors[cleanVendor] = parsedNum;
        dayRecord.lastNumber = Math.max(dayRecord.lastNumber || 0, parsedNum);
        allData[dateKey] = dayRecord;
        saveAllDailySequences(allData);
        return parsedNum;
      }
    }
  }

  // 3. If vendor name is empty, just return next available without permanently assigning empty key
  if (!cleanVendor) {
    return (dayRecord.lastNumber || 0) + 1;
  }

  // 4. Determine next number starting from 1 for this date
  let maxFound = dayRecord.lastNumber || 0;
  if (Array.isArray(existingLots)) {
    for (const lot of existingLots) {
      if (!lot) continue;
      const lotDate = normalizeDateKey(lot.arrivalDate);
      if (lotDate === dateKey && lot.billNumber) {
        const num = parseInt(lot.billNumber, 10);
        if (!isNaN(num) && num > maxFound) {
          maxFound = num;
        }
      }
    }
  }

  const nextNumber = Math.max(1, maxFound + 1);
  dayRecord.vendors[cleanVendor] = nextNumber;
  dayRecord.lastNumber = Math.max(dayRecord.lastNumber || 0, nextNumber);
  allData[dateKey] = dayRecord;
  saveAllDailySequences(allData);

  return nextNumber;
}

/**
 * Synchronizes an array of lots so that every lot of the day for the same vendor
 * shares the exact same receipt number (starting from #1 each day).
 */
export function syncLotsWithDailyVendorSequence(lots: VendorLot[]): VendorLot[] {
  if (!Array.isArray(lots) || lots.length === 0) return lots;

  const allData = loadAllDailySequences();
  let hasChanges = false;

  // Group lots by arrival date
  const dateGroups = new Map<string, VendorLot[]>();
  // We process lots in original/chronological order (reversed if lots are prepended [new, ...old])
  const chronologicalLots = [...lots].reverse();

  for (const lot of chronologicalLots) {
    const dateKey = normalizeDateKey(lot.arrivalDate);
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, []);
    }
    dateGroups.get(dateKey)!.push(lot);
  }

  // Map to hold target billNumber for each lot id
  const lotBillMap = new Map<string, string>();

  dateGroups.forEach((dayLots, dateKey) => {
    const dayRecord: DailyVendorSequenceRecord = allData[dateKey] || {
      lastNumber: 0,
      vendors: {},
    };

    let currentDaySeq = 0;
    // Find highest already established sequence number for this date
    Object.values(dayRecord.vendors).forEach((num) => {
      if (num > currentDaySeq) currentDaySeq = num;
    });

    for (const lot of dayLots) {
      const cleanVendor = (lot.vendorName || '').trim().toLowerCase();
      if (!cleanVendor) continue;

      let vendorBillNum: number;
      if (dayRecord.vendors[cleanVendor]) {
        vendorBillNum = dayRecord.vendors[cleanVendor];
      } else {
        // Assign next sequence starting from 1 for this day
        currentDaySeq += 1;
        vendorBillNum = currentDaySeq;
        dayRecord.vendors[cleanVendor] = vendorBillNum;
        dayRecord.lastNumber = Math.max(dayRecord.lastNumber || 0, vendorBillNum);
        hasChanges = true;
      }

      lotBillMap.set(lot.id, String(vendorBillNum));
    }

    allData[dateKey] = dayRecord;
  });

  if (hasChanges) {
    saveAllDailySequences(allData);
  }

  // Update lots where billNumber doesn't match
  return lots.map((lot) => {
    const targetBill = lotBillMap.get(lot.id);
    if (targetBill && lot.billNumber !== targetBill) {
      return {
        ...lot,
        billNumber: targetBill,
      };
    }
    return lot;
  });
}

/**
 * Gets the bill number for a specific vendor/lot session.
 * Backward compatible alias for getOrAssignVendorDailyReceiptNumber.
 */
export function getOrAssignBillNumber(sessionKey?: string, targetDate?: string, existingLots?: VendorLot[]): number {
  return getOrAssignVendorDailyReceiptNumber(sessionKey || '', targetDate, existingLots);
}

/**
 * Saves and commits bill number generation.
 * Increments the last generated bill counter for the day and maps session key.
 */
export function commitBillGeneration(billNumber: number, sessionKey?: string, targetDate?: string): number {
  const dateKey = normalizeDateKey(targetDate);
  const num = Math.max(1, Math.round(Number(billNumber) || 1));
  const allData = loadAllDailySequences();
  const dayRecord: DailyVendorSequenceRecord = allData[dateKey] || {
    lastNumber: 0,
    vendors: {},
  };

  const cleanKey = (sessionKey || '').trim().toLowerCase();
  if (cleanKey) {
    dayRecord.vendors[cleanKey] = num;
  }
  dayRecord.lastNumber = Math.max(dayRecord.lastNumber || 0, num);
  allData[dateKey] = dayRecord;
  saveAllDailySequences(allData);

  return dayRecord.lastNumber;
}

/**
 * Returns the next available daily bill number for the day
 */
export function getNextDailyBillNumber(targetDate?: string): number {
  const dateKey = normalizeDateKey(targetDate);
  const allData = loadAllDailySequences();
  const dayRecord = allData[dateKey];
  return ((dayRecord?.lastNumber) || 0) + 1;
}

/**
 * Explicitly advances to the next bill number and saves
 */
export function advanceToNextBillNumber(targetDate?: string): number {
  const nextNum = getNextDailyBillNumber(targetDate);
  commitBillGeneration(nextNum, undefined, targetDate);
  return nextNum;
}

/**
 * Backward compatibility: DailyBillSequenceState
 */
export interface DailyBillSequenceState {
  dateKey: string;
  lastBillNumber: number;
  assignedBills?: Record<string, number>;
}

export function getDailyBillSequence(targetDate?: string): DailyBillSequenceState {
  const dateKey = normalizeDateKey(targetDate);
  const allData = loadAllDailySequences();
  const dayRecord = allData[dateKey] || { lastNumber: 0, vendors: {} };
  return {
    dateKey,
    lastBillNumber: dayRecord.lastNumber,
    assignedBills: dayRecord.vendors,
  };
}

export function setDailyBillNumber(num: number, targetDate?: string): void {
  const dateKey = normalizeDateKey(targetDate);
  const safeNum = Math.max(0, Math.round(Number(num) || 0));
  const allData = loadAllDailySequences();
  const dayRecord = allData[dateKey] || { lastNumber: 0, vendors: {} };
  dayRecord.lastNumber = safeNum;
  allData[dateKey] = dayRecord;
  saveAllDailySequences(allData);
}
