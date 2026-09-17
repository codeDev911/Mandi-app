import { PDFPreviewData } from './pdfReportGenerator';
import { formatPKR } from './currency';
import { expenseCategoryLabels, ExpenseCategory } from '../types';

const PAGE_WIDTH = 850;
const PAGE_HEIGHT = 1202; // Exact A4 210mm x 297mm aspect ratio (850 * 297 / 210)
const SCALE_FACTOR = 2; // High-DPI crisp rendering

interface TableColumnDef {
  title: string;
  w: number;
  align: 'left' | 'center' | 'right';
}

/**
 * Creates a blank crisp A4 Canvas with background and outer borders
 */
function createBlankA4Canvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH * SCALE_FACTOR;
  canvas.height = PAGE_HEIGHT * SCALE_FACTOR;
  canvas.style.width = `${PAGE_WIDTH}px`;
  canvas.style.height = `${PAGE_HEIGHT}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE_FACTOR, SCALE_FACTOR);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  // Outer Border
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(16, 16, PAGE_WIDTH - 32, PAGE_HEIGHT - 32);

  // Inner Accent Line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(20, 20, PAGE_WIDTH - 40, PAGE_HEIGHT - 40);

  return { canvas, ctx };
}

/**
 * Draws the bottom page footer on every single page with page number & stamp
 */
function drawPageFooter(
  ctx: CanvasRenderingContext2D,
  pageIndex: number,
  totalPages: number,
  generatedDate?: string
) {
  const footerY = PAGE_HEIGHT - 36;

  // Thin separator above footer
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(28, footerY - 8);
  ctx.lineTo(PAGE_WIDTH - 28, footerY - 8);
  ctx.stroke();

  // Left: Verification text
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(
    `منڈی ڈیجیٹل منشی پرو سسٹم • تصدیق شدہ کمپیوٹرائزڈ ریکارڈ • ${generatedDate || ''}`,
    36,
    footerY + 8
  );

  // Right: Urdu & English Page Numbering
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(
    `صفحہ ${pageIndex + 1} از ${totalPages} (Page ${pageIndex + 1} of ${totalPages})`,
    PAGE_WIDTH - 36,
    footerY + 8
  );
}

/**
 * Draws the signature boxes and final summary line on the last page of the report
 */
function drawSignaturesAndTotals(
  ctx: CanvasRenderingContext2D,
  startY: number,
  totalsText?: string
) {
  let curY = Math.max(startY + 15, PAGE_HEIGHT - 130);

  if (totalsText) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(36, curY - 20, PAGE_WIDTH - 72, 22);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(36, curY - 20, PAGE_WIDTH - 72, 22);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(totalsText, PAGE_WIDTH / 2, curY - 5);
  }

  // Signatures Line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, curY);
  ctx.lineTo(PAGE_WIDTH - 36, curY);
  ctx.stroke();

  curY += 22;

  // Munshi Signature
  ctx.strokeStyle = '#64748b';
  ctx.beginPath();
  ctx.moveTo(60, curY);
  ctx.lineTo(240, curY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('دستخط منشی / کیشیئر', 150, curY + 18);

  // Arhti Signature
  ctx.beginPath();
  ctx.moveTo(PAGE_WIDTH - 240, curY);
  ctx.lineTo(PAGE_WIDTH - 60, curY);
  ctx.stroke();

  ctx.fillText('دستخط و مہر آڑھتی صاحب', PAGE_WIDTH - 150, curY + 18);
}

/**
 * Draws Table Header row with given columns
 */
function drawTableHeader(
  ctx: CanvasRenderingContext2D,
  tableX: number,
  tableW: number,
  curY: number,
  colDefs: TableColumnDef[]
): number {
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(tableX, curY, tableW, 26);
  ctx.strokeStyle = '#0d9488';
  ctx.strokeRect(tableX, curY, tableW, 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';

  let currentX = tableX;
  colDefs.forEach((h) => {
    ctx.textAlign = h.align;
    let textX = currentX + h.w / 2;
    if (h.align === 'left') textX = currentX + 8;
    if (h.align === 'right') textX = currentX + h.w - 8;
    ctx.fillText(h.title, textX, curY + 17);
    currentX += h.w;
  });

  return curY + 26;
}

/**
 * Generates an array of high-resolution A4 Page Canvases with pristine Urdu calligraphy,
 * pagination headers, repeated table headers, and clean page numbering.
 */
export function generateReportCanvas2DPages(previewData: PDFPreviewData): HTMLCanvasElement[] {
  const {
    settings,
    title,
    reportType,
    dateFilterLabel,
    dateRangeStr,
    generatedDate,
    summary,
    dateRows,
    customerRows,
    vendorRows,
    productRows,
    expenseRows,
    singleVendor,
    singleCustomer,
    singleProduct,
    singleLot,
  } = previewData;

  const tableX = 36;
  const tableW = PAGE_WIDTH - 72;
  const rowH = 26;

  // Determine active rows & column definitions
  let rows: any[] = [];
  let colDefs: TableColumnDef[] = [];
  let drawRowFn: (ctx: CanvasRenderingContext2D, r: any, idx: number, y: number) => void = () => {};
  let totalSummaryText = '';

  // 1. Single Vendor Report
  if (singleVendor || reportType === 'single_vendor') {
    const sv = singleVendor || {
      vendorName: 'زمیندار',
      lotsCount: 0,
      totalUnits: 0,
      unitsSold: 0,
      grossSales: 0,
      commission: 0,
      totalExpenses: 0,
      netPayable: 0,
      lots: [],
    };
    rows = sv.lots || [];
    colDefs = [
      { title: '#', w: 35, align: 'center' },
      { title: 'آمد تاریخ', w: 80, align: 'center' },
      { title: 'لاٹ #', w: 70, align: 'center' },
      { title: 'جنس و تفصیل', w: 135, align: 'right' },
      { title: 'گاڑی نمبر', w: 80, align: 'center' },
      { title: 'فروخت / کل نگ', w: 85, align: 'center' },
      { title: 'کل فروخت', w: 98, align: 'right' },
      { title: 'کمیشن', w: 85, align: 'right' },
      { title: 'صافی واجب الادا', w: 110, align: 'right' },
    ];
    drawRowFn = (ctx, lot, idx, y) => {
      let currentX = tableX;
      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, y + 17);
      currentX += 35;
      // Date
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lot.arrivalDate || '-', currentX + 40, y + 17);
      currentX += 80;
      // Lot #
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lot.lotNumber || '-', currentX + 35, y + 17);
      currentX += 70;
      // Product
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${lot.productUrdu || lot.productName} (${lot.unitType})`, currentX + 127, y + 17);
      currentX += 135;
      // Vehicle
      ctx.fillStyle = '#475569';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lot.vehicleNumber || '-', currentX + 40, y + 17);
      currentX += 80;
      // Sold / Total
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${lot.summary?.totalSoldQuantity ?? 0} / ${lot.totalQuantity}`, currentX + 42, y + 17);
      currentX += 85;
      // Gross
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(lot.summary?.grossSales || 0, '', 'en'), currentX + 90, y + 17);
      currentX += 98;
      // Commission
      ctx.fillStyle = '#065f46';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(lot.summary?.arhtiProfitCommission || 0, '', 'en'), currentX + 77, y + 17);
      currentX += 85;
      // Net
      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(lot.summary?.netPayableToVendor || 0, '', 'en'), currentX + 102, y + 17);
    };
    totalSummaryText = `کل لاٹس: ${rows.length} • کل مال فروخت: ${formatPKR(sv.grossSales, 'Rs.', 'en')} • کمیشن: ${formatPKR(sv.commission, 'Rs.', 'en')} • کٹوتیاں: ${formatPKR(sv.totalExpenses, 'Rs.', 'en')} • صافی میزان زمیندار: ${formatPKR(sv.netPayable, 'Rs.', 'en')}`;
  }
  // 2. Single Customer Statement
  else if (singleCustomer || reportType === 'single_customer') {
    const sc = singleCustomer || {
      customerName: 'خریدار',
      totalPurchases: 0,
      totalUnitsBought: 0,
      totalAmount: 0,
      cashPaid: 0,
      creditPending: 0,
      transactions: [],
    };
    rows = sc.transactions || [];
    colDefs = [
      { title: '#', w: 35, align: 'center' },
      { title: 'تاریخ', w: 85, align: 'center' },
      { title: 'جنس و تفصیل', w: 190, align: 'right' },
      { title: 'تعداد (نگ)', w: 85, align: 'center' },
      { title: 'ریٹ (روپے)', w: 85, align: 'right' },
      { title: 'کل رقم', w: 148, align: 'right' },
      { title: 'حیثیت ادائیگی', w: 150, align: 'center' },
    ];
    drawRowFn = (ctx, tx, idx, y) => {
      let currentX = tableX;
      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, y + 17);
      currentX += 35;
      // Date
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tx.date || '-', currentX + 42, y + 17);
      currentX += 85;
      // Product
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(tx.productUrdu || (tx as any).productName || '-', currentX + 182, y + 17);
      currentX += 190;
      // Qty
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${tx.quantity}`, currentX + 42, y + 17);
      currentX += 85;
      // Rate
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Rs. ${tx.ratePerUnit}`, currentX + 75, y + 17);
      currentX += 85;
      // Total
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(tx.totalAmount, '', 'en'), currentX + 138, y + 17);
      currentX += 148;
      // Status
      const isCash = tx.paymentStatus === 'cash';
      ctx.fillStyle = isCash ? '#065f46' : '#9f1239';
      ctx.font = 'bold 10.5px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isCash ? 'نقد (ادا شدہ)' : 'ادھار (کھاتہ)', currentX + 75, y + 17);
    };
    totalSummaryText = `کل خریداری: ${rows.length} بار • مجموعی مال خریدا: ${formatPKR(sc.totalAmount, 'Rs.', 'en')} • نقد وصولی: ${formatPKR(sc.cashPaid, 'Rs.', 'en')} • بقایا ادھار: ${formatPKR(sc.creditPending, 'Rs.', 'en')}`;
  }
  // 3. Single Product Report
  else if (singleProduct || reportType === 'single_product') {
    const sp = singleProduct || {
      productName: 'جنس',
      productUrdu: 'جنس',
      emoji: '📦',
      totalLots: 0,
      totalUnits: 0,
      totalSold: 0,
      grossTurnover: 0,
      avgRate: 0,
      minRate: 0,
      maxRate: 0,
      commissionEarned: 0,
      lots: [],
    };
    rows = sp.lots || [];
    colDefs = [
      { title: '#', w: 35, align: 'center' },
      { title: 'آمد تاریخ', w: 85, align: 'center' },
      { title: 'لاٹ نمبر', w: 75, align: 'center' },
      { title: 'زمیندار / کاشتکار', w: 185, align: 'right' },
      { title: 'گاڑی نمبر', w: 85, align: 'center' },
      { title: 'فروخت / آمد نگ', w: 85, align: 'center' },
      { title: 'کل رقم', w: 118, align: 'right' },
      { title: 'کمیشن', w: 110, align: 'right' },
    ];
    drawRowFn = (ctx, lot, idx, y) => {
      let currentX = tableX;
      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, y + 17);
      currentX += 35;
      // Date
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lot.arrivalDate || '-', currentX + 42, y + 17);
      currentX += 85;
      // Lot #
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lot.lotNumber || '-', currentX + 37, y + 17);
      currentX += 75;
      // Vendor
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(lot.vendorName, currentX + 175, y + 17);
      currentX += 185;
      // Vehicle
      ctx.fillStyle = '#475569';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lot.vehicleNumber || '-', currentX + 42, y + 17);
      currentX += 85;
      // Units
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${lot.summary?.totalSoldQuantity ?? 0} / ${lot.totalQuantity}`, currentX + 42, y + 17);
      currentX += 85;
      // Gross
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(lot.summary?.grossSales || 0, '', 'en'), currentX + 110, y + 17);
      currentX += 118;
      // Commission
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(lot.summary?.arhtiProfitCommission || 0, '', 'en'), currentX + 100, y + 17);
    };
    totalSummaryText = `کل لاٹس: ${rows.length} • کل فروخت نگ: ${sp.totalSold} / ${sp.totalUnits} • مجموعی ٹرن اوور: ${formatPKR(sp.grossTurnover, 'Rs.', 'en')} • کل کمیشن: ${formatPKR(sp.commissionEarned, 'Rs.', 'en')}`;
  }
  // 4. Single Lot Auction Breakdown
  else if (singleLot || reportType === 'single_lot') {
    const sl = singleLot!;
    rows = sl?.sales || [];
    colDefs = [
      { title: '#', w: 35, align: 'center' },
      { title: 'وقت / تاریخ', w: 95, align: 'center' },
      { title: 'خریدار کا نام', w: 205, align: 'right' },
      { title: 'تعداد (نگ)', w: 85, align: 'center' },
      { title: 'بولی ریٹ', w: 85, align: 'right' },
      { title: 'کل رقم', w: 143, align: 'right' },
      { title: 'ادائیگی', w: 130, align: 'center' },
    ];
    drawRowFn = (ctx, s, idx, y) => {
      let currentX = tableX;
      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, y + 17);
      currentX += 35;
      // Time
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.timestamp ? s.timestamp.slice(11, 16) || s.timestamp.slice(0, 10) : '-', currentX + 47, y + 17);
      currentX += 95;
      // Buyer
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(s.buyerName, currentX + 195, y + 17);
      currentX += 205;
      // Qty
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.quantity}`, currentX + 42, y + 17);
      currentX += 85;
      // Rate
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Rs. ${s.ratePerUnit}`, currentX + 75, y + 17);
      currentX += 85;
      // Total
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(s.totalAmount, '', 'en'), currentX + 133, y + 17);
      currentX += 143;
      // Status
      const isCash = s.paymentStatus === 'cash';
      ctx.fillStyle = isCash ? '#065f46' : '#9f1239';
      ctx.font = 'bold 10.5px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isCash ? 'نقد (وصول)' : 'ادھار', currentX + 65, y + 17);
    };
    totalSummaryText = `کل فروخت نگ: ${sl?.summary?.totalSoldQuantity ?? 0} / ${sl?.totalQuantity ?? 0} • مجموعی فروخت: ${formatPKR(sl?.summary?.grossSales || 0, 'Rs.', 'en')} • کمیشن: ${formatPKR(sl?.summary?.arhtiProfitCommission || 0, 'Rs.', 'en')} • صافی میزان زمیندار: ${formatPKR(sl?.summary?.netPayableToVendor || 0, 'Rs.', 'en')}`;
  }
  // 5. General Shop Expenses Report
  else if (expenseRows || reportType === 'expenses') {
    rows = expenseRows || [];
    colDefs = [
      { title: '#', w: 35, align: 'center' },
      { title: 'تاریخ', w: 85, align: 'center' },
      { title: 'مد / کیٹیگری', w: 135, align: 'right' },
      { title: 'تفصیل / خرچے کا عنوان', w: 220, align: 'right' },
      { title: 'بنام / وصول کنندہ', w: 108, align: 'right' },
      { title: 'طریقہ ادائیگی', w: 85, align: 'center' },
      { title: 'رقم (روپے)', w: 110, align: 'right' },
    ];
    drawRowFn = (ctx, exp, idx, y) => {
      let currentX = tableX;
      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, y + 17);
      currentX += 35;
      // Date
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(exp.date || '-', currentX + 42, y + 17);
      currentX += 85;
      // Category
      const catLabel = expenseCategoryLabels[exp.category as ExpenseCategory]?.ur || exp.category;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(catLabel, currentX + 125, y + 17);
      currentX += 135;
      // Title
      ctx.fillStyle = '#1e293b';
      ctx.font = '11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(exp.title || '-', currentX + 210, y + 17);
      currentX += 220;
      // Paid To
      ctx.fillStyle = '#475569';
      ctx.font = '10.5px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(exp.paidTo || '-', currentX + 98, y + 17);
      currentX += 108;
      // Method
      const methodStr = exp.paymentMethod === 'online' ? 'آن لائن' : exp.paymentMethod === 'cheque' ? 'چیک' : 'نقد';
      ctx.fillStyle = '#334155';
      ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(methodStr, currentX + 42, y + 17);
      currentX += 85;
      // Amount
      ctx.fillStyle = '#9f1239';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(exp.amount, '', 'en'), currentX + 100, y + 17);
    };
    const totalExp = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
    totalSummaryText = `کل اخراجات کے اندراجات: ${rows.length} • مجموعی دکان اخراجات: ${formatPKR(totalExp, 'Rs.', 'en')}`;
  } else if (dateRows && dateRows.length > 0) {
    rows = dateRows;
    colDefs = [
      { title: '#', w: 35, align: 'center' },
      { title: 'تاریخ', w: 85, align: 'center' },
      { title: 'زمیندار', w: 180, align: 'right' },
      { title: 'جنس', w: 120, align: 'right' },
      { title: 'آمد / فروخت', w: 90, align: 'center' },
      { title: 'کل فروخت', w: 100, align: 'right' },
      { title: 'کمیشن', w: 80, align: 'right' },
      { title: 'صافی رقم', w: 88, align: 'right' },
    ];
    drawRowFn = (ctx, r, idx, y) => {
      let currentX = tableX;
      // Col 1: #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, y + 17);
      currentX += 35;
      // Col 2: Date
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.date, currentX + 42, y + 17);
      currentX += 85;
      // Col 3: Vendor
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(r.vendor, currentX + 172, y + 17);
      currentX += 180;
      // Col 4: Product
      ctx.fillStyle = '#1e293b';
      ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(r.product, currentX + 112, y + 17);
      currentX += 120;
      // Col 5: Qty
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.soldQty} / ${r.totalQty}`, currentX + 45, y + 17);
      currentX += 90;
      // Col 6: Gross
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(r.grossSales, '', 'en'), currentX + 92, y + 17);
      currentX += 100;
      // Col 7: Commission
      ctx.fillStyle = '#065f46';
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(r.commission, '', 'en'), currentX + 72, y + 17);
      currentX += 80;
      // Col 8: Net
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(r.netPayable, '', 'en'), currentX + 80, y + 17);
    };
    totalSummaryText = `کل ریکارڈ: ${rows.length} لاٹس • مجموعی فروخت: ${formatPKR(summary?.grossSales || 0, 'Rs.', 'en')} • کل کمیشن: ${formatPKR(summary?.commission || 0, 'Rs.', 'en')}`;
  } else if (customerRows && customerRows.length > 0) {
    rows = customerRows;
    colDefs = [
      { title: '#', w: 40, align: 'center' },
      { title: 'گاہک / خریدار', w: 230, align: 'right' },
      { title: 'فون نمبر', w: 120, align: 'center' },
      { title: 'نگ خریدے', w: 90, align: 'center' },
      { title: 'کل مال خریدا', w: 105, align: 'right' },
      { title: 'نقد وصولی', w: 95, align: 'right' },
      { title: 'بقایا ادھار', w: 98, align: 'right' },
    ];
    drawRowFn = (ctx, c, idx, y) => {
      let currentX = tableX;
      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 20, y + 17);
      currentX += 40;
      // Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(c.customerName, currentX + 220, y + 17);
      currentX += 230;
      // Phone
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.phone || '-', currentX + 60, y + 17);
      currentX += 120;
      // Units
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.unitsBought}`, currentX + 45, y + 17);
      currentX += 90;
      // Total
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(c.totalAmount, '', 'en'), currentX + 97, y + 17);
      currentX += 105;
      // Cash
      ctx.fillStyle = '#065f46';
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(c.cashPaid, '', 'en'), currentX + 87, y + 17);
      currentX += 95;
      // Credit
      ctx.fillStyle = '#9f1239';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(c.creditPending, '', 'en'), currentX + 90, y + 17);
    };
    totalSummaryText = `کل خریدار: ${rows.length} • کل خرید: ${formatPKR(summary?.grossSales || 0, 'Rs.', 'en')} • بقایا ادھار: ${formatPKR(summary?.creditPending || 0, 'Rs.', 'en')}`;
  } else if (vendorRows && vendorRows.length > 0) {
    rows = vendorRows;
    colDefs = [
      { title: '#', w: 35, align: 'center' },
      { title: 'زمیندار / کاشتکار', w: 220, align: 'right' },
      { title: 'شہر', w: 100, align: 'right' },
      { title: 'اجناس', w: 60, align: 'center' },
      { title: 'فروخت / آمد', w: 85, align: 'center' },
      { title: 'کل رقم', w: 100, align: 'right' },
      { title: 'کمیشن', w: 80, align: 'right' },
      { title: 'صافی واجب الادا', w: 98, align: 'right' },
    ];
    drawRowFn = (ctx, v, idx, y) => {
      let currentX = tableX;
      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, y + 17);
      currentX += 35;
      // Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(v.vendorName, currentX + 210, y + 17);
      currentX += 220;
      // City
      ctx.fillStyle = '#475569';
      ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v.city || '-', currentX + 90, y + 17);
      currentX += 100;
      // Lots
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${v.lotsCount}`, currentX + 30, y + 17);
      currentX += 60;
      // Units
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${v.unitsSold} / ${v.totalUnits}`, currentX + 42, y + 17);
      currentX += 85;
      // Gross
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(v.grossSales, '', 'en'), currentX + 92, y + 17);
      currentX += 100;
      // Commission
      ctx.fillStyle = '#065f46';
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(v.commission, '', 'en'), currentX + 72, y + 17);
      currentX += 80;
      // Net
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(v.netPayable, '', 'en'), currentX + 90, y + 17);
    };
    totalSummaryText = `کل زمیندار: ${rows.length} • مجموعی مال فروخت: ${formatPKR(summary?.grossSales || 0, 'Rs.', 'en')} • صافی میزان: ${formatPKR(summary?.vendorPayable || (summary as any)?.netPayableToVendor || 0, 'Rs.', 'en')}`;
  } else if (productRows && productRows.length > 0) {
    rows = productRows;
    colDefs = [
      { title: '#', w: 40, align: 'center' },
      { title: 'جنس کا نام', w: 220, align: 'right' },
      { title: 'آمد ریکارڈز', w: 90, align: 'center' },
      { title: 'فروخت / آمد نگ', w: 100, align: 'center' },
      { title: 'کل رقم', w: 110, align: 'right' },
      { title: 'اوسط ریٹ', w: 100, align: 'right' },
      { title: 'کمیشن', w: 118, align: 'right' },
    ];
    drawRowFn = (ctx, p, idx, y) => {
      let currentX = tableX;
      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 20, y + 17);
      currentX += 40;
      // Product
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(p.productName, currentX + 210, y + 17);
      currentX += 220;
      // Lots
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.totalLots}`, currentX + 45, y + 17);
      currentX += 90;
      // Sold
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.soldUnits} / ${p.totalUnits}`, currentX + 50, y + 17);
      currentX += 100;
      // Gross
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(p.grossTurnover, '', 'en'), currentX + 102, y + 17);
      currentX += 110;
      // Avg Rate
      ctx.fillStyle = '#334155';
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Rs.${Math.round(p.avgRate)}`, currentX + 92, y + 17);
      currentX += 100;
      // Commission
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(p.commission, '', 'en'), currentX + 110, y + 17);
    };
    totalSummaryText = `کل اجناس: ${rows.length} • مجموعی ٹرن اوور: ${formatPKR(summary?.grossSales || 0, 'Rs.', 'en')} • کل کمیشن: ${formatPKR(summary?.commission || 0, 'Rs.', 'en')}`;
  }

  // Calculate pagination limits:
  // Page 1: Header + Summary Metric cards take 270px.
  // Signatures on last page take 130px.
  // Available height on Page 1 (with signatures): 1202 - 270 - 130 - 50 = ~750px / 26px = 28 rows.
  // If multiple pages:
  // Page 1 has header + summary cards + table header. Fits up to 26 rows.
  // Subsequent pages have compact header (70px) + table header (26px). Fits up to 34 rows (or 28 rows if last page with signatures).

  const PAGE1_ROW_LIMIT_SINGLE_PAGE = 26;
  const PAGE1_ROW_LIMIT_MULTI_PAGE = 28;
  const SUBSEQUENT_PAGE_ROW_LIMIT = 32;

  const totalRows = rows.length;

  let totalPages = 1;
  if (totalRows <= PAGE1_ROW_LIMIT_SINGLE_PAGE) {
    totalPages = 1;
  } else {
    const remaining = totalRows - PAGE1_ROW_LIMIT_MULTI_PAGE;
    totalPages = 1 + Math.ceil(remaining / SUBSEQUENT_PAGE_ROW_LIMIT);
  }

  const pageCanvases: HTMLCanvasElement[] = [];

  let rowIndex = 0;

  for (let p = 0; p < totalPages; p++) {
    const { canvas, ctx } = createBlankA4Canvas();
    let curY = 36;

    if (p === 0) {
      // PAGE 1: FULL OFFICIAL SHOP HEADER + METRIC CARDS
      // 1. Header: Bismillah & Shop Info
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ', PAGE_WIDTH / 2, curY + 9);
      curY += 35;

      ctx.font = 'bold 24px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.fillStyle = '#020617';
      const shopName = settings.shopNameUrdu || settings.shopNameEn || 'سبزی و پھل کمیشن شاپ';
      ctx.fillText(shopName, PAGE_WIDTH / 2, curY + 12);
      curY += 24;

      ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.fillStyle = '#1e293b';
      const arhti = settings.arhtiNameUrdu || settings.arhtiNameEn || 'آڑھتی کمیشن شاپ';
      ctx.fillText(`پروپرائٹر: ${arhti}`, PAGE_WIDTH / 2, curY + 10);
      curY += 18;

      ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.fillStyle = '#475569';
      const address = settings.shopAddressUrdu || settings.shopAddressEn || '';
      ctx.fillText(`📍 ${address}  •  📞 فون: ${settings.shopPhone || ''}`, PAGE_WIDTH / 2, curY + 10);
      curY += 22;

      // Report Title Badge
      ctx.fillStyle = '#0f766e';
      ctx.fillRect(36, curY, PAGE_WIDTH - 72, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.fillText(title, PAGE_WIDTH / 2, curY + 19);
      curY += 36;

      // Period / Date Bar
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(36, curY, PAGE_WIDTH - 72, 26);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(36, curY, PAGE_WIDTH - 72, 26);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.fillText('رپورٹ کا دورانیہ:', PAGE_WIDTH - 50, curY + 17);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.fillText(
        `${dateFilterLabel || 'تمام ریکارڈ'} ${dateRangeStr ? `(${dateRangeStr})` : ''}`,
        PAGE_WIDTH - 140,
        curY + 17
      );

      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.fillText(`تاریخ و وقت: ${generatedDate || new Date().toISOString().slice(0, 10)}`, 50, curY + 17);
      curY += 34;

      // Summary Metric Cards
      if (summary) {
        const cardWidth = (PAGE_WIDTH - 72 - 36) / 4;

        let card1Title = 'مجموعی کل فروخت';
        let card1Val = formatPKR(summary.grossSales, 'Rs.', 'en');
        let card1Bg = '#f8fafc';
        let card1Border = '#e2e8f0';
        let card1Text = '#0f172a';

        let card2Title = 'کمیشن آمدن';
        let card2Val = formatPKR(summary.commission, 'Rs.', 'en');
        let card2Bg = '#ecfdf5';
        let card2Border = '#a7f3d0';
        let card2Text = '#065f46';

        let card3Title = 'وصول شدہ نقد';
        let card3Val = formatPKR(summary.cashReceived || 0, 'Rs.', 'en');
        let card3Bg = '#eff6ff';
        let card3Border = '#bfdbfe';
        let card3Text = '#1e40af';

        let card4Title = 'بقایا ادھار (کھاتہ)';
        let card4Val = formatPKR(summary.creditPending || 0, 'Rs.', 'en');
        let card4Bg = '#fff1f2';
        let card4Border = '#fecdd3';
        let card4Text = '#9f1239';

        if (singleVendor || reportType === 'single_vendor') {
          card1Title = 'مجموعی مال فروخت';
          card1Val = formatPKR(summary.grossSales, 'Rs.', 'en');

          card2Title = 'کمیشن فیس';
          card2Val = formatPKR(summary.commission, 'Rs.', 'en');

          card3Title = 'کل کٹوتیاں و اخراجات';
          card3Val = formatPKR(summary.totalExpenses || 0, 'Rs.', 'en');
          card3Bg = '#fef2f2';
          card3Border = '#fecaca';
          card3Text = '#991b1b';

          card4Title = 'صافی میزان (واجب الادا)';
          card4Val = formatPKR(summary.vendorPayable || (summary as any)?.netPayableToVendor || 0, 'Rs.', 'en');
          card4Bg = '#f0fdf4';
          card4Border = '#bbf7d0';
          card4Text = '#166534';
        } else if (singleCustomer || reportType === 'single_customer') {
          card1Title = 'مجموعی مال خریدا';
          card1Val = formatPKR(summary.grossSales, 'Rs.', 'en');

          card2Title = 'خریدے گئے نگ';
          card2Val = `${summary.unitsSold || 0} نگ`;

          card3Title = 'نقد وصولی';
          card3Val = formatPKR(summary.cashReceived || 0, 'Rs.', 'en');

          card4Title = 'بقایا ادھار (کھاتہ)';
          card4Val = formatPKR(summary.creditPending || 0, 'Rs.', 'en');
        } else if (singleProduct || reportType === 'single_product') {
          card1Title = 'مجموعی ٹرن اوور';
          card1Val = formatPKR(summary.grossSales, 'Rs.', 'en');

          card2Title = 'فروخت / آمد نگ';
          card2Val = `${summary.unitsSold || 0} نگ`;

          card3Title = 'لاٹس کی تعداد';
          card3Val = `${summary.lotsCount || 0} لاٹس`;

          card4Title = 'کمیشن آمدن';
          card4Val = formatPKR(summary.commission, 'Rs.', 'en');
          card4Bg = '#ecfdf5';
          card4Border = '#a7f3d0';
          card4Text = '#065f46';
        } else if (singleLot || reportType === 'single_lot') {
          card1Title = 'مجموعی مال فروخت';
          card1Val = formatPKR(summary.grossSales, 'Rs.', 'en');

          card2Title = 'کمیشن منافع';
          card2Val = formatPKR(summary.commission, 'Rs.', 'en');

          card3Title = 'کل کٹوتیاں';
          card3Val = formatPKR(summary.totalExpenses || 0, 'Rs.', 'en');
          card3Bg = '#fef2f2';
          card3Border = '#fecaca';
          card3Text = '#991b1b';

          card4Title = 'صافی میزان زمیندار';
          card4Val = formatPKR(summary.vendorPayable || (summary as any)?.netPayableToVendor || 0, 'Rs.', 'en');
          card4Bg = '#eff6ff';
          card4Border = '#bfdbfe';
          card4Text = '#1e40af';
        } else if (expenseRows || reportType === 'expenses') {
          card1Title = 'مجموعی دکان اخراجات';
          card1Val = formatPKR(summary.totalExpenses || 0, 'Rs.', 'en');
          card1Bg = '#fef2f2';
          card1Border = '#fecaca';
          card1Text = '#991b1b';

          card2Title = 'اندراجات کی تعداد';
          card2Val = `${summary.lotsCount || rows.length} ریکارڈز`;

          card3Title = 'نقد ادا شدہ';
          card3Val = formatPKR(summary.cashReceived || 0, 'Rs.', 'en');

          card4Title = 'آن لائن / بینک ادا';
          card4Val = formatPKR(summary.creditPending || 0, 'Rs.', 'en');
          card4Bg = '#eff6ff';
          card4Border = '#bfdbfe';
          card4Text = '#1e40af';
        }

        // Card 1
        ctx.fillStyle = card1Bg;
        ctx.fillRect(36, curY, cardWidth, 46);
        ctx.strokeStyle = card1Border;
        ctx.strokeRect(36, curY, cardWidth, 46);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
        ctx.fillText(card1Title, 36 + cardWidth / 2, curY + 15);
        ctx.fillStyle = card1Text;
        ctx.font = 'bold 12.5px system-ui, sans-serif';
        ctx.fillText(card1Val, 36 + cardWidth / 2, curY + 34);

        // Card 2
        const c2X = 36 + cardWidth + 12;
        ctx.fillStyle = card2Bg;
        ctx.fillRect(c2X, curY, cardWidth, 46);
        ctx.strokeStyle = card2Border;
        ctx.strokeRect(c2X, curY, cardWidth, 46);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
        ctx.fillText(card2Title, c2X + cardWidth / 2, curY + 15);
        ctx.fillStyle = card2Text;
        ctx.font = 'bold 12.5px system-ui, sans-serif';
        ctx.fillText(card2Val, c2X + cardWidth / 2, curY + 34);

        // Card 3
        const c3X = c2X + cardWidth + 12;
        ctx.fillStyle = card3Bg;
        ctx.fillRect(c3X, curY, cardWidth, 46);
        ctx.strokeStyle = card3Border;
        ctx.strokeRect(c3X, curY, cardWidth, 46);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
        ctx.fillText(card3Title, c3X + cardWidth / 2, curY + 15);
        ctx.fillStyle = card3Text;
        ctx.font = 'bold 12.5px system-ui, sans-serif';
        ctx.fillText(card3Val, c3X + cardWidth / 2, curY + 34);

        // Card 4
        const c4X = c3X + cardWidth + 12;
        ctx.fillStyle = card4Bg;
        ctx.fillRect(c4X, curY, cardWidth, 46);
        ctx.strokeStyle = card4Border;
        ctx.strokeRect(c4X, curY, cardWidth, 46);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
        ctx.fillText(card4Title, c4X + cardWidth / 2, curY + 15);
        ctx.fillStyle = card4Text;
        ctx.font = 'bold 12.5px system-ui, sans-serif';
        ctx.fillText(card4Val, c4X + cardWidth / 2, curY + 34);

        curY += 56;
      }
    } else {
      // SUBSEQUENT PAGES: COMPACT RUNNING HEADER
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(36, curY, PAGE_WIDTH - 72, 34);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(36, curY, PAGE_WIDTH - 72, 34);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      const shopName = settings.shopNameUrdu || settings.shopNameEn || 'سبزی و پھل کمیشن شاپ';
      ctx.fillText(shopName, PAGE_WIDTH - 50, curY + 22);

      ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.fillStyle = '#0f766e';
      ctx.textAlign = 'center';
      ctx.fillText(`${title} • جاری ہے (Continued)`, PAGE_WIDTH / 2, curY + 21);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.fillText(`صفحہ ${p + 1} از ${totalPages}`, 50, curY + 21);

      curY += 44;
    }

    // DRAW REPEATED TABLE HEADER ON EVERY PAGE
    if (colDefs.length > 0) {
      curY = drawTableHeader(ctx, tableX, tableW, curY, colDefs);
    }

    // Determine how many rows go onto this page
    const pageCapacity = p === 0 ? (totalPages === 1 ? PAGE1_ROW_LIMIT_SINGLE_PAGE : PAGE1_ROW_LIMIT_MULTI_PAGE) : SUBSEQUENT_PAGE_ROW_LIMIT;
    const pageRows = rows.slice(rowIndex, rowIndex + pageCapacity);

    // DRAW TABLE ROWS
    if (rows.length === 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(tableX, curY, tableW, 44);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(tableX, curY, tableW, 44);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('اس دورانیے میں کوئی ریکارڈ موجود نہیں ہے (No Records Found)', PAGE_WIDTH / 2, curY + 27);
      curY += 44;
    } else {
      pageRows.forEach((rowItem, itemIdx) => {
        const globalIdx = rowIndex + itemIdx;
        ctx.fillStyle = globalIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(tableX, curY, tableW, rowH);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(tableX, curY, tableW, rowH);

        drawRowFn(ctx, rowItem, globalIdx, curY);
        curY += rowH;
      });
      rowIndex += pageRows.length;
    }

    // IF FINAL PAGE: DRAW SIGNATURE BOXES & VERIFICATION STAMP
    if (p === totalPages - 1) {
      drawSignaturesAndTotals(ctx, curY, totalSummaryText);
    }

    // DRAW PAGE FOOTER (PAGE X OF Y)
    drawPageFooter(ctx, p, totalPages, generatedDate);

    pageCanvases.push(canvas);
  }

  return pageCanvases;
}

/**
 * Returns a single continuous or stitched canvas for backward compatibility
 */
export function generateReportCanvas2D(previewData: PDFPreviewData): HTMLCanvasElement {
  const pages = generateReportCanvas2DPages(previewData);
  if (pages.length === 1) {
    return pages[0];
  }

  // Stitch all pages into a vertical stack with subtle page divider gaps
  const gap = 24;
  const stitchedCanvas = document.createElement('canvas');
  stitchedCanvas.width = PAGE_WIDTH * SCALE_FACTOR;
  stitchedCanvas.height = (PAGE_HEIGHT * pages.length + gap * (pages.length - 1)) * SCALE_FACTOR;
  stitchedCanvas.style.width = `${PAGE_WIDTH}px`;
  stitchedCanvas.style.height = `${PAGE_HEIGHT * pages.length + gap * (pages.length - 1)}px`;

  const ctx = stitchedCanvas.getContext('2d')!;

  let currentY = 0;
  pages.forEach((pageCanvas, i) => {
    ctx.drawImage(pageCanvas, 0, currentY);
    currentY += pageCanvas.height;

    if (i < pages.length - 1) {
      // Draw page divider line in the gap
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, currentY, stitchedCanvas.width, gap * SCALE_FACTOR);
      currentY += gap * SCALE_FACTOR;
    }
  });

  return stitchedCanvas;
}
