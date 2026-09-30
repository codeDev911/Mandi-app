import { SystemLog, LogCategory, LogActionStatus, VendorLot, ShopExpense, DrawerAdjustment } from '../types';

const STORAGE_KEY_LOGS = 'mandi_system_audit_logs_v1';
const MAX_LOGS_KEPT = 10000;

export function getSystemLogs(): SystemLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse system logs from localStorage:', err);
  }
  return [];
}

export function saveSystemLogs(logs: SystemLog[]): void {
  try {
    const sliced = logs.slice(0, MAX_LOGS_KEPT);
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(sliced));
  } catch (err) {
    console.error('Failed to persist system logs to localStorage:', err);
  }
}

export function addSystemLog(logInput: {
  title: LogCategory;
  status: LogActionStatus;
  description: string;
  descriptionEn?: string;
  entityId?: string;
  timestamp?: string;
  meta?: Record<string, any>;
}): SystemLog {
  const newLog: SystemLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: logInput.timestamp || new Date().toISOString(),
    title: logInput.title,
    status: logInput.status,
    description: logInput.description,
    descriptionEn: logInput.descriptionEn,
    entityId: logInput.entityId,
    meta: logInput.meta,
  };

  try {
    const existing = getSystemLogs();
    const updated = [newLog, ...existing].slice(0, MAX_LOGS_KEPT);
    saveSystemLogs(updated);

    // Dispatch event so any open modal or subscriber updates reactively
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mandi_system_log_added', { detail: newLog }));
    }
  } catch (e) {
    console.error('Failed to add system log:', e);
  }

  return newLog;
}

export function clearSystemLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_LOGS);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mandi_system_logs_cleared'));
    }
  } catch (e) {
    console.error('Failed to clear system logs:', e);
  }
}

/**
 * Format ISO timestamp into human readable Urdu / English date & time
 */
export function formatLogDateTime(isoString: string, isUrdu: boolean = true): {
  date: string;
  time: string;
  full: string;
} {
  try {
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) {
      return { date: isoString, time: '', full: isoString };
    }

    const day = dateObj.getDate();
    const monthIndex = dateObj.getMonth();
    const year = dateObj.getFullYear();

    const urduMonths = [
      'جنوری',
      'فروری',
      'مارچ',
      'اپریل',
      'مئی',
      'جون',
      'جولائی',
      'اگست',
      'ستمبر',
      'اکتوبر',
      'نومبر',
      'دسمبر',
    ];

    const englishMonths = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const dateStr = isUrdu
      ? `${day} ${urduMonths[monthIndex]} ${year}`
      : `${day} ${englishMonths[monthIndex]} ${year}`;

    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();
    const isPM = hours >= 12;
    hours = hours % 12;
    if (hours === 0) hours = 12;

    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${isPM ? (isUrdu ? 'شام' : 'PM') : (isUrdu ? 'صبح' : 'AM')}`;

    return {
      date: dateStr,
      time: timeStr,
      full: `${dateStr} • ${timeStr}`,
    };
  } catch {
    return { date: isoString, time: '', full: isoString };
  }
}

/**
 * Seed initial sample logs from existing data if logs storage is currently empty
 */
export function seedInitialLogsIfEmpty(
  lots: VendorLot[],
  expenses: ShopExpense[] = [],
  drawerAdjustments: DrawerAdjustment[] = []
): void {
  const existing = getSystemLogs();
  if (existing.length > 0) return;

  const generated: SystemLog[] = [];

  // Generate logs from existing lots
  lots.forEach((lot) => {
    const t = lot.createdAt || lot.arrivalDate || new Date().toISOString();
    generated.push({
      id: `log-seed-lot-${lot.id}`,
      timestamp: t,
      title: 'LT',
      status: 'created',
      description: `نئی لاٹ #${lot.lotNumber} کا اندراج: ${lot.productUrdu || lot.productName} (${lot.totalQuantity} تعداد) - زمیندار: ${lot.vendorName}`,
      descriptionEn: `Lot #${lot.lotNumber} created: ${lot.productName} (${lot.totalQuantity}) - Vendor: ${lot.vendorName}`,
      entityId: lot.id,
      meta: {
        lotNumber: lot.lotNumber,
        vendor: lot.vendorName,
        product: lot.productUrdu || lot.productName,
        quantity: lot.totalQuantity,
      },
    });

    if (lot.sales && lot.sales.length > 0) {
      lot.sales.forEach((s) => {
        const sTime = s.timestamp || (s as any).date || t;
        generated.push({
          id: `log-seed-sale-${s.id}`,
          timestamp: sTime,
          title: 'BL',
          status: 'created',
          description: `بولی بکری فروخت: ${s.quantity} تعداد ${lot.productUrdu} بنام ${s.buyerName || 'خریدار'} @ ریٹ ${Math.round(s.ratePerUnit)} (کل: Rs.${Math.round(s.totalAmount).toLocaleString()})`,
          descriptionEn: `Sale recorded: ${s.quantity} ${lot.productName} to ${s.buyerName} @ ${s.ratePerUnit}`,
          entityId: s.id,
          meta: {
            lotNumber: lot.lotNumber,
            buyer: s.buyerName,
            rate: s.ratePerUnit,
            quantity: s.quantity,
            amount: s.totalAmount,
          },
        });
      });
    }

    if (lot.vendorPaymentStatus === 'paid') {
      generated.push({
        id: `log-seed-vp-${lot.id}`,
        timestamp: lot.vendorPaymentDate || t,
        title: 'VP',
        status: 'updated',
        description: `زمیندار ادائیگی مکمل: لاٹ #${lot.lotNumber} بنام ${lot.vendorName} (رقم: Rs.${Math.round(lot.summary.netPayableToVendor).toLocaleString()})`,
        descriptionEn: `Vendor payment marked paid for lot #${lot.lotNumber}`,
        entityId: lot.id,
      });
    }
  });

  // Generate logs from shop expenses
  expenses.forEach((exp) => {
    generated.push({
      id: `log-seed-exp-${exp.id}`,
      timestamp: exp.createdAt || `${exp.date}T10:00:00.000Z`,
      title: 'EX',
      status: 'created',
      description: `دکان خرچہ اندراج: ${exp.title} - مد: ${exp.category} (رقم: Rs.${Math.round(exp.amount).toLocaleString()})`,
      descriptionEn: `Shop expense: ${exp.title} - Rs.${exp.amount}`,
      entityId: exp.id,
    });
  });

  // Generate logs from drawer adjustments
  drawerAdjustments.forEach((adj) => {
    generated.push({
      id: `log-seed-cd-${adj.id}`,
      timestamp: adj.timestamp || `${adj.date}T10:00:00.000Z`,
      title: 'CD',
      status: 'created',
      description: `گلہ کیش ایڈجسٹمنٹ (${adj.type === 'in' ? '+ کیش جمع' : '- کیش نکاسی'}): رقم Rs.${Math.round(adj.amount).toLocaleString()} - وجہ: ${adj.reason}`,
      descriptionEn: `Cash drawer adjustment: ${adj.type} Rs.${adj.amount}`,
      entityId: adj.id,
    });
  });

  // Sort newest first
  generated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (generated.length > 0) {
    saveSystemLogs(generated);
  }
}
