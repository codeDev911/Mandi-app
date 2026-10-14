import { VendorLot } from '../types';
import { getLotReceiptNumber } from './calculations';

/**
 * Daily Sequential Bill/Receipt (Raseed) Number Manager for Insaf Mandi
 * 
 * Rules:
 * 1. Each day starts at receipt #1 if not saved in local storage.
 * 2. All lots belonging to the same vendor on the same day share the EXACT SAME receipt number.
 *    (e.g., Vendor A has 3 lots today -> all 3 lots have raseed #1.
 *     Vendor B has lots today -> raseed #2 incremented by 1).
 * 3. When creating a new lot entry:
 *    a) First check if the lot belongs to a vendor who brought previous something today:
 *       - If yes: save that existing raseed number in the new lot entry.
 *    b) If no lot belongs to the vendor for today:
 *       - Check local storage:
 *         - If saved date is the same as today's date: increment saved raseed number by 1,
 *           save resultant raseed in local storage and in this new lot entry.
 *         - If not saved or saved date is not today: save today's date and raseed number as 1,
 *           and save 1 in this new lot entry.
 */

export interface DailyLotRaseedState {
  savedDate: string; // YYYY-MM-DD
  savedRaseedNumber: number; // Current highest raseed number for the day (1, 2, 3...)
  vendorRaseeds: Record<string, number>; // normalized vendor name -> assigned daily raseed number
}

export interface DailyVendorSequenceRecord {
  lastNumber: number;
  vendors: Record<string, number>;
}

export const STORAGE_KEY_DAILY_RASEED = 'mandi_bolli_daily_lot_raseed_v3';
export const STORAGE_KEY_VENDOR_SEQ = 'mandi_bolli_daily_vendor_sequence_v2';
export const STORAGE_KEY_LEGACY_BILL_SEQ = 'mandi_bolli_daily_bill_sequence_v1';

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
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
 * Loads all historical daily vendor sequences from localStorage (for multi-date support)
 */
export function loadAllDailySequences(): Record<string, DailyVendorSequenceRecord> {
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
 * Saves all historical daily vendor sequences to localStorage
 */
export function saveAllDailySequences(data: Record<string, DailyVendorSequenceRecord>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_VENDOR_SEQ, JSON.stringify(data));
    }
  } catch (err) {
    console.error('Error saving daily vendor sequence store:', err);
  }
}

/**
 * Loads current daily lot raseed state from localStorage
 */
export function loadDailyRaseedState(): DailyLotRaseedState {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_DAILY_RASEED);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.savedDate) {
          return {
            savedDate: String(parsed.savedDate),
            savedRaseedNumber: Math.max(0, parseInt(parsed.savedRaseedNumber, 10) || 0),
            vendorRaseeds: parsed.vendorRaseeds && typeof parsed.vendorRaseeds === 'object' ? parsed.vendorRaseeds : {},
          };
        }
      }

      // Check legacy sequence storage for today as fallback
      const legacy = loadAllDailySequences();
      const today = getTodayDateKey();
      if (legacy && legacy[today]) {
        return {
          savedDate: today,
          savedRaseedNumber: legacy[today].lastNumber || 0,
          vendorRaseeds: legacy[today].vendors || {},
        };
      }
    }
  } catch (err) {
    console.error('Error loading daily lot raseed state:', err);
  }

  return {
    savedDate: '',
    savedRaseedNumber: 0,
    vendorRaseeds: {},
  };
}

/**
 * Saves current daily lot raseed state to localStorage and synchronizes legacy stores
 */
export function saveDailyRaseedState(state: DailyLotRaseedState): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DAILY_RASEED, JSON.stringify(state));

      // Synchronize with historical sequences map
      if (state.savedDate) {
        const legacy = loadAllDailySequences();
        const existingVendors = legacy[state.savedDate]?.vendors || {};
        legacy[state.savedDate] = {
          lastNumber: Math.max(legacy[state.savedDate]?.lastNumber || 0, state.savedRaseedNumber),
          vendors: { ...existingVendors, ...state.vendorRaseeds },
        };
        saveAllDailySequences(legacy);
      }
    }
  } catch (err) {
    console.error('Error saving daily lot raseed state:', err);
  }
}

/**
 * Finds the highest raseed number in existing lots on a given date
 */
export function getMaxRaseedInLots(dateKey: string, lots?: VendorLot[]): number {
  if (!Array.isArray(lots) || lots.length === 0) return 0;
  let maxNum = 0;
  for (const lot of lots) {
    if (!lot) continue;
    const lotDate = normalizeDateKey(lot.arrivalDate || lot.createdAt);
    if (lotDate === dateKey) {
      const numFromBill = parseInt(lot.billNumber || '', 10);
      if (!isNaN(numFromBill) && numFromBill > maxNum) {
        maxNum = numFromBill;
      }
      const numFromLot = parseInt(getLotReceiptNumber(lot.lotNumber, lot.billNumber), 10);
      if (!isNaN(numFromLot) && numFromLot > maxNum) {
        maxNum = numFromLot;
      }
    }
  }
  return maxNum;
}

/**
 * Checks if a vendor already brought something on a given date in existing lots
 */
export function findExistingVendorRaseedToday(
  vendorName: string,
  dateKey: string,
  lots?: VendorLot[]
): number | null {
  const cleanVendor = (vendorName || '').trim().toLowerCase();
  if (!cleanVendor || !Array.isArray(lots) || lots.length === 0) return null;

  for (const lot of lots) {
    if (!lot || !lot.vendorName) continue;
    const lotVendor = lot.vendorName.trim().toLowerCase();
    if (lotVendor === cleanVendor) {
      const lotDate = normalizeDateKey(lot.arrivalDate || lot.createdAt);
      if (lotDate === dateKey) {
        if (lot.billNumber) {
          const parsed = parseInt(lot.billNumber, 10);
          if (!isNaN(parsed) && parsed > 0) {
            return parsed;
          }
        }
        const raseedStr = getLotReceiptNumber(lot.lotNumber, lot.billNumber);
        const parsed = parseInt(raseedStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
  }

  return null;
}

/**
 * Pure, non-mutating preview of the vendor's daily receipt number.
 * Used during form input / modal display so typing does not advance the counter.
 */
export function previewVendorDailyReceiptNumber(
  vendorName: string,
  targetDate?: string,
  existingLots?: VendorLot[]
): number {
  const today = normalizeDateKey(targetDate);
  const cleanVendor = (vendorName || '').trim().toLowerCase();
  const state = loadDailyRaseedState();

  // 1. If vendor already brought something today: return that exact same raseed number
  if (cleanVendor) {
    const existingFromLots = findExistingVendorRaseedToday(cleanVendor, today, existingLots);
    if (existingFromLots) return existingFromLots;

    if (state.savedDate === today && state.vendorRaseeds[cleanVendor]) {
      return state.vendorRaseeds[cleanVendor];
    }
  }

  // 2. Vendor has not brought anything today yet:
  const maxInLots = getMaxRaseedInLots(today, existingLots);

  if (state.savedDate === today && state.savedRaseedNumber > 0) {
    return Math.max(state.savedRaseedNumber, maxInLots) + 1;
  }

  return maxInLots > 0 ? maxInLots + 1 : 1;
}

/**
 * ATOMIC INCREMENT & COMMIT: Called when creating / saving a new lot entry.
 * 
 * Rules:
 * 1. Checks if the lot belongs to a vendor that brings previous something today:
 *    - If it has: returns and saves that existing raseed in the new lot entry.
 * 2. If no lot belongs to the vendor for today:
 *    - Checks local storage: check saved date with today's date:
 *      - If same: increment saved raseed number by 1 and save resultant raseed in local storage.
 *      - If not saved / not same: save today's date and raseed number as 1 in local storage.
 * 3. Returns the resultant raseed number for this new lot entry.
 */
export function createAndAssignLotRaseedNumber(
  vendorName: string,
  targetDate?: string,
  existingLots?: VendorLot[]
): number {
  const today = normalizeDateKey(targetDate);
  const cleanVendor = (vendorName || '').trim().toLowerCase();
  const state = loadDailyRaseedState();

  // STEP 1: Check if this lot belongs to a vendor that brings previous something today
  let vendorExistingRaseed: number | null = null;

  if (cleanVendor) {
    // Check in existing lots for today
    const fromLots = findExistingVendorRaseedToday(cleanVendor, today, existingLots);
    if (fromLots) {
      vendorExistingRaseed = fromLots;
    } else if (state.savedDate === today && state.vendorRaseeds[cleanVendor]) {
      // Check in today's saved vendor sequence in local storage
      vendorExistingRaseed = state.vendorRaseeds[cleanVendor];
    }
  }

  if (vendorExistingRaseed && vendorExistingRaseed > 0) {
    // Vendor already has lots today! Reuse exact same raseed number without incrementing.
    if (state.savedDate === today) {
      if (cleanVendor) state.vendorRaseeds[cleanVendor] = vendorExistingRaseed;
      state.savedRaseedNumber = Math.max(state.savedRaseedNumber, vendorExistingRaseed);
      saveDailyRaseedState(state);
    } else {
      state.savedDate = today;
      state.savedRaseedNumber = vendorExistingRaseed;
      state.vendorRaseeds = cleanVendor ? { [cleanVendor]: vendorExistingRaseed } : {};
      saveDailyRaseedState(state);
    }
    return vendorExistingRaseed;
  }

  // STEP 2: No lot belongs to the vendor for today
  const maxInLots = getMaxRaseedInLots(today, existingLots);

  if (state.savedDate === today && state.savedRaseedNumber > 0) {
    // Saved date is the same as today's date: increment saved raseed number by 1
    const baseNumber = Math.max(state.savedRaseedNumber, maxInLots);
    const resultantRaseedNumber = baseNumber + 1;

    state.savedDate = today;
    state.savedRaseedNumber = resultantRaseedNumber;
    if (cleanVendor) {
      state.vendorRaseeds[cleanVendor] = resultantRaseedNumber;
    }
    saveDailyRaseedState(state);
    return resultantRaseedNumber;
  }

  // Not saved in local storage or saved date is not today:
  // Save today's date and raseed number as 1 (or maxInLots + 1 if lots already exist for today)
  const resultantRaseedNumber = maxInLots > 0 ? maxInLots + 1 : 1;

  state.savedDate = today;
  state.savedRaseedNumber = resultantRaseedNumber;
  state.vendorRaseeds = cleanVendor ? { [cleanVendor]: resultantRaseedNumber } : {};
  saveDailyRaseedState(state);
  return resultantRaseedNumber;
}

/**
 * Gets or assigns a daily receipt number for a vendor on a specific date.
 * Reuses existing raseed for the vendor on that date, or previews the next sequential number.
 */
export function getOrAssignVendorDailyReceiptNumber(
  vendorName: string,
  targetDate?: string,
  existingLots?: VendorLot[]
): number {
  return previewVendorDailyReceiptNumber(vendorName, targetDate, existingLots);
}

/**
 * Synchronizes an array of lots so that every lot of the day for the same vendor
 * shares the EXACT same receipt number (starting from #1 each day).
 */
export function syncLotsWithDailyVendorSequence(lots: VendorLot[]): VendorLot[] {
  if (!Array.isArray(lots) || lots.length === 0) return lots;

  const allData = loadAllDailySequences();
  const todayKey = getTodayDateKey();
  let hasChanges = false;

  // Group lots by arrival date
  const dateGroups = new Map<string, VendorLot[]>();
  // Process chronological lots (preserve original order)
  const chronologicalLots = [...lots].reverse();

  for (const lot of chronologicalLots) {
    const dateKey = normalizeDateKey(lot.arrivalDate || lot.createdAt);
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, []);
    }
    dateGroups.get(dateKey)!.push(lot);
  }

  const lotBillMap = new Map<string, string>();

  dateGroups.forEach((dayLots, dateKey) => {
    const dayRecord: DailyVendorSequenceRecord = allData[dateKey] || {
      lastNumber: 0,
      vendors: {},
    };

    let currentDaySeq = 0;
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
        // Check if this lot already has a valid numeric billNumber
        const existingNum = parseInt(lot.billNumber || '', 10);
        if (!isNaN(existingNum) && existingNum > 0) {
          vendorBillNum = existingNum;
          dayRecord.vendors[cleanVendor] = vendorBillNum;
          if (vendorBillNum > currentDaySeq) currentDaySeq = vendorBillNum;
          dayRecord.lastNumber = Math.max(dayRecord.lastNumber || 0, vendorBillNum);
          hasChanges = true;
        } else {
          // Assign next sequence starting from 1 for this day
          currentDaySeq += 1;
          vendorBillNum = currentDaySeq;
          dayRecord.vendors[cleanVendor] = vendorBillNum;
          dayRecord.lastNumber = Math.max(dayRecord.lastNumber || 0, vendorBillNum);
          hasChanges = true;
        }
      }

      lotBillMap.set(lot.id, String(vendorBillNum));
    }

    allData[dateKey] = dayRecord;

    // If synchronizing today, ensure daily lot raseed state reflects it
    if (dateKey === todayKey) {
      const currentState = loadDailyRaseedState();
      saveDailyRaseedState({
        savedDate: todayKey,
        savedRaseedNumber: Math.max(currentState.savedRaseedNumber || 0, dayRecord.lastNumber),
        vendorRaseeds: { ...currentState.vendorRaseeds, ...dayRecord.vendors },
      });
    }
  });

  if (hasChanges) {
    saveAllDailySequences(allData);
  }

  // Update lots where billNumber does not match the vendor's synchronized daily raseed number
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
 * Backward compatibility alias for getOrAssignVendorDailyReceiptNumber
 */
export function getOrAssignBillNumber(sessionKey?: string, targetDate?: string, existingLots?: VendorLot[]): number {
  return previewVendorDailyReceiptNumber(sessionKey || '', targetDate, existingLots);
}

/**
 * Saves and commits bill number generation.
 */
export function commitBillGeneration(billNumber: number, sessionKey?: string, targetDate?: string): number {
  const today = normalizeDateKey(targetDate);
  const num = Math.max(1, Math.round(Number(billNumber) || 1));
  const cleanKey = (sessionKey || '').trim().toLowerCase();

  const state = loadDailyRaseedState();
  if (state.savedDate === today) {
    state.savedRaseedNumber = Math.max(state.savedRaseedNumber, num);
    if (cleanKey) state.vendorRaseeds[cleanKey] = num;
  } else {
    state.savedDate = today;
    state.savedRaseedNumber = num;
    state.vendorRaseeds = cleanKey ? { [cleanKey]: num } : {};
  }
  saveDailyRaseedState(state);
  return state.savedRaseedNumber;
}

/**
 * Returns the next available daily bill number for the day
 */
export function getNextDailyBillNumber(targetDate?: string): number {
  const today = normalizeDateKey(targetDate);
  const state = loadDailyRaseedState();
  if (state.savedDate === today) {
    return (state.savedRaseedNumber || 0) + 1;
  }
  return 1;
}

/**
 * Explicitly advances to the next bill number and saves
 */
export function advanceToNextBillNumber(targetDate?: string): number {
  const nextNum = getNextDailyBillNumber(targetDate);
  commitBillGeneration(nextNum, undefined, targetDate);
  return nextNum;
}

export interface DailyBillSequenceState {
  dateKey: string;
  lastBillNumber: number;
  assignedBills?: Record<string, number>;
}

export function getDailyBillSequence(targetDate?: string): DailyBillSequenceState {
  const today = normalizeDateKey(targetDate);
  const state = loadDailyRaseedState();
  if (state.savedDate === today) {
    return {
      dateKey: today,
      lastBillNumber: state.savedRaseedNumber,
      assignedBills: state.vendorRaseeds,
    };
  }
  return {
    dateKey: today,
    lastBillNumber: 0,
    assignedBills: {},
  };
}

export function setDailyBillNumber(num: number, targetDate?: string): void {
  const today = normalizeDateKey(targetDate);
  const safeNum = Math.max(0, Math.round(Number(num) || 0));
  const state = loadDailyRaseedState();
  state.savedDate = today;
  state.savedRaseedNumber = safeNum;
  saveDailyRaseedState(state);
}
