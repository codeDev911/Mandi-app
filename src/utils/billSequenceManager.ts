/**
 * Daily Sequential Bill Number Manager for Insaf Mandi Bills
 * 
 * Tracks daily sequential bill numbers (1, 2, 3, ...).
 * When a new day begins, sequence automatically resets to start from 1 again.
 */

export interface DailyBillSequenceState {
  dateKey: string; // YYYY-MM-DD
  lastBillNumber: number; // e.g. 43
  assignedBills?: Record<string, number>; // vendor / lot session key -> bill number
}

const STORAGE_KEY_BILL_SEQ = 'mandi_bolli_daily_bill_sequence_v1';

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
 * Loads current daily bill sequence from storage.
 * If target date is a new day, returns state with lastBillNumber = 0 (next bill will be 1).
 */
export function getDailyBillSequence(targetDate?: string): DailyBillSequenceState {
  const dateKey = normalizeDateKey(targetDate);
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_BILL_SEQ) : null;
    if (raw) {
      const parsed: DailyBillSequenceState = JSON.parse(raw);
      if (parsed && parsed.dateKey === dateKey) {
        return {
          dateKey,
          lastBillNumber: Math.max(0, Number(parsed.lastBillNumber) || 0),
          assignedBills: parsed.assignedBills || {},
        };
      }
    }
  } catch (err) {
    console.error('Error loading daily bill sequence:', err);
  }

  // New day or first time: reset to 0 so next is 1
  return {
    dateKey,
    lastBillNumber: 0,
    assignedBills: {},
  };
}

/**
 * Returns the next available daily bill number for the day (e.g. if 43 generated, returns 44; on new day returns 1)
 */
export function getNextDailyBillNumber(targetDate?: string): number {
  const state = getDailyBillSequence(targetDate);
  return (state.lastBillNumber || 0) + 1;
}

/**
 * Gets the bill number for a specific vendor/lot session.
 * If already assigned for today, returns existing; otherwise returns next daily bill number.
 */
export function getOrAssignBillNumber(sessionKey?: string, targetDate?: string): number {
  const state = getDailyBillSequence(targetDate);
  const cleanKey = (sessionKey || '').trim().toLowerCase();
  if (cleanKey && state.assignedBills && state.assignedBills[cleanKey]) {
    return state.assignedBills[cleanKey];
  }
  return (state.lastBillNumber || 0) + 1;
}

/**
 * Saves and commits bill number generation.
 * Increments the last generated bill counter for the day and maps session key.
 */
export function commitBillGeneration(billNumber: number, sessionKey?: string, targetDate?: string): number {
  const dateKey = normalizeDateKey(targetDate);
  const state = getDailyBillSequence(dateKey);
  const num = Math.max(1, Math.round(Number(billNumber) || 1));
  const newLast = Math.max(state.lastBillNumber || 0, num);
  const newAssigned = { ...(state.assignedBills || {}) };

  const cleanKey = (sessionKey || '').trim().toLowerCase();
  if (cleanKey) {
    newAssigned[cleanKey] = num;
  }

  const newState: DailyBillSequenceState = {
    dateKey,
    lastBillNumber: newLast,
    assignedBills: newAssigned,
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BILL_SEQ, JSON.stringify(newState));
    }
  } catch (err) {
    console.error('Error persisting bill generation:', err);
  }

  return newLast;
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
 * Sets daily bill number manually (useful if synchronizing with manual paper bill book)
 */
export function setDailyBillNumber(num: number, targetDate?: string): void {
  const dateKey = normalizeDateKey(targetDate);
  const state = getDailyBillSequence(dateKey);
  const safeNum = Math.max(0, Math.round(Number(num) || 0));
  const newState: DailyBillSequenceState = {
    ...state,
    dateKey,
    lastBillNumber: safeNum,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BILL_SEQ, JSON.stringify(newState));
    }
  } catch (err) {
    console.error('Error setting daily bill number:', err);
  }
}
