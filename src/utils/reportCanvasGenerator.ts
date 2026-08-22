import { PDFPreviewData } from './pdfReportGenerator';
import { formatPKR } from './currency';

/**
 * High-Resolution HTML5 Canvas 2D Report Generator
 * Renders Urdu text and tables without relying on DOM stylesheets or html2canvas.
 * Guarantees 100% success rate on all mobile & desktop browsers.
 */
export function generateReportCanvas2D(previewData: PDFPreviewData): HTMLCanvasElement {
  const { settings, title, dateFilterLabel, dateRangeStr, generatedDate, summary, dateRows, customerRows, vendorRows, productRows } = previewData;

  const width = 850;
  
  // Calculate dynamic content height based on tables
  let dynamicHeight = 320; // Header + Summary cards + spacing
  
  if (dateRows && dateRows.length > 0) {
    dynamicHeight += 50 + dateRows.length * 30 + 40;
  }
  if (customerRows && customerRows.length > 0) {
    dynamicHeight += 50 + customerRows.length * 30 + 40;
  }
  if (vendorRows && vendorRows.length > 0) {
    dynamicHeight += 50 + vendorRows.length * 30 + 40;
  }
  if (productRows && productRows.length > 0) {
    dynamicHeight += 50 + productRows.length * 30 + 40;
  }

  dynamicHeight += 160; // Signatures + footer

  const totalHeight = Math.max(1100, dynamicHeight);

  const canvas = document.createElement('canvas');
  const scaleFactor = 2;
  canvas.width = width * scaleFactor;
  canvas.height = totalHeight * scaleFactor;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${totalHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scaleFactor, scaleFactor);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // Outer Border
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(16, 16, width - 32, totalHeight - 32);

  // Inner Accent Line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(20, 20, width - 40, totalHeight - 40);

  // 1. Header: Bismillah & Shop Info
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ', width / 2, 45);

  ctx.font = 'bold 24px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
  ctx.fillStyle = '#020617';
  const shopName = settings.shopNameUrdu || settings.shopNameEn || 'سبزی و پھل کمیشن شاپ';
  ctx.fillText(shopName, width / 2, 80);

  ctx.font = 'bold 12px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillStyle = '#1e293b';
  const arhti = settings.arhtiNameUrdu || settings.arhtiNameEn || 'آڑھتی کمیشن شاپ';
  ctx.fillText(`پروپرائٹر: ${arhti}`, width / 2, 102);

  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillStyle = '#475569';
  const address = settings.shopAddressUrdu || settings.shopAddressEn || '';
  ctx.fillText(`📍 ${address}  •  📞 فون: ${settings.shopPhone || ''}`, width / 2, 120);

  // Report Title Badge
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(36, 134, width - 72, 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(title, width / 2, 153);

  // Period / Date Bar
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(36, 170, width - 72, 28);
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(36, 170, width - 72, 28);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText('رپورٹ کا دورانیہ:', width - 50, 188);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`${dateFilterLabel || 'تمام ریکارڈ'} ${dateRangeStr ? `(${dateRangeStr})` : ''}`, width - 140, 188);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
  ctx.fillText(`تاریخ و وقت: ${generatedDate || new Date().toISOString().slice(0, 10)}`, 50, 188);

  // 2. Summary Metric Cards
  let curY = 212;
  if (summary) {
    const cardWidth = (width - 72 - 36) / 4;
    
    // Card 1: Gross Sales
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(36, curY, cardWidth, 48);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(36, curY, cardWidth, 48);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText('مجموعی کل فروخت', 36 + cardWidth / 2, curY + 16);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(formatPKR(summary.grossSales, 'Rs.', 'en'), 36 + cardWidth / 2, curY + 36);

    // Card 2: Commission
    const c2X = 36 + cardWidth + 12;
    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(c2X, curY, cardWidth, 48);
    ctx.strokeStyle = '#a7f3d0';
    ctx.strokeRect(c2X, curY, cardWidth, 48);
    ctx.fillStyle = '#065f46';
    ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText('کمیشن آمدن', c2X + cardWidth / 2, curY + 16);
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(formatPKR(summary.commission, 'Rs.', 'en'), c2X + cardWidth / 2, curY + 36);

    // Card 3: Cash Received
    const c3X = c2X + cardWidth + 12;
    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(c3X, curY, cardWidth, 48);
    ctx.strokeStyle = '#bfdbfe';
    ctx.strokeRect(c3X, curY, cardWidth, 48);
    ctx.fillStyle = '#1e40af';
    ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText('وصول شدہ نقد', c3X + cardWidth / 2, curY + 16);
    ctx.fillStyle = '#172554';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(formatPKR(summary.cashReceived || 0, 'Rs.', 'en'), c3X + cardWidth / 2, curY + 36);

    // Card 4: Credit Pending
    const c4X = c3X + cardWidth + 12;
    ctx.fillStyle = '#fff1f2';
    ctx.fillRect(c4X, curY, cardWidth, 48);
    ctx.strokeStyle = '#fecdd3';
    ctx.strokeRect(c4X, curY, cardWidth, 48);
    ctx.fillStyle = '#9f1239';
    ctx.font = '10px "Noto Sans Arabic", system-ui, sans-serif';
    ctx.fillText('بقایا ادھار (کھاتہ)', c4X + cardWidth / 2, curY + 16);
    ctx.fillStyle = '#4c0519';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(formatPKR(summary.creditPending || 0, 'Rs.', 'en'), c4X + cardWidth / 2, curY + 36);

    curY += 60;
  }

  // 3. TABLE RENDERING
  const tableX = 36;
  const tableW = width - 72;
  const rowH = 26;

  // Function to draw header row
  const drawTableHeader = (headers: Array<{ title: string; w: number; align: 'left' | 'center' | 'right' }>) => {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(tableX, curY, tableW, 26);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(tableX, curY, tableW, 26);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px "Noto Sans Arabic", system-ui, sans-serif';

    let currentX = tableX;
    headers.forEach((h) => {
      ctx.textAlign = h.align;
      let textX = currentX + h.w / 2;
      if (h.align === 'left') textX = currentX + 8;
      if (h.align === 'right') textX = currentX + h.w - 8;
      ctx.fillText(h.title, textX, curY + 17);
      currentX += h.w;
    });

    curY += 26;
  };

  // 3.1 Date Rows Table
  if (dateRows && dateRows.length > 0) {
    const colDefs: Array<{ title: string; w: number; align: 'left' | 'center' | 'right' }> = [
      { title: '#', w: 35, align: 'center' },
      { title: 'تاریخ', w: 85, align: 'center' },
      { title: 'زمیندار', w: 180, align: 'right' },
      { title: 'جنس', w: 120, align: 'right' },
      { title: 'آمد / فروخت', w: 90, align: 'center' },
      { title: 'کل فروخت', w: 100, align: 'right' },
      { title: 'کمیشن', w: 80, align: 'right' },
      { title: 'صافی رقم', w: 88, align: 'right' },
    ];

    drawTableHeader(colDefs);

    dateRows.forEach((r, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(tableX, curY, tableW, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(tableX, curY, tableW, rowH);

      let currentX = tableX;

      // Col 1: #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, curY + 17);
      currentX += 35;

      // Col 2: Date
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.date, currentX + 42, curY + 17);
      currentX += 85;

      // Col 3: Vendor
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(r.vendor, currentX + 172, curY + 17);
      currentX += 180;

      // Col 4: Product
      ctx.fillStyle = '#1e293b';
      ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(r.product, currentX + 112, curY + 17);
      currentX += 120;

      // Col 5: Qty
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.soldQty} / ${r.totalQty}`, currentX + 45, curY + 17);
      currentX += 90;

      // Col 6: Gross
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(r.grossSales, '', 'en'), currentX + 92, curY + 17);
      currentX += 100;

      // Col 7: Commission
      ctx.fillStyle = '#065f46';
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(r.commission, '', 'en'), currentX + 72, curY + 17);
      currentX += 80;

      // Col 8: Net
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(r.netPayable, '', 'en'), currentX + 80, curY + 17);

      curY += rowH;
    });

    curY += 20;
  }

  // 3.2 Customer Rows Table
  if (customerRows && customerRows.length > 0) {
    const colDefs: Array<{ title: string; w: number; align: 'left' | 'center' | 'right' }> = [
      { title: '#', w: 40, align: 'center' },
      { title: 'گاہک / خریدار', w: 230, align: 'right' },
      { title: 'فون نمبر', w: 120, align: 'center' },
      { title: 'نگ خریدے', w: 90, align: 'center' },
      { title: 'کل مال خریدا', w: 105, align: 'right' },
      { title: 'نقد وصولی', w: 95, align: 'right' },
      { title: 'بقایا ادھار', w: 98, align: 'right' },
    ];

    drawTableHeader(colDefs);

    customerRows.forEach((c, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(tableX, curY, tableW, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(tableX, curY, tableW, rowH);

      let currentX = tableX;

      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 20, curY + 17);
      currentX += 40;

      // Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(c.customerName, currentX + 220, curY + 17);
      currentX += 230;

      // Phone
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.phone || '-', currentX + 60, curY + 17);
      currentX += 120;

      // Units
      ctx.fillStyle = '#0f172a';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.unitsBought}`, currentX + 45, curY + 17);
      currentX += 90;

      // Total
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(c.totalAmount, '', 'en'), currentX + 97, curY + 17);
      currentX += 105;

      // Cash
      ctx.fillStyle = '#065f46';
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(c.cashPaid, '', 'en'), currentX + 87, curY + 17);
      currentX += 95;

      // Credit
      ctx.fillStyle = '#9f1239';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(c.creditPending, '', 'en'), currentX + 90, curY + 17);

      curY += rowH;
    });

    curY += 20;
  }

  // 3.3 Vendor Rows Table
  if (vendorRows && vendorRows.length > 0) {
    const colDefs: Array<{ title: string; w: number; align: 'left' | 'center' | 'right' }> = [
      { title: '#', w: 35, align: 'center' },
      { title: 'زمیندار / کاشتکار', w: 220, align: 'right' },
      { title: 'شہر', w: 100, align: 'right' },
      { title: 'اجناس', w: 60, align: 'center' },
      { title: 'فروخت / آمد', w: 85, align: 'center' },
      { title: 'کل رقم', w: 100, align: 'right' },
      { title: 'کمیشن', w: 80, align: 'right' },
      { title: 'صافی واجب الادا', w: 98, align: 'right' },
    ];

    drawTableHeader(colDefs);

    vendorRows.forEach((v, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(tableX, curY, tableW, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(tableX, curY, tableW, rowH);

      let currentX = tableX;

      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 17, curY + 17);
      currentX += 35;

      // Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(v.vendorName, currentX + 210, curY + 17);
      currentX += 220;

      // City
      ctx.fillStyle = '#475569';
      ctx.font = '11px "Noto Sans Arabic", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v.city || '-', currentX + 90, curY + 17);
      currentX += 100;

      // Lots
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${v.lotsCount}`, currentX + 30, curY + 17);
      currentX += 60;

      // Units
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${v.unitsSold} / ${v.totalUnits}`, currentX + 42, curY + 17);
      currentX += 85;

      // Gross
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(v.grossSales, '', 'en'), currentX + 92, curY + 17);
      currentX += 100;

      // Commission
      ctx.fillStyle = '#065f46';
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(v.commission, '', 'en'), currentX + 72, curY + 17);
      currentX += 80;

      // Net
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(v.netPayable, '', 'en'), currentX + 90, curY + 17);

      curY += rowH;
    });

    curY += 20;
  }

  // 3.4 Product Rows Table
  if (productRows && productRows.length > 0) {
    const colDefs: Array<{ title: string; w: number; align: 'left' | 'center' | 'right' }> = [
      { title: '#', w: 40, align: 'center' },
      { title: 'جنس کا نام', w: 220, align: 'right' },
      { title: 'آمد ریکارڈز', w: 90, align: 'center' },
      { title: 'فروخت / آمد نگ', w: 100, align: 'center' },
      { title: 'کل رقم', w: 110, align: 'right' },
      { title: 'اوسط ریٹ', w: 100, align: 'right' },
      { title: 'کمیشن', w: 118, align: 'right' },
    ];

    drawTableHeader(colDefs);

    productRows.forEach((p, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(tableX, curY, tableW, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(tableX, curY, tableW, rowH);

      let currentX = tableX;

      // #
      ctx.fillStyle = '#64748b';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${idx + 1}`, currentX + 20, curY + 17);
      currentX += 40;

      // Product
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11.5px "Noto Nastaliq Urdu", "Noto Sans Arabic", serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(p.productName, currentX + 210, curY + 17);
      currentX += 220;

      // Lots
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.totalLots}`, currentX + 45, curY + 17);
      currentX += 90;

      // Sold
      ctx.fillStyle = '#334155';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.soldUnits} / ${p.totalUnits}`, currentX + 50, curY + 17);
      currentX += 100;

      // Gross
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(p.grossTurnover, '', 'en'), currentX + 102, curY + 17);
      currentX += 110;

      // Avg Rate
      ctx.fillStyle = '#334155';
      ctx.font = '10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Rs.${Math.round(p.avgRate)}`, currentX + 92, curY + 17);
      currentX += 100;

      // Commission
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 10.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatPKR(p.commission, '', 'en'), currentX + 110, curY + 17);

      curY += rowH;
    });

    curY += 20;
  }

  // 4. Signatures & Footer
  curY = Math.max(curY + 30, totalHeight - 110);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, curY);
  ctx.lineTo(width - 36, curY);
  ctx.stroke();

  curY += 25;

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
  ctx.moveTo(width - 240, curY);
  ctx.lineTo(width - 60, curY);
  ctx.stroke();

  ctx.fillText('دستخط و مہر آڑھتی صاحب', width - 150, curY + 18);

  // Footer Tagline
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9.5px system-ui, sans-serif';
  ctx.fillText(`Computerized Report generated by Mandi Digital Munshi Pro System • ${generatedDate || ''}`, width / 2, curY + 45);

  return canvas;
}
