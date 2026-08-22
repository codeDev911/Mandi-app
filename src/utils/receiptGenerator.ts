import { VendorLot, AppSettings } from '../types';
import { unitLabels } from './localization';
import { formatPKR } from './currency';
import { printHtmlViaIframe } from './printHelper';

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
 * Contains shop details, bill metadata, itemized details with unit types (e.g. 10 بوری), rate, total,
 * active deductions (کٹوتیاں / Katote), net payable (صافی رقم), and payment status.
 */
export function generateMandiInvoiceCanvas(lot: VendorLot, settings: AppSettings): HTMLCanvasElement {
  const width = 540; // Clean, standard 80mm POS slip canvas width
  const isUrdu = settings.language === 'ur';
  const unitLabel = unitLabels[lot.unitType]?.[settings.language] || lot.unitType;

  // Active Katote / Deductions
  const activeExpensesList: { label: string; amount: number }[] = [];
  if (lot.expenses.commission.enabled && lot.expenses.commission.amount > 0) {
    activeExpensesList.push({
      label: `کمیشن (${lot.expenses.commission.rate}%):`,
      amount: lot.expenses.commission.amount,
    });
  }
  if (lot.expenses.kiraya.enabled && lot.expenses.kiraya.amount > 0) {
    activeExpensesList.push({
      label: 'کرایہ گاڑی:',
      amount: lot.expenses.kiraya.amount,
    });
  }
  if (lot.expenses.mazdoori.enabled && lot.expenses.mazdoori.amount > 0) {
    activeExpensesList.push({
      label: 'مزدوری:',
      amount: lot.expenses.mazdoori.amount,
    });
  }
  if (lot.expenses.munshiana.enabled && lot.expenses.munshiana.amount > 0) {
    activeExpensesList.push({
      label: 'منشیانہ:',
      amount: lot.expenses.munshiana.amount,
    });
  }
  if (lot.expenses.naqdAdvance.enabled && lot.expenses.naqdAdvance.amount > 0) {
    activeExpensesList.push({
      label: 'نقد پیشگی (ایڈوانس):',
      amount: lot.expenses.naqdAdvance.amount,
    });
  }
  if (lot.expenses.marketFee.enabled && lot.expenses.marketFee.amount > 0) {
    activeExpensesList.push({
      label: 'مارکیٹ فیس:',
      amount: lot.expenses.marketFee.amount,
    });
  }
  if (lot.expenses.customExpenses) {
    lot.expenses.customExpenses.forEach((ce) => {
      if (ce.amount > 0) {
        activeExpensesList.push({
          label: `${ce.nameUrdu || ce.nameEn}:`,
          amount: ce.amount,
        });
      }
    });
  }

  // Calculate dynamic canvas height
  const baseHeight = 440;
  const salesHeight = Math.max(lot.sales.length * 28, 32);
  const expensesHeight = activeExpensesList.length * 22 + (activeExpensesList.length > 0 ? 44 : 20);
  const totalHeight = baseHeight + salesHeight + expensesHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2; // 2x retina sharpness
  canvas.height = totalHeight * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(2, 2);

  // 1. Crisp White POS Slip Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer clean border
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, width - 20, totalHeight - 20);

  // 2. POS Shop Header
  // Bismillah
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ', width / 2, 32);

  // Shop Name (Main Display)
  ctx.font = 'bold 21px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.fillText(settings.shopNameUrdu || settings.shopNameEn || 'سبزی و پھل کمیشن شاپ', width / 2, 62);

  // Proprietor & Contact Info
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`پروپرائٹر: ${settings.arhtiNameUrdu || settings.arhtiNameEn || 'آڑھتی صاحب'}`, width / 2, 82);

  ctx.fillStyle = '#475569';
  ctx.font = '10.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`📍 ${settings.shopAddressUrdu || settings.shopAddressEn || 'غلہ منڈی'}  •  📞 فون: ${settings.shopPhone || ''}`, width / 2, 98);

  // POS Invoice Badge
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(20, 108, width - 40, 20);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 108, width - 40, 20);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('پکی پرچی بل برائے زمیندار', width / 2, 122);

  // Dashed Separator Line Helper
  const drawDashedLine = (y: number) => {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawDashedLine(135);

  // 3. Bill Metadata (Clean 2-column layout)
  const metaY = 152;
  ctx.textAlign = 'right';
  ctx.font = '10.5px "Noto Sans Arabic", system-ui, sans-serif';

  // Left Column
  ctx.fillStyle = '#64748b';
  ctx.fillText('تاریخ:', width / 2 - 10, metaY);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(lot.arrivalDate, width / 2 - 45, metaY);

  ctx.fillStyle = '#64748b';
  ctx.font = '10.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('کل مال:', width / 2 - 10, metaY + 18);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`${lot.productUrdu} (${lot.totalQuantity} ${unitLabel})`, width / 2 - 50, metaY + 18);

  // Right Column
  ctx.fillStyle = '#64748b';
  ctx.font = '10.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('زمیندار:', width - 25, metaY);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.fillText(`${lot.vendorName} ${lot.vendorCity ? `(${lot.vendorCity})` : ''}`, width - 70, metaY);

  if (lot.vehicleNumber) {
    ctx.fillStyle = '#64748b';
    ctx.font = '10.5px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText('گاڑی نمبر:', width - 25, metaY + 36);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10.5px system-ui, sans-serif';
    ctx.fillText(lot.vehicleNumber, width - 75, metaY + 36);
  }

  const tableStartY = metaY + (lot.vehicleNumber ? 48 : 32);
  drawDashedLine(tableStartY);

  // 4. Sales Table Header (Details, Qty with unit type, Rate, Total)
  let currentY = tableStartY + 10;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(20, currentY, width - 40, 24);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, currentY, width - 40, 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('#', 36, currentY + 16);
  ctx.textAlign = 'right';
  ctx.fillText('تفصیلِ جنس', width - 50, currentY + 16);
  ctx.textAlign = 'center';
  ctx.fillText(`تعداد بمعہ پیکنگ`, width - 200, currentY + 16);
  ctx.textAlign = 'right';
  ctx.fillText('ریٹ', width - 290, currentY + 16);
  ctx.fillText('کل رقم', 100, currentY + 16);

  currentY += 24;

  // Sales Table Rows
  if (lot.sales.length === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(20, currentY, width - 40, 26);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(20, currentY, width - 40, 26);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10.5px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ابھی تک کوئی بولی فروخت درج نہیں ہوئی۔', width / 2, currentY + 17);
    currentY += 26;
  } else {
    lot.sales.forEach((s, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#fafafa';
      ctx.fillRect(20, currentY, width - 40, 26);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(20, currentY, width - 40, 26);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, 36, currentY + 17);

      // Product Item Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(lot.productUrdu, width - 50, currentY + 17);

      // Quantity with unit type
      ctx.font = 'bold 10.5px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.quantity} ${unitLabel}`, width - 200, currentY + 17);

      // Rate
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Rs. ${s.ratePerUnit.toLocaleString()}`, width - 290, currentY + 17);

      // Amount
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`Rs. ${s.totalAmount.toLocaleString()}`, 100, currentY + 17);

      currentY += 26;
    });
  }

  // Gross Sales Subtotal Row
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(20, currentY, width - 40, 26);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, currentY, width - 40, 26);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`مجموعی کل فروخت (${lot.summary.totalSoldQuantity} ${unitLabel}):`, width - 35, currentY + 17);

  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`Rs. ${lot.summary.grossSales.toLocaleString()}`, 100, currentY + 18);

  currentY += 32;
  drawDashedLine(currentY);
  currentY += 10;

  // 5. Deductions / Expenses Section (کٹوتیاں و اخراجات)
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('منہا کٹوتیاں و اخراجات:', width - 25, currentY + 2);

  currentY += 16;

  if (activeExpensesList.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText('کوئی کٹوتی لاگو نہیں ہے۔', width - 25, currentY + 8);
    currentY += 16;
  } else {
    activeExpensesList.forEach((item) => {
      ctx.fillStyle = '#334155';
      ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(item.label, width - 25, currentY + 10);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.fillText(`- Rs. ${item.amount.toLocaleString()}`, 100, currentY + 10);

      currentY += 20;
    });

    // Total Deductions Line
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('کل منہا کٹوتیاں:', width - 25, currentY + 12);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`- Rs. ${lot.summary.totalExpenses.toLocaleString()}`, 100, currentY + 12);
    currentY += 24;
  }

  drawDashedLine(currentY);
  currentY += 12;

  // 6. Net Meezan Box (صافی رقم برائے ادائیگی)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(20, currentY, width - 40, 46);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('صافی رقم برائے ادائیگی:', width - 35, currentY + 28);

  ctx.font = 'bold 19px system-ui, monospace, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Rs. ${lot.summary.netPayableToVendor.toLocaleString()}`, 35, currentY + 30);

  currentY += 54;

  // 7. Vendor Payment Status Box (بقایا یا ادا شدہ)
  const isPaid = lot.vendorPaymentStatus === 'paid';
  ctx.fillStyle = isPaid ? '#ecfdf5' : '#fef2f2';
  ctx.fillRect(20, currentY, width - 40, 28);
  ctx.strokeStyle = isPaid ? '#059669' : '#dc2626';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(20, currentY, width - 40, 28);

  ctx.fillStyle = isPaid ? '#065f46' : '#991b1b';
  ctx.font = 'bold 10.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    isPaid
      ? `✅ ادائیگی کی کیفیت: تمام رقم ادا شدہ ہے${lot.vendorPaymentDate ? ` - بتاریخ ${lot.vendorPaymentDate}` : ''}`
      : '⚠️ ادائیگی کی کیفیت: ادائیگی بقایا ہے',
    width - 32,
    currentY + 18
  );

  currentY += 38;

  // 8. Signatures & Footer
  ctx.strokeStyle = '#94a3b8';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(35, currentY + 14);
  ctx.lineTo(160, currentY + 14);
  ctx.moveTo(width - 160, currentY + 14);
  ctx.lineTo(width - 35, currentY + 14);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 9.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('دستخط منشی / کیشیئر', 98, currentY + 26);
  ctx.fillText('دستخط و مہر آڑھتی', width - 98, currentY + 26);

  // Footer Computerized note
  ctx.fillStyle = '#94a3b8';
  ctx.font = '8.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('کمپیوٹرائزڈ رسید برائے زمیندار | شکریہ', width / 2, totalHeight - 14);

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

  // Flatten all sales/lots into single unified items list
  const allItems: Array<{
    lotNumber: string;
    productUrdu: string;
    quantity: number;
    unitLabel: string;
    ratePerUnit: number;
    totalAmount: number;
  }> = [];

  let totalGross = 0;
  let totalExpenses = 0;
  let totalNetPayable = 0;
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

  let allLotsPaid = true;

  lots.forEach((lot) => {
    const uLabel = unitLabels[lot.unitType][settings.language];
    totalGross += lot.summary.grossSales;
    totalExpenses += lot.summary.totalExpenses;
    totalNetPayable += lot.summary.netPayableToVendor;
    totalUnits += lot.totalQuantity;
    if (lot.vendorPaymentStatus !== 'paid') {
      allLotsPaid = false;
    }

    if (lot.sales && lot.sales.length > 0) {
      lot.sales.forEach((s) => {
        allItems.push({
          lotNumber: lot.lotNumber,
          productUrdu: lot.productUrdu,
          quantity: s.quantity,
          unitLabel: uLabel,
          ratePerUnit: s.ratePerUnit,
          totalAmount: s.totalAmount,
        });
      });
    } else {
      allItems.push({
        lotNumber: lot.lotNumber,
        productUrdu: lot.productUrdu,
        quantity: lot.totalQuantity,
        unitLabel: uLabel,
        ratePerUnit: lot.totalQuantity ? Math.round(lot.summary.grossSales / lot.totalQuantity) : 0,
        totalAmount: lot.summary.grossSales,
      });
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

  const headerHeight = 220;
  const tableHeaderHeight = 30;
  const rowsHeight = allItems.length * 28 + 35; // +35 for gross total row
  const deductionsHeight = 140;
  const meezanHeight = 100;
  const footerHeight = 80;
  const totalHeight = headerHeight + tableHeaderHeight + rowsHeight + deductionsHeight + meezanHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = totalHeight * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(2, 2);

  // 1. Clean Background
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
  ctx.fillText('پکی پرچی بل برائے زمیندار', width / 2, 133);

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
  ctx.fillText(`${lots.length} لاٹ • ${totalUnits} کل نگ`, width - 85, metaY + 22);

  let currentY = metaY + 36;
  drawDashedLine(currentY);
  currentY += 12;

  // 2. ONE SINGLE TABLE FOR ALL PRODUCTS
  // Table Header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(24, currentY, width - 48, 24);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(24, currentY, width - 48, 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('#', 40, currentY + 16);
  ctx.textAlign = 'right';
  ctx.fillText('تفصیلِ جنس', width - 55, currentY + 16);
  ctx.textAlign = 'center';
  ctx.fillText('تعداد بمعہ پیکنگ', width - 210, currentY + 16);
  ctx.textAlign = 'right';
  ctx.fillText('ریٹ', width - 310, currentY + 16);
  ctx.fillText('کل رقم', 90, currentY + 16);

  currentY += 24;

  // Table Body Rows
  allItems.forEach((item, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(24, currentY, width - 48, 26);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(24, currentY, width - 48, 26);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${idx + 1}`, 40, currentY + 17);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px "Noto Sans Arabic", system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(item.productUrdu, width - 55, currentY + 17);

    ctx.font = 'bold 10.5px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.quantity} ${item.unitLabel}`, width - 210, currentY + 17);

    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`Rs. ${item.ratePerUnit.toLocaleString()}`, width - 310, currentY + 17);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText(`Rs. ${item.totalAmount.toLocaleString()}`, 90, currentY + 17);

    currentY += 26;
  });

  // Table Gross Total Footer Row
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(24, currentY, width - 48, 26);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, currentY, width - 48, 26);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('مجموعی کل فروخت:', width - 36, currentY + 17);

  ctx.font = 'bold 13px system-ui';
  ctx.fillText(formatPKR(totalGross, 'Rs.', 'en'), 90, currentY + 17);

  currentY += 34;
  drawDashedLine(currentY);
  currentY += 12;

  // 3. Deductions & Katote Box Directly Below Table
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('منہا کٹوتیاں و اخراجات:', width - 30, currentY + 4);

  currentY += 18;

  const expItems = [
    { label: 'کمیشن', val: aggregatedExpenses.commission },
    { label: 'کرایہ گاڑی', val: aggregatedExpenses.kiraya },
    { label: 'مزدوری', val: aggregatedExpenses.mazdoori },
    { label: 'منشیانہ', val: aggregatedExpenses.munshiana },
    { label: 'نقد پیشگی', val: aggregatedExpenses.naqdAdvance },
    { label: 'مارکیٹ فیس', val: aggregatedExpenses.marketFee },
    { label: 'دیگر اخراجات', val: aggregatedExpenses.customTotal },
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
    ctx.fillText(`- Rs. ${it.val.toLocaleString()}`, expX - 60, expY);
    expX -= 190;
  });

  currentY = expY + 22;

  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('کل منہا کٹوتیاں:', width - 30, currentY + 10);
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`- ${formatPKR(totalExpenses, 'Rs.', 'en')}`, 90, currentY + 10);

  currentY += 26;
  drawDashedLine(currentY);
  currentY += 12;

  // 4. Final Net Meezan Box
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(24, currentY, width - 48, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('صافی رقم برائے ادائیگی:', width - 36, currentY + 30);

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
    allLotsPaid ? '✅ ادائیگی کی کیفیت: تمام اجناس ادا شدہ ہیں' : '⚠️ ادائیگی کی کیفیت: ادائیگی بقایا ہے',
    width - 34,
    currentY + 20
  );

  currentY += 40;

  // Signatures
  ctx.strokeStyle = '#94a3b8';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(35, currentY + 14);
  ctx.lineTo(160, currentY + 14);
  ctx.moveTo(width - 160, currentY + 14);
  ctx.lineTo(width - 35, currentY + 14);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 9.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('دستخط منشی / کیشیئر', 98, currentY + 26);
  ctx.fillText('دستخط و مہر آڑھتی', width - 98, currentY + 26);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '8.5px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('کمپیوٹرائزڈ رسید برائے زمیندار | شکریہ', width / 2, totalHeight - 14);

  return canvas;
}

/**
 * Prints an authentic, compact 80mm POS Thermal Receipt for a single lot.
 */
export function printThermalPOSReceipt(lot: VendorLot, settings: AppSettings): void {
  const unitLabel = unitLabels[lot.unitType]?.[settings.language] || unitLabels[lot.unitType]?.ur || 'نگ';
  const isPaid = lot.vendorPaymentStatus === 'paid';

  const salesRowsHtml = lot.sales.map((sale, idx) => `
    <tr>
      <td style="text-align: right; padding: 2px 1px;">${idx + 1}. ${lot.productUrdu}</td>
      <td style="text-align: center; padding: 2px 1px; font-weight: bold;">${sale.quantity} ${unitLabel}</td>
      <td style="text-align: left; padding: 2px 1px;">Rs.${sale.ratePerUnit.toLocaleString()}</td>
      <td style="text-align: left; padding: 2px 1px; font-weight: bold;">Rs.${sale.totalAmount.toLocaleString()}</td>
    </tr>
  `).join('');

  const expensesHtml = `
    ${lot.expenses.commission.enabled && lot.expenses.commission.amount > 0 ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>کمیشن (${lot.expenses.commission.rate}%):</span>
        <span style="font-weight:bold;">- ${formatPKR(lot.expenses.commission.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.kiraya.enabled && lot.expenses.kiraya.amount > 0 ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>کرایہ گاڑی:</span>
        <span style="font-weight:bold;">- ${formatPKR(lot.expenses.kiraya.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.mazdoori.enabled && lot.expenses.mazdoori.amount > 0 ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>مزدوری:</span>
        <span style="font-weight:bold;">- ${formatPKR(lot.expenses.mazdoori.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.munshiana.enabled && lot.expenses.munshiana.amount > 0 ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>منشیانہ:</span>
        <span style="font-weight:bold;">- ${formatPKR(lot.expenses.munshiana.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.naqdAdvance.enabled && lot.expenses.naqdAdvance.amount > 0 ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>نقد پیشگی (Advance):</span>
        <span style="font-weight:bold;">- ${formatPKR(lot.expenses.naqdAdvance.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${lot.expenses.marketFee.enabled && lot.expenses.marketFee.amount > 0 ? `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>مارکیٹ فیس:</span>
        <span style="font-weight:bold;">- ${formatPKR(lot.expenses.marketFee.amount, settings.currencySymbol, settings.language)}</span>
      </div>` : ''}
    ${(lot.expenses.customExpenses || []).filter(ce => ce.amount > 0).map((ce) => `
      <div style="display:flex; justify-content:space-between; padding: 1px 0;">
        <span>${ce.nameUrdu || ce.nameEn}:</span>
        <span style="font-weight:bold;">- ${formatPKR(ce.amount, settings.currencySymbol, settings.language)}</span>
      </div>
    `).join('')}
  `;

  const html = `
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
          <span>رسید برائے زمیندار</span>
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
    </body>
    </html>
  `;

  printHtmlViaIframe(html, `POS_Receipt_${lot.lotNumber}`);
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
  // Flatten all products/lots into single unified items
  const allItems: Array<{
    lotNumber: string;
    productUrdu: string;
    quantity: number;
    unitLabel: string;
    ratePerUnit: number;
    totalAmount: number;
  }> = [];

  const aggregatedExpenses = {
    commission: 0,
    kiraya: 0,
    mazdoori: 0,
    munshiana: 0,
    naqdAdvance: 0,
    marketFee: 0,
    customTotal: 0,
  };

  const totals = lots.reduce(
    (acc, lot) => {
      const uLabel = unitLabels[lot.unitType]?.[settings.language] || unitLabels[lot.unitType]?.ur || 'نگ';
      acc.grossSales += lot.summary.grossSales;
      acc.totalExpenses += lot.summary.totalExpenses;
      acc.netPayable += lot.summary.netPayableToVendor;
      const lotPaid = lot.vendorPaymentAmount !== undefined ? lot.vendorPaymentAmount : (lot.vendorPaymentStatus === 'paid' ? lot.summary.netPayableToVendor : 0);
      acc.totalPaid += lotPaid;

      if (lot.sales && lot.sales.length > 0) {
        lot.sales.forEach((s) => {
          allItems.push({
            lotNumber: lot.lotNumber,
            productUrdu: lot.productUrdu,
            quantity: s.quantity,
            unitLabel: uLabel,
            ratePerUnit: s.ratePerUnit,
            totalAmount: s.totalAmount,
          });
        });
      } else {
        allItems.push({
          lotNumber: lot.lotNumber,
          productUrdu: lot.productUrdu,
          quantity: lot.totalQuantity,
          unitLabel: uLabel,
          ratePerUnit: lot.totalQuantity ? Math.round(lot.summary.grossSales / lot.totalQuantity) : 0,
          totalAmount: lot.summary.grossSales,
        });
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

      return acc;
    },
    { grossSales: 0, totalExpenses: 0, netPayable: 0, totalPaid: 0 }
  );

  const displayDate = dateLabel || lots[0]?.arrivalDate || new Date().toISOString().slice(0, 10);
  const allLotsPaid = totals.totalPaid >= totals.netPayable && totals.netPayable > 0;

  const itemsRowsHtml = allItems.map((item, idx) => `
    <tr>
      <td style="text-align: right; padding: 2px 1px;">${idx + 1}. ${item.productUrdu}</td>
      <td style="text-align: center; padding: 2px 1px; font-weight: bold;">${item.quantity} ${item.unitLabel}</td>
      <td style="text-align: left; padding: 2px 1px;">Rs.${item.ratePerUnit.toLocaleString()}</td>
      <td style="text-align: left; padding: 2px 1px; font-weight: bold;">Rs.${item.totalAmount.toLocaleString()}</td>
    </tr>
  `).join('');

  const expRowsHtml: string[] = [];
  if (aggregatedExpenses.commission > 0) expRowsHtml.push(`<div><span>کمیشن:</span> <b>-Rs.${aggregatedExpenses.commission.toLocaleString()}</b></div>`);
  if (aggregatedExpenses.kiraya > 0) expRowsHtml.push(`<div><span>کرایہ گاڑی:</span> <b>-Rs.${aggregatedExpenses.kiraya.toLocaleString()}</b></div>`);
  if (aggregatedExpenses.mazdoori > 0) expRowsHtml.push(`<div><span>مزدوری:</span> <b>-Rs.${aggregatedExpenses.mazdoori.toLocaleString()}</b></div>`);
  if (aggregatedExpenses.munshiana > 0) expRowsHtml.push(`<div><span>منشیانہ:</span> <b>-Rs.${aggregatedExpenses.munshiana.toLocaleString()}</b></div>`);
  if (aggregatedExpenses.naqdAdvance > 0) expRowsHtml.push(`<div><span>نقد پیشگی:</span> <b>-Rs.${aggregatedExpenses.naqdAdvance.toLocaleString()}</b></div>`);
  if (aggregatedExpenses.marketFee > 0) expRowsHtml.push(`<div><span>مارکیٹ فیس:</span> <b>-Rs.${aggregatedExpenses.marketFee.toLocaleString()}</b></div>`);
  if (aggregatedExpenses.customTotal > 0) expRowsHtml.push(`<div><span>دیگر کٹوتیاں:</span> <b>-Rs.${aggregatedExpenses.customTotal.toLocaleString()}</b></div>`);

  const html = `
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
          پکی پرچی بل برائے زمیندار (${lots.length} اجناس)
        </div>
      </div>

      <div class="dashed"></div>

      <div style="font-size: 10px; line-height: 1.4;">
        <div>زمیندار: <b style="font-size: 12px;">${vendorName}</b> ${vendorCity ? `(${vendorCity})` : ''}</div>
        <div style="display:flex; justify-content:space-between;">
          <span>تاریخ: <b>${displayDate}</b></span>
          <span>کل اجناس: <b>${lots.length} آئٹم</b></span>
        </div>
      </div>

      <div class="dashed"></div>

      <table>
        <thead>
          <tr>
            <th style="text-align: right;">تفصیلِ جنس</th>
            <th style="text-align: center;">تعداد</th>
            <th style="text-align: left;">ریٹ</th>
            <th style="text-align: left;">رقم</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
        </tbody>
        <tfoot>
          <tr style="border-top: 1px solid #000; font-weight: bold;">
            <td colspan="3" style="text-align: right; padding-top: 3px;">مجموعی کل فروخت:</td>
            <td style="text-align: left; padding-top: 3px;">Rs.${totals.grossSales.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <div class="dashed"></div>

      <div style="font-size: 9.5px; line-height: 1.4;">
        <div style="font-weight: bold; margin-bottom: 2px;">منہا کٹوتیاں و اخراجات (Katote):</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px;">
          ${expRowsHtml.join('')}
        </div>
        <div style="display:flex; justify-content:space-between; margin-top: 3px; font-weight: bold; color: #c00;">
          <span>کل منہا کٹوتیاں:</span>
          <span>- Rs.${totals.totalExpenses.toLocaleString()}</span>
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
    </body>
    </html>
  `;

  printHtmlViaIframe(html, `Consolidated_POS_${vendorName}`);
}
