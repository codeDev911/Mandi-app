import { VendorLot, LotExpenses, LotSummary, UnitType, AppSettings } from '../types';

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

export function getUnitMazdooriRate(unitType: UnitType, settings?: Partial<AppSettings>): number {
  if (settings?.unitMazdooriRates && typeof settings.unitMazdooriRates[unitType] === 'number') {
    return settings.unitMazdooriRates[unitType]!;
  }
  if (DEFAULT_UNIT_MAZDOORI_RATES[unitType] !== undefined) {
    return DEFAULT_UNIT_MAZDOORI_RATES[unitType];
  }
  return settings?.defaultMazdooriPerUnit ?? 20;
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
  const netPayableToVendor = grossSales - totalExpenses;

  // 4. Arhti's Net Income from this lot (Commission + Munshiana)
  const arhtiProfitCommission =
    (expenses.commission.enabled ? Number(expenses.commission.amount) || 0 : 0) +
    (expenses.munshiana.enabled ? Number(expenses.munshiana.amount) || 0 : 0);

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

export function generateLotNumber(existingLotsCount: number): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const seq = (existingLotsCount + 1).toString().padStart(3, '0');
  return `LOT-${dateStr}-${seq}`;
}
