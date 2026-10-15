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
 * Extracts the daily receipt own number from a lot number or bill number.
 * E.g.: "261010-1" -> "1", "261010-12" -> "12", "LOT-260810-122" -> "122"
 * Increments by 1 and resets to 1 each day. Matches the receipt number in InsafMandiBillView.
 */
export function getLotReceiptNumber(lotNumber?: string, billNumber?: string): string {
  if (billNumber && String(billNumber).trim()) {
    return String(billNumber).trim();
  }
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
      const saleDate = ((sale as any).date || sale.timestamp || lot.arrivalDate || '').slice(0, 10);
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
      const payDate = (pay.date || pay.paymentDate || (pay as any).timestamp || '').slice(0, 10);
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
    const adjDate = (adj.date || adj.timestamp || '').slice(0, 10);
    if (dateFilterFn && adjDate && !dateFilterFn(adjDate)) return;

    if (adj.type === 'in') {
      manualCashIn += Number(adj.amount) || 0;
    } else if (adj.type === 'out') {
      manualCashOut += Number(adj.amount) || 0;
    }
  });

  // 4. Shop cash expenses deducted
  let shopCashExpenses = 0;
  expenses.forEach((exp) => {
    const expDate = (exp.date || '').slice(0, 10);
    if (dateFilterFn && expDate && !dateFilterFn(expDate)) return;

    const isCash = !exp.paymentMethod || exp.paymentMethod === 'cash';
    if (isCash) {
      shopCashExpenses += Number(exp.amount) || 0;
    }
  });

  // 5. Vendor cash paid deducted (reconciled across vendor ledger and lots to prevent double counting)
  let vendorCashPaid = 0;
  const allReconciledVendorPayments = getAllReconciledVendorPayments(lots, vendors);
  allReconciledVendorPayments.forEach((pay) => {
    const isCash = !pay.paymentMethod || pay.paymentMethod === 'cash';
    if (!isCash) return;
    const payDate = pay.date;
    if (dateFilterFn && payDate && !dateFilterFn(payDate)) return;
    vendorCashPaid += Number(pay.amount) || 0;
  });

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

export interface ReconciledVendorPaymentItem {
  id: string;
  vendorName: string;
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'online' | 'cheque';
  lotId?: string;
  notes?: string;
}

/**
 * Returns a deduplicated, reconciled list of vendor payments for a specific vendor.
 * Handles both persistent vendor.payments records and lot-level payments (status toggles or distributed payments)
 * without double-counting when a payment is recorded in both vendor.payments and lot.vendorPaymentAmount.
 */
export function getReconciledVendorPaymentsForVendor(
  vendorName: string,
  vendorLots: VendorLot[],
  vendors: SavedVendor[] = []
): ReconciledVendorPaymentItem[] {
  const normName = vendorName.trim().toLowerCase();
  const savedVendor = (vendors || []).find((v) => v.name.trim().toLowerCase() === normName);

  const seenSignatures = new Set<string>();
  const historyMap = new Map<string, ReconciledVendorPaymentItem>();

  // 1. Gather all recorded payments from the saved vendor's ledger
  (savedVendor?.payments || []).forEach((p) => {
    const timeKey = p.timestamp ? p.timestamp.slice(0, 16) : (p.date || p.paymentDate || '');
    const signature = `${p.amount}_${p.paymentDate || p.date || ''}_${timeKey}_${p.lotId || 'all'}`;
    if (!seenSignatures.has(signature) && !historyMap.has(p.id)) {
      seenSignatures.add(signature);
      historyMap.set(p.id, {
        id: p.id,
        vendorName: p.vendorName || vendorName,
        amount: Number(p.amount) || 0,
        date: (p.paymentDate || p.date || p.timestamp || '').slice(0, 10),
        paymentMethod: p.paymentMethod || 'cash',
        lotId: p.lotId,
        notes: p.notes,
      });
    }
  });

  // Track lots that are explicitly linked in the payment ledger
  const linkedLotIds = new Set<string>();
  historyMap.forEach((p) => {
    if (p.lotId) linkedLotIds.add(p.lotId);
  });

  // Pool of unassigned/general vendor payments (payments made to vendor without a specific lotId)
  let unassignedSavedPool = Array.from(historyMap.values())
    .filter((p) => !p.lotId)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // 2. Evaluate each lot of this vendor
  vendorLots.forEach((lot) => {
    const lotPaid =
      lot.vendorPaymentAmount !== undefined
        ? Number(lot.vendorPaymentAmount) || 0
        : lot.vendorPaymentStatus === 'paid'
        ? Number(lot.summary.netPayableToVendor) || 0
        : 0;

    if (lotPaid > 0) {
      // If this lot was already explicitly recorded in a saved payment, it's accounted for
      if (linkedLotIds.has(lot.id)) {
        return;
      }

      // If covered by general/unassigned vendor payments (distributed across lots), it's already accounted for in savedVendor.payments
      if (unassignedSavedPool >= lotPaid) {
        unassignedSavedPool -= lotPaid;
        return;
      } else if (unassignedSavedPool > 0) {
        const excess = lotPaid - unassignedSavedPool;
        unassignedSavedPool = 0;
        if (excess > 0) {
          const lotPayKey = `lot-excess-${lot.id}`;
          historyMap.set(lotPayKey, {
            id: lotPayKey,
            vendorName: lot.vendorName,
            amount: excess,
            date: (lot.vendorPaymentDate || (lot.vendorPaymentStatus === 'paid' ? lot.arrivalDate : '') || '').slice(0, 10),
            paymentMethod: lot.vendorPaymentMethod || 'cash',
            lotId: lot.id,
            notes: lot.vendorPaymentNotes || 'لاٹ ادائیگی',
          });
        }
      } else {
        // Not covered by any saved payment record (e.g. lot toggled directly to 'paid')
        const lotPayKey = `lot-pay-${lot.id}`;
        historyMap.set(lotPayKey, {
          id: lotPayKey,
          vendorName: lot.vendorName,
          amount: lotPaid,
          date: (lot.vendorPaymentDate || (lot.vendorPaymentStatus === 'paid' ? lot.arrivalDate : '') || '').slice(0, 10),
          paymentMethod: lot.vendorPaymentMethod || 'cash',
          lotId: lot.id,
          notes: lot.vendorPaymentNotes || 'لاٹ ادائیگی',
        });
      }
    }
  });

  return Array.from(historyMap.values());
}

/**
 * Returns all reconciled vendor payment records across all vendors and lots.
 */
export function getAllReconciledVendorPayments(
  lots: VendorLot[],
  vendors: SavedVendor[] = []
): ReconciledVendorPaymentItem[] {
  const vendorNamesSet = new Set<string>();
  (lots || []).forEach((l) => {
    if (l.vendorName) vendorNamesSet.add(l.vendorName.trim());
  });
  (vendors || []).forEach((v) => {
    if (v.name) vendorNamesSet.add(v.name.trim());
  });

  const allPayments: ReconciledVendorPaymentItem[] = [];
  vendorNamesSet.forEach((vendorName) => {
    const vLots = (lots || []).filter(
      (l) => l.vendorName.trim().toLowerCase() === vendorName.toLowerCase()
    );
    const vPayments = getReconciledVendorPaymentsForVendor(vendorName, vLots, vendors);
    allPayments.push(...vPayments);
  });

  return allPayments;
}
