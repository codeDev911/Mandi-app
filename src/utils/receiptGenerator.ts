import { VendorLot, AppSettings } from '../types';
import { unitLabels, formatFullRealDate, getUnitDisplayLabel } from './localization';
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
  const unitLabel = getUnitDisplayLabel(lot.unitType, settings.language);

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
  // Shop Name (Main Display - Bismillah removed)
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.fillText(settings.shopNameUrdu || settings.shopNameEn || 'سبزی و پھل کمیشن شاپ', width / 2, 48);

  // Proprietor & Contact Info
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`پروپرائٹر: ${settings.arhtiNameUrdu || settings.arhtiNameEn || 'آڑھتی صاحب'}`, width / 2, 72);

  ctx.fillStyle = '#475569';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`📍 ${settings.shopAddressUrdu || settings.shopAddressEn || 'غلہ منڈی'}  •  📞 فون: ${settings.shopPhone || ''}`, width / 2, 92);

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
  dateLabel: string,
  isAveraged: boolean = false
): HTMLCanvasElement {
  // Width: 744px and Height: 1050px matches Portrait half-A4 paper (148.8mm x 210mm, Ratio 148.8 / 210 = 0.70857)
  const width = 744;

  // Build items list: either detailed per sale or averaged by product (اجناس وار اوسط بل)
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
  let totalPaid = 0;

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
    totalGross += lot.summary.grossSales;
    totalExpenses += lot.summary.totalExpenses;
    totalNetPayable += lot.summary.netPayableToVendor;
    totalUnits += lot.totalQuantity;
    if (lot.vendorPaymentStatus !== 'paid') {
      allLotsPaid = false;
    }

    const lotPaid =
      lot.vendorPaymentAmount !== undefined
        ? lot.vendorPaymentAmount
        : lot.vendorPaymentStatus === 'paid'
        ? lot.summary.netPayableToVendor
        : 0;
    totalPaid += lotPaid;

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

  const meezanExpenses =
    aggregatedExpenses.commission +
    aggregatedExpenses.kiraya +
    aggregatedExpenses.mazdoori +
    aggregatedExpenses.munshiana +
    aggregatedExpenses.naqdAdvance +
    aggregatedExpenses.marketFee +
    aggregatedExpenses.customTotal;

  if (!isAveraged) {
    // Detailed list: each sale or lot in separate rows
    lots.forEach((lot) => {
      const uLabel = getUnitDisplayLabel(lot.unitType, settings.language);
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
    });
  } else {
    // Averaged bill: group all sales of the same product into 1 single line with weighted average rate
    const productGroups = new Map<
      string,
      {
        productUrdu: string;
        quantity: number;
        unitLabel: string;
        totalAmount: number;
        lotNumbers: Set<string>;
      }
    >();

    lots.forEach((lot) => {
      const prodKey = (lot.productUrdu || lot.productName || 'جنس').trim();
      const uLabel = getUnitDisplayLabel(lot.unitType, settings.language);

      if (!productGroups.has(prodKey)) {
        productGroups.set(prodKey, {
          productUrdu: prodKey,
          quantity: 0,
          unitLabel: uLabel,
          totalAmount: 0,
          lotNumbers: new Set<string>(),
        });
      }

      const grp = productGroups.get(prodKey)!;
      grp.lotNumbers.add(lot.lotNumber);

      if (lot.sales && lot.sales.length > 0) {
        lot.sales.forEach((s) => {
          grp.quantity += s.quantity;
          grp.totalAmount += s.totalAmount;
        });
      } else {
        grp.quantity += lot.totalQuantity;
        grp.totalAmount += lot.summary.grossSales;
      }
    });

    productGroups.forEach((grp) => {
      const avgRate = grp.quantity > 0 ? Math.round(grp.totalAmount / grp.quantity) : 0;
      allItems.push({
        lotNumber: Array.from(grp.lotNumbers).join(', '),
        productUrdu: grp.productUrdu,
        quantity: grp.quantity,
        unitLabel: grp.unitLabel,
        ratePerUnit: avgRate,
        totalAmount: Math.round(grp.totalAmount),
      });
    });
  }

  const isFullyPaid = (totalPaid >= totalNetPayable && totalNetPayable > 0) || (allLotsPaid && lots.length > 0);
  const isPartialPaid = totalPaid > 0 && !isFullyPaid;

  const totalHeight = 1050;
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = totalHeight * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(2, 2);

  // 1. Crisp White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // 2. Left and Right Vertical Produce Frame Margins
  const borderMargin = 28;
  const contentWidth = width - borderMargin * 2;

  // Draw colorful produce border patterns on left and right margins
  const drawProduceBorderStrip = (startX: number) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(startX, 0, borderMargin, totalHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, 0, borderMargin, totalHeight);

    // Decorative repeating produce icons/dots
    const produceColors = ['#ef4444', '#16a34a', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#eab308'];
    for (let py = 10; py < totalHeight - 10; py += 28) {
      const colIdx = Math.floor((py / 28) % produceColors.length);
      ctx.fillStyle = produceColors[colIdx];
      ctx.beginPath();
      ctx.arc(startX + borderMargin / 2, py + 8, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawProduceBorderStrip(0);
  drawProduceBorderStrip(width - borderMargin);

  // 3. TOP BANNER HEADER (Clean White Background, Red Outline - NO MOUNTAIN BACKGROUND)
  const headerX = borderMargin + 6;
  const headerW = contentWidth - 12;
  const headerY = 8;
  const headerH = 92;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(headerX, headerY, headerW, headerH);
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 2;
  ctx.strokeRect(headerX, headerY, headerW, headerH);

  // Red 3D Shop Title Calligraphy
  const shopName = settings.shopNameUrdu || settings.shopNameEn || 'کمیشن شاپ';
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  const titleY = headerY + 36;
  // White outline
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.strokeText(shopName, headerX + headerW / 2, titleY);
  // Red vibrant fill
  ctx.fillStyle = '#dc2626';
  ctx.fillText(shopName, headerX + headerW / 2, titleY);

  // Yellow Contact Badge from Settings
  const phone1 = settings.shopPhone?.trim() || '';
  const phone2 = settings.shopPhone2?.trim() || '';
  const shopAddress = settings.shopAddressUrdu || settings.shopAddressEn || '';
  const arhtiName = settings.arhtiNameUrdu || settings.arhtiNameEn || '';
  const tarKaPata = settings.tarKaPataUrdu?.trim() || '';

  if (phone1) {
    const phoneBoxW = 120;
    const phoneBoxH = phone2 ? 30 : 18;
    const phoneBoxX = headerX + 10;
    const phoneBoxY = headerY + 44;
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(phoneBoxX, phoneBoxY, phoneBoxW, phoneBoxH);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(phoneBoxX, phoneBoxY, phoneBoxW, phoneBoxH);

    ctx.fillStyle = '#020617';
    ctx.font = 'bold 10px system-ui, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`📱 ${phone1}`, phoneBoxX + phoneBoxW / 2, phoneBoxY + 12);
    if (phone2) {
      ctx.fillText(phone2, phoneBoxX + phoneBoxW / 2, phoneBoxY + 24);
    }
  }

  // Mandi Address from Settings
  if (shopAddress) {
    ctx.font = 'bold 15px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(shopAddress, headerX + headerW / 2 + 25, headerY + 60);
  }

  // Proprietor & Tar Ka Pata from Settings
  const propText = (arhtiName ? 'پروپرائیٹر: ' + arhtiName : '') + (tarKaPata ? (arhtiName ? ' • ' : '') + 'تار کا پتہ: ' + tarKaPata : '');
  if (propText) {
    ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.fillText(propText, headerX + headerW / 2, headerY + 82);
  }

  // 4. SUBHEADER METADATA ROWS (Bill Baname placed under Lot Number)
  const subY = headerY + headerH + 4;
  const subH = 46;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(headerX, subY, headerW, subH);
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(headerX, subY, headerW, subH);

  // Top row: Lot Number on Right, Date on Left
  const rawLotNumbers = lots
    .map((l) => (l.lotNumber || '').trim().replace(/^LOT-/i, ''))
    .filter(Boolean);
  const uniqueLotNumbers = Array.from(new Set(rawLotNumbers));
  const displayLotNo =
    uniqueLotNumbers.length > 0
      ? uniqueLotNumbers.join(', ')
      : (lots[0]?.lotNumber || '101').replace(/^LOT-/i, '');

  ctx.textAlign = 'right';
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 12px "Noto Nastaliq Urdu", serif';
  ctx.fillText('لاٹ نمبر: ', headerX + headerW - 10, subY + 16);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px system-ui, monospace';
  ctx.fillText(displayLotNo, headerX + headerW - 68, subY + 16);

  const displayDate = formatFullRealDate(dateLabel, lots[0]?.arrivalDate);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 11px "Noto Nastaliq Urdu", serif';
  ctx.fillText('السلام علیکم تاریخ: ', headerX + 10, subY + 16);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px system-ui, monospace';
  ctx.fillText(displayDate, headerX + 115, subY + 16);

  // Divider
  ctx.strokeStyle = '#fee2e2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headerX + 4, subY + 23);
  ctx.lineTo(headerX + headerW - 4, subY + 23);
  ctx.stroke();

  // Bottom row: Bill Baname placed under Lot Number
  ctx.textAlign = 'right';
  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", serif';
  ctx.fillText('بل بنام: ', headerX + headerW - 10, subY + 39);
  ctx.fillStyle = '#020617';
  ctx.font = 'bold 16px "Noto Nastaliq Urdu", serif';
  ctx.fillText(`${vendorName} ${vendorCity ? `(${vendorCity})` : ''}`, headerX + headerW - 65, subY + 39);

  if (vendorPhone) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px system-ui, monospace';
    ctx.fillText(`فون: ${vendorPhone}`, headerX + 10, subY + 39);
  }

  // 5. MAIN RED-RULED TABLE
  const tableY = subY + subH + 4;
  const tableH = 798;
  const leftColW = Math.round(headerW * 0.30);
  const rightColW = headerW - leftColW;
  const totalSubColW = 80;

  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 2;
  ctx.strokeRect(headerX, tableY, headerW, tableH);

  // Vertical divider between Left (Expenses) and Right (Sales)
  ctx.beginPath();
  ctx.moveTo(headerX + leftColW, tableY);
  ctx.lineTo(headerX + leftColW, tableY + tableH);
  ctx.stroke();

  // Header row height
  const tHeaderH = 32;
  ctx.fillStyle = '#fef2f2';
  ctx.fillRect(headerX, tableY, headerW, tHeaderH);
  ctx.beginPath();
  ctx.moveTo(headerX, tableY + tHeaderH);
  ctx.lineTo(headerX + headerW, tableY + tHeaderH);
  ctx.stroke();

  // Left Header: اخراجات
  ctx.textAlign = 'center';
  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 14.5px "Noto Nastaliq Urdu", serif';
  ctx.fillText('اخراجات', headerX + leftColW / 2, tableY + 21);

  // Right Header: تفصیل مال بکری & ٹوٹل
  // Vertical line separating ٹوٹل and تفصیل
  ctx.beginPath();
  ctx.moveTo(headerX + leftColW + totalSubColW, tableY);
  ctx.lineTo(headerX + leftColW + totalSubColW, tableY + tableH - 84); // stops above summary bars
  ctx.stroke();

  ctx.fillText('ٹوٹل', headerX + leftColW + totalSubColW / 2, tableY + 21);
  ctx.fillText('تفصیل مال بکری', headerX + leftColW + totalSubColW + (rightColW - totalSubColW) / 2, tableY + 21);

  // 5A. LEFT COLUMN: 7 BADGES & ICS LOGO
  const badgesData = [
    { label: 'کمیشن', val: aggregatedExpenses.commission, color: '#4f46e5' },
    { label: 'کرایہ', val: aggregatedExpenses.kiraya, color: '#16a34a' },
    { label: 'مزدوری', val: aggregatedExpenses.mazdoori, color: '#db2777' },
    { label: 'منشیانہ', val: aggregatedExpenses.munshiana, color: '#0284c7' },
    { label: 'نقد', val: aggregatedExpenses.naqdAdvance, color: '#ef4444' },
    { label: 'مارکیٹ فیس', val: aggregatedExpenses.marketFee, color: '#f97316' },
    { label: 'میزان', val: meezanExpenses, color: '#9333ea', isMeezan: true },
  ];

  let badgeY = tableY + tHeaderH + 12;
  badgesData.forEach((b) => {
    const pillW = 52;
    const pillH = 26;
    const boxW = leftColW - pillW - 14;
    const boxH = 26;

    const boxX = headerX + 6;
    const pillX = headerX + leftColW - pillW - 6;

    // Amount box
    ctx.fillStyle = b.isMeezan ? '#faf5ff' : '#ffffff';
    ctx.fillRect(boxX, badgeY, boxW, boxH);
    ctx.strokeStyle = b.isMeezan ? '#7e22ce' : '#b91c1c';
    ctx.lineWidth = b.isMeezan ? 2 : 1.2;
    ctx.strokeRect(boxX, badgeY, boxW, boxH);

    if (b.val > 0) {
      ctx.fillStyle = b.isMeezan ? '#581c87' : '#0f172a';
      ctx.font = 'bold 12.5px system-ui, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(b.val).toLocaleString(), boxX + boxW / 2, badgeY + 18);
    }

    // Pill
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(pillX, badgeY, pillW, pillH, 14);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11.5px "Noto Sans Arabic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, pillX + pillW / 2, badgeY + 18);

    badgeY += 34;
  });

  // Bottom Left: ICS Trust Badge
  const icsBoxW = leftColW - 16;
  const icsBoxH = 50;
  const icsBoxX = headerX + 8;
  const icsBoxY = tableY + tableH - icsBoxH - 8;

  ctx.fillStyle = '#881337';
  ctx.fillRect(icsBoxX, icsBoxY, icsBoxW, icsBoxH);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.strokeRect(icsBoxX, icsBoxY, icsBoxW, icsBoxH);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 9px "Noto Nastaliq Urdu", serif';
  ctx.textAlign = 'center';
  ctx.fillText('آپ کے اعتماد کا نام', icsBoxX + icsBoxW / 2, icsBoxY + 15);

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('ICS', icsBoxX + icsBoxW / 2, icsBoxY + 40);

  // 5B. RIGHT COLUMN: SALE ITEMS + EMPTY ROWS + 3 SUMMARY BARS
  let rowY = tableY + tHeaderH;
  const rowH = 28;
  const maxRowsOnPage = 18;

  for (let i = 0; i < maxRowsOnPage; i++) {
    const item = allItems[i];

    // Bottom horizontal line
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headerX + leftColW, rowY + rowH);
    ctx.lineTo(headerX + headerW, rowY + rowH);
    ctx.stroke();

    if (item) {
      // Total amount in subcolumn
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px monospace';
      ctx.fillText(Math.round(item.totalAmount).toLocaleString(), headerX + leftColW + totalSubColW / 2, rowY + 18);

      // Description in wide column: Rate, Product Name, Unit Type, Qty from left
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(
        `${Math.round(item.ratePerUnit).toLocaleString()}   •   ${item.productUrdu}   •   ${item.unitLabel}   •   ${item.quantity}`,
        headerX + leftColW + totalSubColW + 12,
        rowY + 18
      );
    }

    rowY += rowH;
  }

  // Bottom 3 Summary Bars
  const summaryBarH = 28;
  const sumY1 = tableY + tableH - summaryBarH * 3;
  const sumY2 = tableY + tableH - summaryBarH * 2;
  const sumY3 = tableY + tableH - summaryBarH;

  // 1. خام بکری (Clean White Background, Crisp Red Border - Colored Background Removed)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(headerX + leftColW, sumY1, rightColW, summaryBarH);
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(headerX + leftColW, sumY1, rightColW, summaryBarH);

  // Vertical divider between amount and label
  ctx.beginPath();
  ctx.moveTo(headerX + leftColW + totalSubColW, sumY1);
  ctx.lineTo(headerX + leftColW + totalSubColW, sumY1 + summaryBarH);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(totalGross).toLocaleString(), headerX + leftColW + totalSubColW / 2, sumY1 + 18);

  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", serif';
  ctx.fillText('خام بکری', headerX + leftColW + totalSubColW + (rightColW - totalSubColW) / 2, sumY1 + 18);

  // 2. جملہ اخراجات (Clean White Background, Crisp Red Border - Colored Background Removed)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(headerX + leftColW, sumY2, rightColW, summaryBarH);
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(headerX + leftColW, sumY2, rightColW, summaryBarH);

  // Vertical divider between amount and label
  ctx.beginPath();
  ctx.moveTo(headerX + leftColW + totalSubColW, sumY2);
  ctx.lineTo(headerX + leftColW + totalSubColW, sumY2 + summaryBarH);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(meezanExpenses).toLocaleString(), headerX + leftColW + totalSubColW / 2, sumY2 + 18);

  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", serif';
  ctx.fillText('جملہ اخراجات', headerX + leftColW + totalSubColW + (rightColW - totalSubColW) / 2, sumY2 + 18);

  // 3. پختہ بکری (Clean White Background, Crisp Red Border - Colored Background Removed)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(headerX + leftColW, sumY3, rightColW, summaryBarH);
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(headerX + leftColW, sumY3, rightColW, summaryBarH);

  // Vertical divider between amount and label
  ctx.beginPath();
  ctx.moveTo(headerX + leftColW + totalSubColW, sumY3);
  ctx.lineTo(headerX + leftColW + totalSubColW, sumY3 + summaryBarH);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(totalNetPayable).toLocaleString(), headerX + leftColW + totalSubColW / 2, sumY3 + 18);

  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 14px "Noto Nastaliq Urdu", serif';
  ctx.fillText('پختہ بکری', headerX + leftColW + totalSubColW + (rightColW - totalSubColW) / 2, sumY3 + 18);

  // 6. FOOTER ROW
  const footY = tableY + tableH + 6;
  ctx.strokeStyle = '#b91c1c';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(headerX, footY);
  ctx.lineTo(headerX + headerW, footY);
  ctx.stroke();

  // Signature
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px "Noto Nastaliq Urdu", serif';
  ctx.fillText('دستخط: .......................................', headerX + 140, footY + 22);

  // Rubber Stamp
  const stampX = headerX + headerW / 2 + 100;
  const stampY = footY + 8;
  ctx.save();
  ctx.translate(stampX, stampY);
  ctx.rotate(-0.1);
  if (isFullyPaid) {
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-35, -5, 70, 26);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PAID', 0, 14);
  } else {
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.strokeRect(-40, -5, 80, 26);
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 12.5px "Noto Sans Arabic", sans-serif';
    ctx.fillText('باقی / نابلد', 0, 13);
  }
  ctx.restore();

  // English Branding (Far Right)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(settings.shopNameEn ? settings.shopNameEn.slice(0, 16) : 'COMMISSION', headerX + headerW - 10, footY + 14);
  ctx.fillStyle = '#166534';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('Commission Shop', headerX + headerW - 10, footY + 24);

  return canvas;
}

/**
 * Prints an authentic, compact 80mm POS Thermal Receipt for a single lot.
 */
export function printThermalPOSReceipt(lot: VendorLot, settings: AppSettings): void {
  const unitLabel = getUnitDisplayLabel(lot.unitType, settings.language);
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
  dateLabel?: string,
  isAveraged: boolean = false
): void {
  // Items list: either detailed or averaged by product
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
      const uLabel = getUnitDisplayLabel(lot.unitType, settings.language);
      acc.grossSales += lot.summary.grossSales;
      acc.totalExpenses += lot.summary.totalExpenses;
      acc.netPayable += lot.summary.netPayableToVendor;
      const lotPaid = lot.vendorPaymentAmount !== undefined ? lot.vendorPaymentAmount : (lot.vendorPaymentStatus === 'paid' ? lot.summary.netPayableToVendor : 0);
      acc.totalPaid += lotPaid;

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

  if (!isAveraged) {
    lots.forEach((lot) => {
      const uLabel = getUnitDisplayLabel(lot.unitType, settings.language);
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
    });
  } else {
    // Averaged: Group by Agnaas / Product
    const productGroups = new Map<
      string,
      {
        productUrdu: string;
        quantity: number;
        unitLabel: string;
        totalAmount: number;
        lotNumbers: Set<string>;
      }
    >();

    lots.forEach((lot) => {
      const prodKey = (lot.productUrdu || lot.productName || 'جنس').trim();
      const uLabel = getUnitDisplayLabel(lot.unitType, settings.language);

      if (!productGroups.has(prodKey)) {
        productGroups.set(prodKey, {
          productUrdu: prodKey,
          quantity: 0,
          unitLabel: uLabel,
          totalAmount: 0,
          lotNumbers: new Set<string>(),
        });
      }

      const grp = productGroups.get(prodKey)!;
      grp.lotNumbers.add(lot.lotNumber);

      if (lot.sales && lot.sales.length > 0) {
        lot.sales.forEach((s) => {
          grp.quantity += s.quantity;
          grp.totalAmount += s.totalAmount;
        });
      } else {
        grp.quantity += lot.totalQuantity;
        grp.totalAmount += lot.summary.grossSales;
      }
    });

    productGroups.forEach((grp) => {
      const avgRate = grp.quantity > 0 ? Math.round(grp.totalAmount / grp.quantity) : 0;
      allItems.push({
        lotNumber: Array.from(grp.lotNumbers).join(', '),
        productUrdu: grp.productUrdu,
        quantity: grp.quantity,
        unitLabel: grp.unitLabel,
        ratePerUnit: avgRate,
        totalAmount: Math.round(grp.totalAmount),
      });
    });
  }

  const displayDate = dateLabel || lots[0]?.arrivalDate || new Date().toISOString().slice(0, 10);
  const allLotsPaid = totals.totalPaid >= totals.netPayable && totals.netPayable > 0;
  const isPartialPaid = totals.totalPaid > 0 && !allLotsPaid;

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
        <div style="font-size: 16px; font-weight: bold; margin: 1px 0;">${settings.shopNameUrdu || settings.shopNameEn}</div>
        <div style="font-size: 11px;">پروپرائٹر: <b>${settings.arhtiNameUrdu || settings.arhtiNameEn}</b></div>
        <div style="font-size: 9.5px;">📍 ${settings.shopAddressUrdu || settings.shopAddressEn} | 📞 ${settings.shopPhone}</div>
        <div style="font-size: 10px; font-weight: bold; border: 1px solid #000; display: inline-block; padding: 1px 6px; margin-top: 3px;">
          ${isAveraged ? 'پکی پرچی بل برائے زمیندار (خلاصہ اجناس وار)' : `پکی پرچی بل برائے زمیندار (${lots.length} اجناس)`}
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
            <th style="text-align: right;">${isAveraged ? 'تفصیلِ جنس' : 'جنس'}</th>
            <th style="text-align: center;">تعداد</th>
            <th style="text-align: left;">${isAveraged ? 'اوسط ریٹ' : 'ریٹ'}</th>
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
        کیفیت: ${allLotsPaid ? '✅ تمام اجناس ادا شدہ (ALL PAID)' : isPartialPaid ? '⚠️ جزوی نقد ادائیگی (PARTIAL PAID)' : '⏳ ادائیگی بقایا (PAYMENT PENDING)'}
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
