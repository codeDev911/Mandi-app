import {
  VendorLot,
  LotExpenses,
  LotSummary,
  UnitType,
  AppSettings,
  CustomerBuyer,
  ShopExpense,
  DrawerAdjustment,
  CashDrawerSummary,
  SavedVendor,
  MazdooriRateItem,
} from '../types';

export const DEFAULT_MAZDOORI_ITEMS: MazdooriRateItem[] = [
  { id: 'mazdoori-bori', title: 'بوری', titleEn: 'بوری', rate: 30, unitType: 'bori' },
  { id: 'mazdoori-tora', title: 'توڑہ / تورڑہ', titleEn: 'توڑہ', rate: 25, unitType: 'tora' },
  { id: 'mazdoori-kainchi', title: 'کینچی', titleEn: 'کینچی', rate: 20, unitType: 'kainchi' },
  { id: 'mazdoori-shopper', title: 'شاپر', titleEn: 'شاپر', rate: 15, unitType: 'shopper' },
  { id: 'mazdoori-crates', title: 'کریٹ', titleEn: 'کریٹ', rate: 20, unitType: 'crates' },
  { id: 'mazdoori-peti', title: 'پیٹی', titleEn: 'پیٹی', rate: 25, unitType: 'peti' },
  { id: 'mazdoori-theli', title: 'تھیلی', titleEn: 'تھیلی', rate: 15, unitType: 'theli' },
  { id: 'mazdoori-nag', title: 'نگ / عدد', titleEn: 'نگ', rate: 5, unitType: 'nag' },
  { id: 'mazdoori-kg', title: 'کلوگرام', titleEn: 'کلوگرام', rate: 2, unitType: 'kg' },
];

export const DEFAULT_UNIT_MAZDOORI_RATES: Record<UnitType, number> = {
  bori: 30,     // بوری (Default Rs 30 / bori as per user requirement)
  tora: 25,     // توڑہ / تورڑہ (Rs 25 / tora)
  kainchi: 20,  // کینچی (Rs 20 / kainchi)
  shopper: 15,  // شاپر (Rs 15 / shopper)
  crates: 20,   // کریٹ (Rs 20 / crate)
  peti: 25,     // پیٹی (Rs 25 / peti)
  theli: 15,    // تھیلی (Rs 15 / theli)
  kg: 2,        // کلوگرام (Rs 2 / kg)
  nag: 5,       // نگ / عدد (Rs 5 / piece)
};

export function getMazdooriItems(settings?: Partial<AppSettings>): MazdooriRateItem[] {
  if (settings?.mazdooriItems && settings.mazdooriItems.length > 0) {
    return settings.mazdooriItems;
  }
  if (settings?.unitMazdooriRates) {
    return DEFAULT_MAZDOORI_ITEMS.map((item) => {
      if (item.unitType && settings.unitMazdooriRates![item.unitType] !== undefined) {
        return { ...item, rate: settings.unitMazdooriRates![item.unitType]! };
      }
      return item;
    });
  }
  return DEFAULT_MAZDOORI_ITEMS;
}

export function getUnitMazdooriRate(unitType: UnitType, settings?: Partial<AppSettings>): number {
  const items = getMazdooriItems(settings);
  const found = items.find(
    (item) => item.unitType === unitType || item.title.toLowerCase().includes(String(unitType).toLowerCase())
  );
  if (found) {
    return found.rate;
  }
  if (settings?.unitMazdooriRates && typeof (settings.unitMazdooriRates as any)[unitType] === 'number') {
    return (settings.unitMazdooriRates as any)[unitType]!;
  }
  if ((DEFAULT_UNIT_MAZDOORI_RATES as any)[unitType] !== undefined) {
    return (DEFAULT_UNIT_MAZDOORI_RATES as any)[unitType];
  }
  return settings?.defaultMazdooriPerUnit ?? 30;
}

export function calculateLotSummary(
  totalQuantity: number,
  sales: VendorLot['sales'],
  expenses: LotExpenses
): LotSummary {
  // 1. Calculate sales totals
  let totalSoldQuantity = 0;
  let grossSales = 0;

  for (const sale of sales) {
    totalSoldQuantity += Number(sale.quantity) || 0;
    grossSales += Number(sale.totalAmount) || 0;
  }

  const remainingQuantity = Math.max(0, totalQuantity - totalSoldQuantity);
  const percentSold = totalQuantity > 0 ? Math.min(100, Math.round((totalSoldQuantity / totalQuantity) * 100)) : 0;

  // 2. Calculate expenses / deductions
  let totalExpenses = 0;

  // Commission
  if (expenses.commission.enabled) {
    if (expenses.commission.type === 'percentage') {
      const computed = (grossSales * (expenses.commission.rate || 0)) / 100;
      expenses.commission.amount = Math.round(computed);
    }
    totalExpenses += Number(expenses.commission.amount) || 0;
  }

  // Kiraya
  if (expenses.kiraya.enabled) {
    totalExpenses += Number(expenses.kiraya.amount) || 0;
  }

  // Mazdoori
  if (expenses.mazdoori.enabled) {
    totalExpenses += Number(expenses.mazdoori.amount) || 0;
  }

  // Munshiana
  if (expenses.munshiana.enabled) {
    totalExpenses += Number(expenses.munshiana.amount) || 0;
  }

  // Naqd / Advance
  if (expenses.naqdAdvance.enabled) {
    totalExpenses += Number(expenses.naqdAdvance.amount) || 0;
  }

  // Market Fee
  if (expenses.marketFee.enabled) {
    totalExpenses += Number(expenses.marketFee.amount) || 0;
  }

  // Custom Expenses
  if (expenses.customExpenses && Array.isArray(expenses.customExpenses)) {
    for (const item of expenses.customExpenses) {
      totalExpenses += Number(item.amount) || 0;
    }
  }

  // 3. Meezan (Net Payable to Vendor)
  totalExpenses = Math.round(totalExpenses * 100) / 100;
  const netPayableToVendor = Math.round((grossSales - totalExpenses) * 100) / 100;

  // 4. Arhti's Net Income from this lot (Commission + Munshiana)
  const arhtiProfitCommission = Math.round(
    ((expenses.commission.enabled ? Number(expenses.commission.amount) || 0 : 0) +
      (expenses.munshiana.enabled ? Number(expenses.munshiana.amount) || 0 : 0)) *
      100
  ) / 100;

  return {
    totalSoldQuantity,
    remainingQuantity,
    grossSales,
    totalExpenses,
    netPayableToVendor,
    arhtiProfitCommission,
    percentSold,
  };
}

/**
 * Distributes a total munshiana amount across multiple lots without floating point inaccuracies.
 * E.g. Rs. 2 across 3 lots:
 * Base integer = 0, remainder = 2 -> [1, 1, 0].
 * Exactly 2 Rs total with zero floating point error (avoids "2.0100000000000002").
 */
export function distributeMunshianaToLots(totalAmount: number, lotCount: number): number[] {
  if (lotCount <= 0) return [];
  const roundedTotal = Math.max(0, Math.round(totalAmount));
  const base = Math.floor(roundedTotal / lotCount);
  const remainder = roundedTotal % lotCount;

  return Array.from({ length: lotCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function getLotDatePrefix(targetDate?: Date | string): string {
  const d = targetDate ? new Date(targetDate) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const yy = String(validDate.getFullYear()).slice(-2);
  const mm = String(validDate.getMonth() + 1).padStart(2, '0');
  const dd = String(validDate.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export function generateLotNumber(
  existingLots?: VendorLot[] | number,
  targetDate?: Date | string
): string {
  const dateStr = getLotDatePrefix(targetDate);

  if (Array.isArray(existingLots)) {
    // Find highest sequence number among existing lots for this specific date
    let maxSeq = 0;
    for (const lot of existingLots) {
      if (!lot || !lot.lotNumber) continue;
      const numStr = String(lot.lotNumber).trim();
      // Match `${dateStr}-(\\d+)` or legacy `LOT-${dateStr}-(\\d+)`
      const pattern = new RegExp(`^(?:LOT-)?${dateStr}-(\\d+)$`, 'i');
      const match = numStr.match(pattern);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    return `${dateStr}-${nextSeq}`;
  }

  // Fallback if existingLotsCount number is passed
  const count = typeof existingLots === 'number' ? existingLots : 0;
  return `${dateStr}-${count + 1}`;
}

/**
 * Extracts the daily receipt own number from a lot number.
 * E.g.: "261010-1" -> "1", "261010-12" -> "12", "LOT-260810-122" -> "122"
 * Increments by 1 and resets to 1 each day.
 */
export function getLotReceiptNumber(lotNumber?: string): string {
  if (!lotNumber) return '1';
  const clean = String(lotNumber).trim();
  // Match trailing sequence number after dash, stripping leading zeros
  const dashMatch = clean.match(/-0*(\d+)$/);
  if (dashMatch) {
    return dashMatch[1];
  }
  const plainMatch = clean.match(/^0*(\d+)$/);
  if (plainMatch) {
    return plainMatch[1];
  }
  return clean.replace(/^LOT-/i, '');
}

export function calculateCashDrawerSummary(
  lots: VendorLot[],
  customers: CustomerBuyer[],
  expenses: ShopExpense[],
  drawerAdjustments: DrawerAdjustment[],
  vendors?: SavedVendor[],
  dateFilterFn?: (dateStr: string) => boolean
): CashDrawerSummary {
  // 1. Sales cash collected
  let salesCashCollected = 0;
  lots.forEach((lot) => {
    lot.sales.forEach((sale) => {
      const saleDate = (sale as any).date || sale.timestamp?.slice(0, 10) || lot.arrivalDate?.slice(0, 10);
      if (dateFilterFn && saleDate && !dateFilterFn(saleDate)) return;

      if (sale.paymentStatus === 'cash') {
        salesCashCollected += Number(sale.totalAmount) || 0;
      } else if (sale.paidAmount && sale.paidAmount > 0) {
        salesCashCollected += Number(sale.paidAmount) || 0;
      }
    });
  });

  // 2. Buyer Khata cash collected
  let buyerKhataCashCollected = 0;
  customers.forEach((cust) => {
    (cust.payments || []).forEach((pay) => {
      const payDate = pay.paymentDate || pay.date || '';
      if (dateFilterFn && payDate && !dateFilterFn(payDate)) return;

      const isCash = !pay.paymentMethod || pay.paymentMethod === 'cash';
      if (isCash) {
        buyerKhataCashCollected += Number(pay.amount) || 0;
      }
    });
  });

  // 3. Manual Cash In & Out adjustments
  let manualCashIn = 0;
  let manualCashOut = 0;
  drawerAdjustments.forEach((adj) => {
    if (dateFilterFn && adj.date && !dateFilterFn(adj.date)) return;

    if (adj.type === 'in') {
      manualCashIn += Number(adj.amount) || 0;
    } else if (adj.type === 'out') {
      manualCashOut += Number(adj.amount) || 0;
    }
  });

  // 4. Shop cash expenses deducted
  let shopCashExpenses = 0;
  expenses.forEach((exp) => {
    if (dateFilterFn && exp.date && !dateFilterFn(exp.date)) return;

    const isCash = !exp.paymentMethod || exp.paymentMethod === 'cash';
    if (isCash) {
      shopCashExpenses += Number(exp.amount) || 0;
    }
  });

  // 5. Vendor cash paid deducted
  let vendorCashPaid = 0;
  lots.forEach((lot) => {
    const isCash = !lot.vendorPaymentMethod || lot.vendorPaymentMethod === 'cash';
    if (!isCash) return;

    const payDate = lot.vendorPaymentDate || lot.arrivalDate?.slice(0, 10) || '';
    if (dateFilterFn && payDate && !dateFilterFn(payDate)) return;

    const amt =
      lot.vendorPaymentAmount !== undefined
        ? lot.vendorPaymentAmount
        : lot.vendorPaymentStatus === 'paid'
        ? lot.summary.netPayableToVendor
        : 0;

    vendorCashPaid += Number(amt) || 0;
  });

  // Also include any standalone vendor cash payments not linked to a lot
  if (vendors && Array.isArray(vendors)) {
    vendors.forEach((v) => {
      (v.payments || []).forEach((pay) => {
        if (pay.lotId) return; // already counted under lot if applicable
        const payDate = pay.paymentDate || pay.date || '';
        if (dateFilterFn && payDate && !dateFilterFn(payDate)) return;
        const isCash = !pay.paymentMethod || pay.paymentMethod === 'cash';
        if (isCash) {
          vendorCashPaid += Number(pay.amount) || 0;
        }
      });
    });
  }

  const totalCashIn = salesCashCollected + buyerKhataCashCollected + manualCashIn;
  const totalCashOut = shopCashExpenses + vendorCashPaid + manualCashOut;
  const netCashInDrawer = totalCashIn - totalCashOut;

  return {
    salesCashCollected,
    buyerKhataCashCollected,
    manualCashIn,
    totalCashIn,
    shopCashExpenses,
    vendorCashPaid,
    manualCashOut,
    totalCashOut,
    netCashInDrawer,
  };
}
