import { VendorLot, AppSettings } from '../types';
import { unitLabels } from './localization';
import { formatPKR } from './currency';

/**
 * Ensures custom Urdu fonts (Noto Nastaliq Urdu & Noto Sans Arabic) are
 * fully loaded and ready in the browser before canvas drawing.
 */
export async function ensureUrduFontsLoaded(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
      await Promise.allSettled([
        document.fonts.load('16px "Noto Nastaliq Urdu"'),
        document.fonts.load('bold 24px "Noto Nastaliq Urdu"'),
        document.fonts.load('bold 14px "Noto Sans Arabic"'),
        document.fonts.load('12px "Noto Sans Arabic"'),
      ]);
    } catch (e) {
      console.warn('Font loading check error:', e);
    }
  }
}

/**
 * Generates an ultra-crisp, self-contained HTML5 Canvas 2D image of the
 * minimal local shop POS-style Vendor Invoice.
 */
export async function generateMandiInvoiceCanvasAsync(lot: VendorLot, settings: AppSettings): Promise<HTMLCanvasElement> {
  await ensureUrduFontsLoaded();
  return generateMandiInvoiceCanvas(lot, settings);
}

/**
 * Generates a clean, minimal, monochrome/high-contrast local shop (POS) slip image.
 * Excludes customer/buyer names and presents: Item, Qty, Rate, Total, Deductions, Net Amount, and Payment Status (Pending/Paid).
 */
export function generateMandiInvoiceCanvas(lot: VendorLot, settings: AppSettings): HTMLCanvasElement {
  const width = 560; // Standard compact POS invoice width
  const isUrdu = settings.language === 'ur';
  const unitLabel = unitLabels[lot.unitType][settings.language];

  // Calculate dynamic canvas height
  const baseHeight = 490;
  const salesHeight = Math.max(lot.sales.length * 30, 36);

  const activeExpensesList: { label: string; amount: number }[] = [];
  if (lot.expenses.commission.enabled) {
    activeExpensesList.push({
      label: `کمیشن (${lot.expenses.commission.rate}%):`,
      amount: lot.expenses.commission.amount,
    });
  }
  if (lot.expenses.kiraya.enabled) {
    activeExpensesList.push({
      label: 'کرایہ گاڑی:',
      amount: lot.expenses.kiraya.amount,
    });
  }
  if (lot.expenses.mazdoori.enabled) {
    activeExpensesList.push({
      label: 'مزدوری:',
      amount: lot.expenses.mazdoori.amount,
    });
  }
  if (lot.expenses.munshiana.enabled) {
    activeExpensesList.push({
      label: 'منشیانہ:',
      amount: lot.expenses.munshiana.amount,
    });
  }
  if (lot.expenses.naqdAdvance.enabled) {
    activeExpensesList.push({
      label: 'نقد پیشگی:',
      amount: lot.expenses.naqdAdvance.amount,
    });
  }
  if (lot.expenses.marketFee.enabled) {
    activeExpensesList.push({
      label: 'مارکیٹ فیس:',
      amount: lot.expenses.marketFee.amount,
    });
  }
  if (lot.expenses.customExpenses) {
    lot.expenses.customExpenses.forEach((ce) => {
      activeExpensesList.push({
        label: `${ce.nameUrdu}:`,
        amount: ce.amount,
      });
    });
  }

  const expensesHeight = activeExpensesList.length * 24 + 50;
  const totalHeight = baseHeight + salesHeight + expensesHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2; // 2x retina sharpness
  canvas.height = totalHeight * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(2, 2);

  // 1. Crisp White POS Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer border
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 12, width - 24, totalHeight - 24);

  // 2. POS Header
  // Bismillah
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ', width / 2, 36);

  // Shop Name (Main Title)
  ctx.font = 'bold 22px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.fillText(settings.shopNameUrdu || settings.shopNameEn, width / 2, 70);

  // Proprietor & Contact
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`پروپرائٹر: ${settings.arhtiNameUrdu || settings.arhtiNameEn}`, width / 2, 92);

  ctx.fillStyle = '#475569';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`📍 ${settings.shopAddressUrdu || settings.shopAddressEn}  •  📞 فون: ${settings.shopPhone}`, width / 2, 110);

  // POS Invoice Badge
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(24, 122, width - 48, 22);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 122, width - 48, 22);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('پکی پرچی رسید برائے زمیندار (POS Invoice)', width / 2, 137);

  // Dashed Separator Line
  const drawDashedLine = (y: number) => {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(width - 24, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawDashedLine(152);

  // 3. Bill Metadata (Clean 2-column layout)
  const metaY = 168;
  ctx.textAlign = 'right';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';

  // Left Column
  ctx.fillStyle = '#64748b';
  ctx.fillText('تاریخ:', width / 2 - 20, metaY);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(lot.arrivalDate, width / 2 - 60, metaY);

  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('کل مال:', width / 2 - 20, metaY + 22);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`${lot.productUrdu} (${lot.totalQuantity} ${unitLabel})`, width / 2 - 65, metaY + 22);

  // Right Column
  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('بل نمبر:', width - 30, metaY);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px monospace, sans-serif';
  ctx.fillText(`#${lot.lotNumber}`, width - 80, metaY);

  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('زمیندار:', width - 30, metaY + 22);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.fillText(`${lot.vendorName} ${lot.vendorCity ? `(${lot.vendorCity})` : ''}`, width - 75, metaY + 22);

  if (lot.vehicleNumber) {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText('گاڑی:', width - 30, metaY + 44);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(lot.vehicleNumber, width - 70, metaY + 44);
  }

  const tableStartY = metaY + (lot.vehicleNumber ? 56 : 38);
  drawDashedLine(tableStartY);

  // 4. Sales Table Header (Item, Qty, Rate, Total - NO CUSTOMER NAME)
  let currentY = tableStartY + 12;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(24, currentY, width - 48, 26);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, currentY, width - 48, 26);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('#', 42, currentY + 17);
  ctx.textAlign = 'right';
  ctx.fillText('تفصیلِ جنس (Item)', width - 60, currentY + 17);
  ctx.textAlign = 'center';
  ctx.fillText(`تعداد (${unitLabel})`, width - 210, currentY + 17);
  ctx.textAlign = 'right';
  ctx.fillText('ریٹ', width - 300, currentY + 17);
  ctx.fillText('کل رقم (روپے)', 120, currentY + 17);

  currentY += 26;

  // Sales Table Rows (Pure item, quantity, rate, amount - NO buyer name)
  if (lot.sales.length === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, currentY, width - 48, 28);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(24, currentY, width - 48, 28);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ابھی تک کوئی بولی فروخت درج نہیں ہوئی۔', width / 2, currentY + 18);
    currentY += 28;
  } else {
    lot.sales.forEach((s, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#fcfcfc';
      ctx.fillRect(24, currentY, width - 48, 28);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(24, currentY, width - 48, 28);

      ctx.fillStyle = '#64748b';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, 42, currentY + 18);

      // Product Item Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(lot.productUrdu, width - 60, currentY + 18);

      // Quantity
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.quantity}`, width - 210, currentY + 18);

      // Rate
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(s.ratePerUnit, 'Rs.', 'en'), width - 300, currentY + 18);

      // Amount
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(formatPKR(s.totalAmount, 'Rs.', 'en'), 120, currentY + 18);

      currentY += 28;
    });
  }

  // Gross Sales Subtotal Row
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(24, currentY, width - 48, 28);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, currentY, width - 48, 28);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`کل فروخت (${lot.summary.totalSoldQuantity} ${unitLabel}):`, width - 40, currentY + 18);

  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(formatPKR(lot.summary.grossSales, '₨', 'en'), 120, currentY + 19);

  currentY += 36;
  drawDashedLine(currentY);
  currentY += 12;

  // 5. Deductions / Expenses Section (کٹوتیاں و اخراجات)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('منہا کٹوتیاں و اخراجات (Deductions):', width - 30, currentY + 4);

  currentY += 18;

  if (activeExpensesList.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText('کوئی کٹوتی لاگو نہیں ہے۔', width - 30, currentY + 10);
    currentY += 20;
  } else {
    activeExpensesList.forEach((item) => {
      ctx.fillStyle = '#334155';
      ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.label, width - 30, currentY + 12);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`- ${formatPKR(item.amount, 'Rs.', 'en')}`, 120, currentY + 12);

      currentY += 22;
    });
  }

  // Total Deductions Line
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('کل منہا اخراجات:', width - 30, currentY + 14);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`- ${formatPKR(lot.summary.totalExpenses, 'Rs.', 'en')}`, 120, currentY + 14);

  currentY += 28;
  drawDashedLine(currentY);
  currentY += 14;

  // 6. Net Meezan Box (صافی رقم برائے ادائیگی)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(24, currentY, width - 48, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('صافی رقم برائے ادائیگی (Net Payable):', width - 40, currentY + 32);

  ctx.font = 'bold 22px system-ui, monospace, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatPKR(lot.summary.netPayableToVendor, '₨', 'en'), 40, currentY + 34);

  currentY += 62;

  // 7. Vendor Payment Status Box (بقایا یا ادا شدہ)
  const isPaid = lot.vendorPaymentStatus === 'paid';
  ctx.fillStyle = isPaid ? '#ecfdf5' : '#fef2f2';
  ctx.fillRect(24, currentY, width - 48, 34);
  ctx.strokeStyle = isPaid ? '#059669' : '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, currentY, width - 48, 34);

  ctx.fillStyle = isPaid ? '#065f46' : '#991b1b';
  ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    isPaid
      ? `✅ ادائیگی کی کیفیت: ادا شدہ (PAID IN FULL)${lot.vendorPaymentDate ? ` - بتاریخ ${lot.vendorPaymentDate}` : ''}`
      : '⚠️ ادائیگی کی کیفیت: ادائیگی بقایا (PAYMENT PENDING)',
    width - 40,
    currentY + 22
  );

  currentY += 46;

  // 8. Signatures & Footer
  ctx.strokeStyle = '#94a3b8';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(40, currentY + 16);
  ctx.lineTo(180, currentY + 16);
  ctx.moveTo(width - 180, currentY + 16);
  ctx.lineTo(width - 40, currentY + 16);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 10px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('دستخط منشی / کیشیئر', 110, currentY + 30);
  ctx.fillText('دستخط و مہر آڑھتی', width - 110, currentY + 30);

  // Footer Computerized note
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('کمپیوٹرائزڈ رسید برائے زمیندار | شکریہ', width / 2, totalHeight - 16);

  return canvas;
}

/**
 * Generates an ultra-crisp, minimal local shop POS HTML5 Canvas 2D image for a Consolidated Bill (تمام اجناس کا مشترکہ بل)
 * Excludes customer names and shows Product, Qty, Rate, Total, and payment status.
 */
export function generateVendorConsolidatedInvoiceCanvas(
  vendorName: string,
  vendorPhone: string | undefined,
  vendorCity: string | undefined,
  lots: VendorLot[],
  settings: AppSettings,
  dateLabel: string
): HTMLCanvasElement {
  const width = 640;
  const isUrdu = settings.language === 'ur';

  // Aggregate stats
  let totalGross = 0;
  let totalExpenses = 0;
  let totalNetPayable = 0;
  let totalSoldQuantity = 0;
  let totalUnits = 0;

  const aggregatedExpenses = {
    commission: 0,
    kiraya: 0,
    mazdoori: 0,
    munshiana: 0,
    naqdAdvance: 0,
    marketFee: 0,
    customTotal: 0,
  };

  let totalSalesCount = 0;
  let allLotsPaid = true;

  lots.forEach((lot) => {
    totalGross += lot.summary.grossSales;
    totalExpenses += lot.summary.totalExpenses;
    totalNetPayable += lot.summary.netPayableToVendor;
    totalSoldQuantity += lot.summary.totalSoldQuantity;
    totalUnits += lot.totalQuantity;
    totalSalesCount += lot.sales.length;
    if (lot.vendorPaymentStatus !== 'paid') {
      allLotsPaid = false;
    }

    if (lot.expenses.commission.enabled) aggregatedExpenses.commission += lot.expenses.commission.amount;
    if (lot.expenses.kiraya.enabled) aggregatedExpenses.kiraya += lot.expenses.kiraya.amount;
    if (lot.expenses.mazdoori.enabled) aggregatedExpenses.mazdoori += lot.expenses.mazdoori.amount;
    if (lot.expenses.munshiana.enabled) aggregatedExpenses.munshiana += lot.expenses.munshiana.amount;
    if (lot.expenses.naqdAdvance.enabled) aggregatedExpenses.naqdAdvance += lot.expenses.naqdAdvance.amount;
    if (lot.expenses.marketFee.enabled) aggregatedExpenses.marketFee += lot.expenses.marketFee.amount;
    lot.expenses.customExpenses?.forEach((ce) => {
      aggregatedExpenses.customTotal += ce.amount;
    });
  });

  const headerHeight = 240;
  const lotsListHeight = lots.length * 48;
  const salesRowsHeight = totalSalesCount * 26;
  const deductionsHeight = 120;
  const meezanHeight = 110;
  const footerHeight = 80;
  const totalHeight = headerHeight + lotsListHeight + salesRowsHeight + deductionsHeight + meezanHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = totalHeight * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(2, 2);

  // 1. Clean White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer Crisp Border
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 12, width - 24, totalHeight - 24);

  // Bismillah
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ', width / 2, 36);

  // Main Shop Name
  ctx.font = 'bold 22px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.fillText(settings.shopNameUrdu || settings.shopNameEn, width / 2, 68);

  // Proprietor & Contact
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`پروپرائٹر: ${settings.arhtiNameUrdu || settings.arhtiNameEn}`, width / 2, 88);

  ctx.fillStyle = '#475569';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`📍 ${settings.shopAddressUrdu || settings.shopAddressEn}  •  📞 فون: ${settings.shopPhone}`, width / 2, 106);

  // POS Consolidated Badge
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(24, 118, width - 48, 22);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 118, width - 48, 22);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('پکی پرچی مشترکہ بل برائے زمیندار (Consolidated POS Invoice)', width / 2, 133);

  // Dashed Separator
  const drawDashedLine = (y: number) => {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(width - 24, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawDashedLine(148);

  // Vendor & Date Metadata
  const metaY = 164;
  ctx.textAlign = 'right';

  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('زمیندار:', width - 30, metaY);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.fillText(`${vendorName} ${vendorCity ? `(${vendorCity})` : ''}`, width - 80, metaY);

  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('تاریخ حساب:', width / 2 - 20, metaY);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(dateLabel, width / 2 - 85, metaY);

  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('کل اجناس:', width - 30, metaY + 22);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`${lots.length} اجناس (${totalUnits} کل نگ)`, width - 85, metaY + 22);

  let currentY = metaY + 36;
  drawDashedLine(currentY);
  currentY += 12;

  // 2. Render Each Product's Sales (Item, Qty, Rate, Amount - NO BUYER NAME)
  lots.forEach((lot, lIdx) => {
    const uLabel = unitLabels[lot.unitType][settings.language];

    // Product Title
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(24, currentY, width - 48, 24);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, currentY, width - 48, 24);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`${lIdx + 1}. جنس: ${lot.productUrdu} (#${lot.lotNumber})`, width - 34, currentY + 16);

    ctx.fillStyle = '#475569';
    ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`آمد: ${lot.totalQuantity} • فروخت: ${lot.summary.totalSoldQuantity}`, 34, currentY + 16);

    currentY += 24;

    // Table Header
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(24, currentY, width - 48, 22);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(24, currentY, width - 48, 22);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 10px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('#', 40, currentY + 15);
    ctx.textAlign = 'right';
    ctx.fillText('تفصیلِ آئٹم (Item)', width - 50, currentY + 15);
    ctx.textAlign = 'center';
    ctx.fillText(`تعداد (${uLabel})`, width - 200, currentY + 15);
    ctx.textAlign = 'right';
    ctx.fillText('ریٹ', width - 290, currentY + 15);
    ctx.fillText('کل رقم', 100, currentY + 15);

    currentY += 22;

    if (lot.sales.length === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(24, currentY, width - 48, 24);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(24, currentY, width - 48, 24);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Noto Sans Arabic", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('کوئی بولی فروخت درج نہیں ہوئی۔', width / 2, currentY + 16);
      currentY += 24;
    } else {
      lot.sales.forEach((sale, sIdx) => {
        ctx.fillStyle = sIdx % 2 === 0 ? '#ffffff' : '#fcfcfc';
        ctx.fillRect(24, currentY, width - 48, 24);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(24, currentY, width - 48, 24);

        ctx.fillStyle = '#64748b';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${sIdx + 1}`, 40, currentY + 16);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px "Noto Sans Arabic", system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(lot.productUrdu, width - 50, currentY + 16);

        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`${sale.quantity}`, width - 200, currentY + 16);

        ctx.font = '10px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(formatPKR(sale.ratePerUnit, 'Rs.', 'en'), width - 290, currentY + 16);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px system-ui';
        ctx.fillText(formatPKR(sale.totalAmount, 'Rs.', 'en'), 100, currentY + 16);

        currentY += 24;
      });
    }

    currentY += 8;
  });

  // Gross Total
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(24, currentY, width - 48, 26);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, currentY, width - 48, 26);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('مجموعی کل فروخت رقم:', width - 36, currentY + 17);

  ctx.font = 'bold 13px system-ui';
  ctx.fillText(formatPKR(totalGross, 'Rs.', 'en'), 100, currentY + 17);

  currentY += 34;
  drawDashedLine(currentY);
  currentY += 12;

  // Deductions Box
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('مجموعی کٹوتیاں و اخراجات (Total Deductions):', width - 30, currentY + 4);

  currentY += 18;

  const expItems = [
    { label: 'کمیشن', val: aggregatedExpenses.commission },
    { label: 'کرایہ', val: aggregatedExpenses.kiraya },
    { label: 'مزدوری', val: aggregatedExpenses.mazdoori },
    { label: 'منشیانہ', val: aggregatedExpenses.munshiana },
    { label: 'نقد ایڈوانس', val: aggregatedExpenses.naqdAdvance },
    { label: 'مارکیٹ فیس', val: aggregatedExpenses.marketFee },
  ].filter((item) => item.val > 0);

  let expX = width - 34;
  let expY = currentY;
  expItems.forEach((it, i) => {
    if (i === 3) {
      expX = width - 34;
      expY += 20;
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText(`${it.label}:`, expX, expY);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px system-ui';
    ctx.fillText(formatPKR(it.val, 'Rs.', 'en'), expX - 50, expY);
    expX -= 180;
  });

  currentY = expY + 22;

  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('کل منہا کٹوتی:', width - 30, currentY + 10);
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`- ${formatPKR(totalExpenses, 'Rs.', 'en')}`, 100, currentY + 10);

  currentY += 26;
  drawDashedLine(currentY);
  currentY += 12;

  // Final Net Meezan Box
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(24, currentY, width - 48, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('کل صافی میزان برائے ادائیگی (Net Payable):', width - 36, currentY + 30);

  ctx.font = 'bold 20px system-ui, monospace, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatPKR(totalNetPayable, '₨', 'en'), 36, currentY + 32);

  currentY += 58;

  // Payment Status Box
  ctx.fillStyle = allLotsPaid ? '#ecfdf5' : '#fef2f2';
  ctx.fillRect(24, currentY, width - 48, 30);
  ctx.strokeStyle = allLotsPaid ? '#059669' : '#dc2626';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, currentY, width - 48, 30);

  ctx.fillStyle = allLotsPaid ? '#065f46' : '#991b1b';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    allLotsPaid ? '✅ ادائیگی کی کیفیت: تمام اجناس ادا شدہ (ALL PAID)' : '⚠️ ادائیگی کی کیفیت: ادائیگی بقایا (PAYMENT PENDING)',
    width - 34,
    currentY + 20
  );

  currentY += 40;

  // Signatures
  ctx.strokeStyle = '#94a3b8';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(40, currentY + 14);
  ctx.lineTo(180, currentY + 14);
  ctx.moveTo(width - 180, currentY + 14);
  ctx.lineTo(width - 40, currentY + 14);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 10px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('دستخط منشی / کیشیئر', 110, currentY + 28);
  ctx.fillText('دستخط و مہر آڑھتی', width - 110, currentY + 28);

  // Footer text
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('کمپیوٹرائزڈ مشترکہ رسید برائے زمیندار | شکریہ', width / 2, totalHeight - 14);

  return canvas;
}

/**
 * Prints an authentic, compact 80mm POS Thermal Receipt for a single Vendor Lot.
 * Isolates receipt inside a hidden iframe with zero margins and roll-cut styling.
 */
export function printThermalPOSReceipt(lot: VendorLot, settings: AppSettings): void {
  const existingIframe = document.getElementById('thermal-pos-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  const unitLabel = unitLabels[lot.unitType][settings.language];
  const isPaid = lot.vendorPaymentStatus === 'paid';

  const iframe = document.createElement('iframe');
  iframe.id = 'thermal-pos-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  const salesRowsHtml = lot.sales.map((sale, idx) => `
    <tr>
      <td style="text-align: right; padding: 2px 1px;">${idx + 1}. ${lot.productUrdu}</td>
      <td style="text-align: center; padding: 2px 1px; font-weight: bold;">${sale.quantity}</td>
      <td style="text-align: left; padding: 2px 1px;">Rs.${sale.ratePerUnit.toLocaleString()}</td>
      <td style="text-align: left; padding: 2px 1px; font-weight: bold;">Rs.${sale.totalAmount.toLocaleString()}</td>
    </tr>
  `).join('');

  const expensesHtml = `
    ${lot.expenses.commission.enabled ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>کمیشن (${lot.expenses.commission.rate}%):</span>
        <span style="font-weight:bold;">${formatPKR(lot.expenses.commission.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.kiraya.enabled ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>کرایہ گاڑی:</span>
        <span style="font-weight:bold;">${formatPKR(lot.expenses.kiraya.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.mazdoori.enabled ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>مزدوری:</span>
        <span style="font-weight:bold;">${formatPKR(lot.expenses.mazdoori.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.munshiana.enabled ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>منشیانہ:</span>
        <span style="font-weight:bold;">${formatPKR(lot.expenses.munshiana.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.naqdAdvance.enabled ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>نقد پیشگی (Advance):</span>
        <span style="font-weight:bold;">${formatPKR(lot.expenses.naqdAdvance.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.marketFee.enabled ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>مارکیٹ فیس:</span>
        <span style="font-weight:bold;">${formatPKR(lot.expenses.marketFee.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${(lot.expenses.customExpenses || []).map((ce) => `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>${ce.nameUrdu}:</span>
        <span style="font-weight:bold;">${formatPKR(ce.amount, settings.currencySymbol, settings.language)}</span>
      </div>
    `).join('')}
  `;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
      <meta charset="utf-8" />
      <title>POS Receipt #${lot.lotNumber}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: 80mm auto;
          margin: 0mm;
        }
        @media print {
          html, body {
            width: 74mm !important;
            max-width: 74mm !important;
            margin: 0 auto !important;
            padding: 1mm 1mm !important;
          }
        }
        body {
          font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', Tahoma, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          color: #000000;
          background: #ffffff;
          width: 74mm;
          margin: 0 auto;
          padding: 2mm 1mm;
          direction: rtl;
          text-align: right;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .dashed { border-top: 1px dashed #000; margin: 4px 0; }
        .double { border-top: 2px solid #000; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { border-bottom: 1px solid #000; padding: 2px 1px; font-weight: bold; }
        td { padding: 2px 1px; }
      </style>
    </head>
    <body>
      <div class="text-center" style="margin-bottom: 4px;">
        <div style="font-size: 11px; font-weight: bold;">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
        <div style="font-size: 16px; font-weight: bold; margin: 1px 0;">${settings.shopNameUrdu || settings.shopNameEn}</div>
        <div style="font-size: 11px;">پروپرائٹر: <b>${settings.arhtiNameUrdu || settings.arhtiNameEn}</b></div>
        <div style="font-size: 9.5px;">📍 ${settings.shopAddressUrdu || settings.shopAddressEn} | 📞 ${settings.shopPhone}</div>
        <div style="font-size: 10px; font-weight: bold; border: 1px solid #000; display: inline-block; padding: 1px 6px; margin-top: 3px;">
          پکی پرچی رسید برائے زمیندار (POS Slip)
        </div>
      </div>

      <div class="dashed"></div>

      <div style="font-size: 10px; line-height: 1.4;">
        <div style="display:flex; justify-content:space-between;">
          <span>بل نمبر: <b>#${lot.lotNumber}</b></span>
          <span>تاریخ: <b>${lot.arrivalDate}</b></span>
        </div>
        <div>زمیندار: <b style="font-size: 11.5px;">${lot.vendorName}</b> ${lot.vendorCity ? `(${lot.vendorCity})` : ''}</div>
        <div style="display:flex; justify-content:space-between;">
          <span>آمد مال: <b>${lot.productUrdu}</b></span>
          <span>تعداد: <b>${lot.totalQuantity} ${unitLabel}</b></span>
        </div>
        ${lot.vehicleNumber ? `<div>گاڑی نمبر: <b>${lot.vehicleNumber}</b></div>` : ''}
      </div>

      <div class="dashed"></div>

      <table>
        <thead>
          <tr>
            <th style="text-align: right;">جنس</th>
            <th style="text-align: center;">تعداد</th>
            <th style="text-align: left;">ریٹ</th>
            <th style="text-align: left;">رقم</th>
          </tr>
        </thead>
        <tbody>
          ${salesRowsHtml}
        </tbody>
      </table>

      <div class="dashed"></div>

      <div style="display:flex; justify-content:space-between; font-weight:bold; font-size: 11px;">
        <span>کل فروخت (${lot.summary.totalSoldQuantity} ${unitLabel}):</span>
        <span>${formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}</span>
      </div>

      <div class="dashed"></div>

      <div style="font-size: 9.5px; font-weight: bold; margin-bottom: 1px;">منہا کٹوتیاں و اخراجات:</div>
      <div style="font-size: 10px;">
        ${expensesHtml}
      </div>
      <div style="display:flex; justify-content:space-between; font-weight:bold; color:#000; border-top: 1px solid #000; margin-top: 2px; padding-top: 2px; font-size: 10.5px;">
        <span>کل منہا اخراجات:</span>
        <span>- ${formatPKR(lot.summary.totalExpenses, settings.currencySymbol, settings.language)}</span>
      </div>

      <div class="double"></div>

      <div style="border: 2px solid #000; padding: 4px; text-align: center; margin: 4px 0; background: #f8f8f8;">
        <div style="font-size: 10px; font-weight: bold;">صافی میزان برائے ادائیگی (Net Payable):</div>
        <div style="font-size: 16px; font-weight: 900; margin-top: 1px;">
          ${formatPKR(lot.summary.netPayableToVendor, settings.currencySymbol, settings.language)}
        </div>
      </div>

      <div style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-size: 9.5px; font-weight: bold; margin: 2px 0;">
        کیفیت: ${isPaid ? '✅ ادا شدہ (PAID IN FULL)' : '⏳ ادائیگی بقایا (PENDING)'}
      </div>

      <div class="dashed"></div>

      <div style="display:flex; justify-content:space-between; font-size: 9px; text-align:center; margin-top: 8px;">
        <div>________________<br/>دستخط منشی / کیشیئر</div>
        <div>________________<br/>دستخط و مہر آڑھتی</div>
      </div>

      <div style="text-align: center; font-size: 8px; margin-top: 6px; color: #444;">
        ڈیجیٹل منڈی منشی سسٹم کمپیوٹرائزڈ پرچی
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 400);
}

/**
 * Prints an authentic, compact 80mm POS Thermal Receipt for Consolidated Vendor Lots.
 */
export function printConsolidatedThermalPOSReceipt(
  vendorName: string,
  vendorPhone: string | undefined,
  vendorCity: string | undefined,
  lots: VendorLot[],
  settings: AppSettings,
  dateLabel?: string
): void {
  const existingIframe = document.getElementById('thermal-pos-consolidated-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'thermal-pos-consolidated-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  const totals = lots.reduce(
    (acc, lot) => {
      acc.grossSales += lot.summary.grossSales;
      acc.totalExpenses += lot.summary.totalExpenses;
      acc.netPayable += lot.summary.netPayableToVendor;
      const lotPaid = lot.vendorPaymentAmount !== undefined ? lot.vendorPaymentAmount : (lot.vendorPaymentStatus === 'paid' ? lot.summary.netPayableToVendor : 0);
      acc.totalPaid += lotPaid;
      return acc;
    },
    { grossSales: 0, totalExpenses: 0, netPayable: 0, totalPaid: 0 }
  );

  const displayDate = dateLabel || lots[0]?.arrivalDate || new Date().toISOString().slice(0, 10);
  const allLotsPaid = totals.totalPaid >= totals.netPayable && totals.netPayable > 0;

  const lotsRowsHtml = lots.map((l, idx) => `
    <tr>
      <td style="text-align: right; padding: 2px 1px;">${idx + 1}. #${l.lotNumber} ${l.productUrdu} (${l.totalQuantity})</td>
      <td style="text-align: left; padding: 2px 1px;">Rs.${l.summary.grossSales.toLocaleString()}</td>
      <td style="text-align: left; padding: 2px 1px; color:#c00;">-Rs.${l.summary.totalExpenses.toLocaleString()}</td>
      <td style="text-align: left; padding: 2px 1px; font-weight: bold;">Rs.${l.summary.netPayableToVendor.toLocaleString()}</td>
    </tr>
  `).join('');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
      <meta charset="utf-8" />
      <title>Consolidated POS Receipt - ${vendorName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: 80mm auto;
          margin: 0mm;
        }
        @media print {
          html, body {
            width: 74mm !important;
            max-width: 74mm !important;
            margin: 0 auto !important;
            padding: 1mm 1mm !important;
          }
        }
        body {
          font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', Tahoma, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          color: #000000;
          background: #ffffff;
          width: 74mm;
          margin: 0 auto;
          padding: 2mm 1mm;
          direction: rtl;
          text-align: right;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .dashed { border-top: 1px dashed #000; margin: 4px 0; }
        .double { border-top: 2px solid #000; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
        th { border-bottom: 1px solid #000; padding: 2px 1px; font-weight: bold; }
        td { padding: 2px 1px; }
      </style>
    </head>
    <body>
      <div class="text-center" style="margin-bottom: 4px;">
        <div style="font-size: 11px; font-weight: bold;">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
        <div style="font-size: 16px; font-weight: bold; margin: 1px 0;">${settings.shopNameUrdu || settings.shopNameEn}</div>
        <div style="font-size: 11px;">پروپرائٹر: <b>${settings.arhtiNameUrdu || settings.arhtiNameEn}</b></div>
        <div style="font-size: 9.5px;">📍 ${settings.shopAddressUrdu || settings.shopAddressEn} | 📞 ${settings.shopPhone}</div>
        <div style="font-size: 10px; font-weight: bold; border: 1px solid #000; display: inline-block; padding: 1px 6px; margin-top: 3px;">
          مجموعی بل پرچی برائے زمیندار (${lots.length} لاٹس)
        </div>
      </div>

      <div class="dashed"></div>

      <div style="font-size: 10px; line-height: 1.4;">
        <div>زمیندار: <b style="font-size: 12px;">${vendorName}</b> ${vendorCity ? `(${vendorCity})` : ''}</div>
        <div style="display:flex; justify-content:space-between;">
          <span>تاریخ: <b>${displayDate}</b></span>
          <span>کل اجناس: <b>${lots.length} لاٹس</b></span>
        </div>
      </div>

      <div class="dashed"></div>

      <table>
        <thead>
          <tr>
            <th style="text-align: right;">لاٹ و جنس</th>
            <th style="text-align: left;">فروخت</th>
            <th style="text-align: left;">کٹوتی</th>
            <th style="text-align: left;">صافی</th>
          </tr>
        </thead>
        <tbody>
          ${lotsRowsHtml}
        </tbody>
      </table>

      <div class="dashed"></div>

      <div style="font-size: 10.5px; line-height: 1.5;">
        <div style="display:flex; justify-content:space-between;">
          <span>کل فروخت رقم:</span>
          <b>${formatPKR(totals.grossSales, settings.currencySymbol, settings.language)}</b>
        </div>
        <div style="display:flex; justify-content:space-between; color:#000;">
          <span>کل منہا کٹوتیاں:</span>
          <b style="color:#c00;">- ${formatPKR(totals.totalExpenses, settings.currencySymbol, settings.language)}</b>
        </div>
      </div>

      <div class="double"></div>

      <div style="border: 2px solid #000; padding: 4px; text-align: center; margin: 4px 0; background: #f8f8f8;">
        <div style="font-size: 10px; font-weight: bold;">صافی میزان برائے ادائیگی (Net Payable):</div>
        <div style="font-size: 16px; font-weight: 900; margin-top: 1px;">
          ${formatPKR(totals.netPayable, settings.currencySymbol, settings.language)}
        </div>
      </div>

      <div style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-size: 9.5px; font-weight: bold; margin: 2px 0;">
        کیفیت: ${allLotsPaid ? '✅ تمام اجناس ادا شدہ (ALL PAID)' : '⏳ ادائیگی بقایا (PAYMENT PENDING)'}
      </div>

      <div class="dashed"></div>

      <div style="display:flex; justify-content:space-between; font-size: 9px; text-align:center; margin-top: 8px;">
        <div>________________<br/>دستخط منشی / کیشیئر</div>
        <div>________________<br/>دستخط و مہر آڑھتی</div>
      </div>

      <div style="text-align: center; font-size: 8px; margin-top: 6px; color: #444;">
        ڈیجیٹل منڈی منشی سسٹم کمپیوٹرائزڈ پرچی
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 400);
}
