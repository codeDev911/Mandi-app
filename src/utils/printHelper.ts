import { VendorLot, AppSettings } from '../types';
import { unitLabels } from './localization';
import { formatPKR } from './currency';
import { PDFPreviewData } from './pdfReportGenerator';

/**
 * Universal Print Engine for AI Studio Iframe Environment & Standalone Browsers.
 * 1. Prepares a dedicated DOM print container with active @media print CSS so window.print() prints directly with 100% fidelity.
 * 2. Prepares an offscreen rendered iframe (non-zero width & height to avoid browser silent suppression) for direct frame printing.
 * 3. Triggers both print targets smoothly.
 */
export function printHtmlViaIframe(htmlContent: string, documentTitle: string = 'Print'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    // 1. Ensure Global Print Portal exists on top document for native window.print()
    let printPortal = document.getElementById('mandi-universal-print-portal');
    if (!printPortal) {
      printPortal = document.createElement('div');
      printPortal.id = 'mandi-universal-print-portal';
      document.body.appendChild(printPortal);
    }

    // 2. Ensure Universal Print Media Stylesheet exists
    let printStyle = document.getElementById('mandi-universal-print-styles');
    if (!printStyle) {
      printStyle = document.createElement('style');
      printStyle.id = 'mandi-universal-print-styles';
      document.head.appendChild(printStyle);
    }

    const isThermal = htmlContent.includes('80mm') || htmlContent.includes('74mm');

    printStyle.textContent = `
      @media screen {
        #mandi-universal-print-portal {
          display: none !important;
          position: absolute !important;
          left: -99999px !important;
          top: -99999px !important;
          visibility: hidden !important;
        }
      }
      @media print {
        @page {
          size: ${isThermal ? '80mm auto' : 'A4 portrait'};
          margin: ${isThermal ? '0mm' : '8mm'};
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          width: 100% !important;
        }
        /* Hide regular screen UI during print */
        body > *:not(#mandi-universal-print-portal) {
          display: none !important;
          visibility: hidden !important;
        }
        /* Display print portal only */
        #mandi-universal-print-portal {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          z-index: 99999999 !important;
        }
        #mandi-universal-print-portal * {
          visibility: visible !important;
        }
      }
    `;

    // Extract body content or set full HTML inside the print portal
    let portalContent = htmlContent;
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      portalContent = bodyMatch[1];
    }
    printPortal.innerHTML = portalContent;

    // 3. Create active offscreen iframe (with visible dimensions & opacity: 0.001 to prevent browser blocking)
    const existingIframe = document.getElementById('mandi-global-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'mandi-global-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = isThermal ? '320px' : '900px';
    iframe.style.height = '800px';
    iframe.style.opacity = '0.001';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    try {
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    } catch (err) {
      console.warn('Iframe write warning:', err);
    }

    const triggerPrint = () => {
      let iframePrinted = false;
      try {
        if (iframe.contentWindow && typeof iframe.contentWindow.print === 'function') {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          iframePrinted = true;
        }
      } catch (e) {
        console.warn('Iframe print failed or blocked, falling back to window.print():', e);
      }

      if (!iframePrinted) {
        try {
          window.focus();
          window.print();
        } catch (winErr) {
          console.error('Window print failed:', winErr);
        }
      }
    };

    setTimeout(triggerPrint, 250);
  } catch (globalErr) {
    console.error('Universal print execution error:', globalErr);
    try {
      window.print();
    } catch {
      // ignore
    }
  }
}

/**
 * Prints a clean, 100% authentic Urdu Vendor Bill Slip (A4 / Standard Paper format)
 */
export function printVendorBillSlipA4(
  vendorName: string,
  vendorPhone: string | undefined,
  vendorCity: string | undefined,
  lots: VendorLot[],
  settings: AppSettings,
  dateLabel?: string
): void {
  const isUrdu = settings.language === 'ur';
  const displayDate = dateLabel || lots[0]?.arrivalDate || new Date().toISOString().slice(0, 10);

  // Flatten all sales items
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
      const lotPaid =
        lot.vendorPaymentAmount !== undefined
          ? lot.vendorPaymentAmount
          : lot.vendorPaymentStatus === 'paid'
          ? lot.summary.netPayableToVendor
          : 0;
      acc.totalPaid += lotPaid;
      acc.totalUnits += lot.totalQuantity;

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
    { grossSales: 0, totalExpenses: 0, netPayable: 0, totalPaid: 0, totalUnits: 0 }
  );

  const allLotsPaid = totals.totalPaid >= totals.netPayable && totals.netPayable > 0;

  const tableRowsHtml = allItems
    .map(
      (item, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
      <td style="text-align: center; padding: 7px 6px; font-size: 12px; color: #64748b;">${idx + 1}</td>
      <td style="text-align: right; padding: 7px 8px; font-weight: bold; font-size: 13.5px; color: #0f172a; font-family: 'Noto Nastaliq Urdu', serif;">${item.productUrdu}</td>
      <td style="text-align: center; padding: 7px 8px; font-weight: bold; font-size: 13px; color: #1e293b;">${item.quantity} ${item.unitLabel}</td>
      <td style="text-align: right; padding: 7px 8px; font-size: 12.5px; color: #334155;">روپے ${item.ratePerUnit.toLocaleString()}</td>
      <td style="text-align: right; padding: 7px 8px; font-weight: bold; font-size: 13.5px; color: #0f172a;">روپے ${item.totalAmount.toLocaleString()}</td>
    </tr>
  `
    )
    .join('');

  const expItems = [
    { label: 'کمیشن', val: aggregatedExpenses.commission },
    { label: 'کرایہ گاڑی', val: aggregatedExpenses.kiraya },
    { label: 'مزدوری (اترائی و چنائی)', val: aggregatedExpenses.mazdoori },
    { label: 'منشیانہ', val: aggregatedExpenses.munshiana },
    { label: 'نقد پیشگی', val: aggregatedExpenses.naqdAdvance },
    { label: 'مارکیٹ فیس', val: aggregatedExpenses.marketFee },
    { label: 'دیگر کٹوتیاں', val: aggregatedExpenses.customTotal },
  ].filter((it) => it.val > 0);

  const expRowsHtml = expItems
    .map(
      (it) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px dashed #e2e8f0; font-size: 12.5px;">
      <span style="color: #475569; font-weight: 500;">${it.label}:</span>
      <span style="font-weight: bold; color: #0f172a;">- روپے ${it.val.toLocaleString()}</span>
    </div>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
      <meta charset="utf-8" />
      <title>بل رسید - ${vendorName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          body {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', Tahoma, sans-serif;
          color: #0f172a;
          background: #ffffff;
          direction: rtl;
          text-align: right;
          padding: 16px;
          line-height: 1.5;
        }
        .bill-container {
          max-width: 780px;
          margin: 0 auto;
          border: 2px solid #0f172a;
          border-radius: 12px;
          padding: 24px;
          background: #ffffff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .bismillah {
          font-size: 15px;
          font-weight: bold;
          color: #0f172a;
          margin-bottom: 4px;
        }
        .shop-name {
          font-size: 26px;
          font-weight: 800;
          color: #020617;
          margin-bottom: 4px;
        }
        .arhti-info {
          font-size: 13px;
          font-weight: bold;
          color: #1e293b;
        }
        .contact-info {
          font-size: 12px;
          color: #475569;
          margin-top: 3px;
        }
        .badge {
          display: inline-block;
          background: #f1f5f9;
          border: 1.5px solid #0f172a;
          padding: 4px 18px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: bold;
          margin-top: 8px;
          color: #0f172a;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          font-size: 12.5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          font-weight: bold;
          font-size: 13px;
          padding: 8px;
        }
        .gross-row {
          background: #f1f5f9;
          border-top: 2px solid #0f172a;
          font-weight: bold;
          font-size: 14px;
        }
        .deductions-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 14px;
        }
        .deductions-title {
          font-weight: bold;
          font-size: 13.5px;
          color: #0f172a;
          margin-bottom: 8px;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 4px;
        }
        .net-meezan-box {
          background: #0f172a;
          color: #ffffff;
          border-radius: 8px;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .net-meezan-title {
          font-size: 16px;
          font-weight: bold;
        }
        .net-meezan-amount {
          font-size: 24px;
          font-weight: 900;
          font-family: monospace, sans-serif;
          color: #facc15;
        }
        .status-box {
          border-radius: 6px;
          padding: 8px 12px;
          text-align: center;
          font-weight: bold;
          font-size: 13px;
          margin-bottom: 16px;
          ${
            allLotsPaid
              ? 'background: #ecfdf5; border: 1.5px solid #059669; color: #065f46;'
              : 'background: #fef2f2; border: 1.5px solid #dc2626; color: #991b1b;'
          }
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          padding-top: 10px;
        }
        .sig-col {
          text-align: center;
          width: 180px;
          border-top: 1.5px dashed #94a3b8;
          padding-top: 6px;
          font-size: 12px;
          font-weight: bold;
          color: #334155;
        }
        .footer-note {
          text-align: center;
          font-size: 10.5px;
          color: #64748b;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <!-- Header -->
        <div class="header">
          <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
          <div class="shop-name">${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}</div>
          <div class="arhti-info">پروپرائٹر: ${isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn}</div>
          <div class="contact-info">📍 ${isUrdu ? settings.shopAddressUrdu : settings.shopAddressEn}  •  📞 فون: ${settings.shopPhone}</div>
          <div class="badge">پکی پرچی بل برائے زمیندار</div>
        </div>

        <!-- Vendor & Date Info -->
        <div class="meta-grid">
          <div>
            <span style="color: #64748b; font-size: 11px; display: block;">زمیندار / کاشتکار:</span>
            <strong style="font-size: 15px; color: #020617;">${vendorName} ${vendorCity ? `(${vendorCity})` : ''}</strong>
          </div>
          <div>
            <span style="color: #64748b; font-size: 11px; display: block;">تاریخ حساب:</span>
            <strong style="font-size: 13.5px; color: #0f172a;">${displayDate}</strong>
          </div>
          <div>
            <span style="color: #64748b; font-size: 11px; display: block;">کل اجناس و تعداد:</span>
            <strong>${lots.length} آئٹم • ${totals.totalUnits} کل نگ</strong>
          </div>
          <div>
            <span style="color: #64748b; font-size: 11px; display: block;">رابطہ فون:</span>
            <strong>${vendorPhone || settings.shopPhone}</strong>
          </div>
        </div>

        <!-- Products Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th style="text-align: right;">تفصیلِ جنس</th>
              <th style="text-align: center; width: 140px;">تعداد بمعہ پیکنگ</th>
              <th style="text-align: right; width: 120px;">ریٹ</th>
              <th style="text-align: right; width: 140px;">کل رقم</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr class="gross-row">
              <td colspan="4" style="text-align: right; padding: 10px 12px; color: #0f172a;">مجموعی کل فروخت:</td>
              <td style="text-align: right; padding: 10px 12px; color: #0f172a; font-size: 15px;">روپے ${totals.grossSales.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Deductions & Katote -->
        <div class="deductions-box">
          <div class="deductions-title">منہا کٹوتیاں و اخراجات:</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px;">
            ${expRowsHtml}
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 6px; border-top: 1.5px solid #cbd5e1; font-weight: bold; font-size: 13.5px; color: #dc2626;">
            <span>کل منہا کٹوتیاں:</span>
            <span>- روپے ${totals.totalExpenses.toLocaleString()}</span>
          </div>
        </div>

        <!-- Net Payable -->
        <div class="net-meezan-box">
          <div class="net-meezan-title">صافی رقم برائے ادائیگی:</div>
          <div class="net-meezan-amount">روپے ${totals.netPayable.toLocaleString()}</div>
        </div>

        <!-- Payment Status -->
        <div class="status-box">
          ${allLotsPaid ? '✅ ادائیگی کی کیفیت: تمام رقم ادا شدہ ہے' : '⏳ ادائیگی کی کیفیت: ادائیگی بقایا ہے'}
        </div>

        <!-- Signatures -->
        <div class="signatures">
          <div class="sig-col">دستخط منشی / کیشیئر</div>
          <div class="sig-col">دستخط و مہر آڑھتی</div>
        </div>

        <div class="footer-note">کمپیوٹرائزڈ رسید برائے زمیندار | ڈیجیٹل منڈی سسٹم | شکریہ</div>
      </div>
    </body>
    </html>
  `;

  printHtmlViaIframe(html, `Vendor_Bill_${vendorName}`);
}

/**
 * Prints a clean, single-lot Vendor Invoice / Receipt in A4 / Standard Paper format
 * Without lot number or lot id.
 */
export function printSingleLotReceiptA4(lot: VendorLot, settings: AppSettings): void {
  const isUrdu = settings.language === 'ur';
  const unitLabel = unitLabels[lot.unitType]?.[settings.language] || unitLabels[lot.unitType]?.ur || 'نگ';
  const isPaid = lot.vendorPaymentStatus === 'paid';

  const tableRowsHtml =
    lot.sales.length === 0
      ? `<tr><td colspan="5" style="text-align:center; padding:12px; color:#94a3b8; font-size:12px;">کوئی بولی فروخت درج نہیں ہوئی۔</td></tr>`
      : lot.sales
          .map(
            (sale, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
      <td style="text-align: center; padding: 7px 6px; font-size: 12px; color: #64748b;">${idx + 1}</td>
      <td style="text-align: right; padding: 7px 8px; font-weight: bold; font-size: 13.5px; color: #0f172a; font-family: 'Noto Nastaliq Urdu', serif;">${lot.productUrdu}</td>
      <td style="text-align: center; padding: 7px 8px; font-weight: bold; font-size: 13px; color: #1e293b;">${sale.quantity} ${unitLabel}</td>
      <td style="text-align: right; padding: 7px 8px; font-size: 12.5px; color: #334155;">روپے ${sale.ratePerUnit.toLocaleString()}</td>
      <td style="text-align: right; padding: 7px 8px; font-weight: bold; font-size: 13.5px; color: #0f172a;">روپے ${sale.totalAmount.toLocaleString()}</td>
    </tr>
  `
          )
          .join('');

  const expItems = [
    { label: `کمیشن (${lot.expenses.commission.rate}%)`, val: lot.expenses.commission.enabled ? lot.expenses.commission.amount : 0 },
    { label: 'کرایہ گاڑی', val: lot.expenses.kiraya.enabled ? lot.expenses.kiraya.amount : 0 },
    { label: 'مزدوری', val: lot.expenses.mazdoori.enabled ? lot.expenses.mazdoori.amount : 0 },
    { label: 'منشیانہ', val: lot.expenses.munshiana.enabled ? lot.expenses.munshiana.amount : 0 },
    { label: 'نقد پیشگی (ایڈوانس)', val: lot.expenses.naqdAdvance.enabled ? lot.expenses.naqdAdvance.amount : 0 },
    { label: 'مارکیٹ فیس', val: lot.expenses.marketFee.enabled ? lot.expenses.marketFee.amount : 0 },
    ...(lot.expenses.customExpenses?.map((ce) => ({ label: ce.nameUrdu || ce.nameEn, val: ce.amount })) || []),
  ].filter((it) => it.val > 0);

  const expRowsHtml = expItems
    .map(
      (it) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px dashed #e2e8f0; font-size: 12.5px;">
      <span style="color: #475569; font-weight: 500;">${it.label}:</span>
      <span style="font-weight: bold; color: #0f172a;">- روپے ${it.val.toLocaleString()}</span>
    </div>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
      <meta charset="utf-8" />
      <title>رسید بل - ${lot.vendorName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          body {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', Tahoma, sans-serif;
          color: #0f172a;
          background: #ffffff;
          direction: rtl;
          text-align: right;
          padding: 16px;
          line-height: 1.5;
        }
        .bill-container {
          max-width: 780px;
          margin: 0 auto;
          border: 2px solid #0f172a;
          border-radius: 12px;
          padding: 24px;
          background: #ffffff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .bismillah { font-size: 15px; font-weight: bold; margin-bottom: 4px; }
        .shop-name { font-size: 26px; font-weight: 800; color: #020617; margin-bottom: 4px; }
        .arhti-info { font-size: 13px; font-weight: bold; color: #1e293b; }
        .contact-info { font-size: 12px; color: #475569; margin-top: 3px; }
        .badge {
          display: inline-block;
          background: #f1f5f9;
          border: 1.5px solid #0f172a;
          padding: 4px 18px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: bold;
          margin-top: 8px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          font-size: 12.5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          font-weight: bold;
          font-size: 13px;
          padding: 8px;
        }
        .gross-row {
          background: #f1f5f9;
          border-top: 2px solid #0f172a;
          font-weight: bold;
          font-size: 14px;
        }
        .deductions-box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 14px;
        }
        .deductions-title {
          font-weight: bold;
          font-size: 13.5px;
          color: #0f172a;
          margin-bottom: 8px;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 4px;
        }
        .net-meezan-box {
          background: #0f172a;
          color: #ffffff;
          border-radius: 8px;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .net-meezan-title { font-size: 16px; font-weight: bold; }
        .net-meezan-amount { font-size: 24px; font-weight: 900; color: #facc15; }
        .status-box {
          border-radius: 6px;
          padding: 8px 12px;
          text-align: center;
          font-weight: bold;
          font-size: 13px;
          margin-bottom: 16px;
          ${
            isPaid
              ? 'background: #ecfdf5; border: 1.5px solid #059669; color: #065f46;'
              : 'background: #fef2f2; border: 1.5px solid #dc2626; color: #991b1b;'
          }
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          padding-top: 10px;
        }
        .sig-col {
          text-align: center;
          width: 180px;
          border-top: 1.5px dashed #94a3b8;
          padding-top: 6px;
          font-size: 12px;
          font-weight: bold;
          color: #334155;
        }
        .footer-note {
          text-align: center;
          font-size: 10.5px;
          color: #64748b;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <!-- Header -->
        <div class="header">
          <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
          <div class="shop-name">${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}</div>
          <div class="arhti-info">پروپرائٹر: ${isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn}</div>
          <div class="contact-info">📍 ${isUrdu ? settings.shopAddressUrdu : settings.shopAddressEn}  •  📞 فون: ${settings.shopPhone}</div>
          <div class="badge">پکی پرچی بل برائے زمیندار</div>
        </div>

        <!-- Vendor & Date Info -->
        <div class="meta-grid">
          <div>
            <span style="color: #64748b; font-size: 11px; display: block;">زمیندار / کاشتکار:</span>
            <strong style="font-size: 15px; color: #020617;">${lot.vendorName} ${lot.vendorCity ? `(${lot.vendorCity})` : ''}</strong>
          </div>
          <div>
            <span style="color: #64748b; font-size: 11px; display: block;">تاریخ آمد:</span>
            <strong style="font-size: 13.5px; color: #0f172a;">${lot.arrivalDate}</strong>
          </div>
          <div>
            <span style="color: #64748b; font-size: 11px; display: block;">جنس و کل تعداد:</span>
            <strong>${lot.productUrdu} (${lot.totalQuantity} ${unitLabel})</strong>
          </div>
          <div>
            <span style="color: #64748b; font-size: 11px; display: block;">گاڑی نمبر:</span>
            <strong>${lot.vehicleNumber || 'مقامی آمد'}</strong>
          </div>
        </div>

        <!-- Sales Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th style="text-align: right;">تفصیلِ جنس</th>
              <th style="text-align: center; width: 140px;">تعداد بمعہ پیکنگ</th>
              <th style="text-align: right; width: 120px;">ریٹ</th>
              <th style="text-align: right; width: 140px;">کل رقم</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <tr class="gross-row">
              <td colspan="4" style="text-align: right; padding: 10px 12px; color: #0f172a;">مجموعی کل فروخت (${lot.summary.totalSoldQuantity} ${unitLabel}):</td>
              <td style="text-align: right; padding: 10px 12px; color: #0f172a; font-size: 15px;">روپے ${lot.summary.grossSales.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <!-- Deductions & Katote -->
        <div class="deductions-box">
          <div class="deductions-title">منہا کٹوتیاں و اخراجات:</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px;">
            ${expRowsHtml}
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 6px; border-top: 1.5px solid #cbd5e1; font-weight: bold; font-size: 13.5px; color: #dc2626;">
            <span>کل منہا کٹوتیاں:</span>
            <span>- روپے ${lot.summary.totalExpenses.toLocaleString()}</span>
          </div>
        </div>

        <!-- Net Payable -->
        <div class="net-meezan-box">
          <div class="net-meezan-title">صافی رقم برائے ادائیگی:</div>
          <div class="net-meezan-amount">روپے ${lot.summary.netPayableToVendor.toLocaleString()}</div>
        </div>

        <!-- Payment Status -->
        <div class="status-box">
          ${isPaid ? '✅ ادائیگی کی کیفیت: ادا شدہ ہے' : '⏳ ادائیگی کی کیفیت: ادائیگی بقایا ہے'}
        </div>

        <!-- Signatures -->
        <div class="signatures">
          <div class="sig-col">دستخط منشی / کیشیئر</div>
          <div class="sig-col">دستخط و مہر آڑھتی</div>
        </div>

        <div class="footer-note">کمپیوٹرائزڈ رسید برائے زمیندار | ڈیجیٹل منڈی سسٹم | شکریہ</div>
      </div>
    </body>
    </html>
  `;

  printHtmlViaIframe(html, `Vendor_Bill_${lot.vendorName}`);
}

/**
 * Prints Detailed PDF / HTML Report in Clean Urdu Layout
 */
export function printDetailedReportDocument(previewData: PDFPreviewData, previewImageUrl?: string): void {
  const { settings, title, dateFilterLabel, dateRangeStr, generatedDate, summary, dateRows, customerRows, vendorRows, productRows } = previewData;
  const isUrdu = settings.language === 'ur';

  // If exact rendered PDF Canvas image is available, print that pixel-perfect layout
  if (previewImageUrl) {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ur">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          @media print {
            body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            background: #ffffff;
            color: #000000;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 4px;
          }
          .pdf-preview-print-img {
            width: 100%;
            max-width: 820px;
            height: auto;
            display: block;
            margin: 0 auto;
            image-rendering: -webkit-optimize-contrast;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; text-align: center;">
          <img src="${previewImageUrl}" alt="${title}" class="pdf-preview-print-img" />
        </div>
      </body>
      </html>
    `;
    printHtmlViaIframe(html, title);
    return;
  }

  let tableHtml = '';

  if (dateRows && dateRows.length > 0) {
    const rows = dateRows
      .map(
        (r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="text-align: center; padding: 6px 4px; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px; font-family: monospace;">${r.date}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12.5px; font-family: 'Noto Nastaliq Urdu', serif;">${r.vendor}</td>
        <td style="text-align: right; padding: 6px 6px; font-size: 12px;">${r.product}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px;">${r.soldQty} / ${r.totalQty}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px;">روپے ${r.grossSales.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; color: #059669; font-weight: bold; font-size: 12px;">روپے ${r.commission.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px; color: #0284c7;">روپے ${r.netPayable.toLocaleString()}</td>
      </tr>
    `
      )
      .join('');

    tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="width: 85px; text-align: center;">تاریخ</th>
            <th style="text-align: right;">زمیندار</th>
            <th style="text-align: right;">جنس</th>
            <th style="width: 80px; text-align: center;">آمد / فروخت</th>
            <th style="width: 90px; text-align: right;">کل فروخت</th>
            <th style="width: 75px; text-align: right;">کمیشن</th>
            <th style="width: 90px; text-align: right;">صافی رقم</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  } else if (customerRows && customerRows.length > 0) {
    const rows = customerRows
      .map(
        (r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="text-align: center; padding: 6px 4px; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12.5px; font-family: 'Noto Nastaliq Urdu', serif;">${r.customerName}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px; font-family: monospace;">${r.phone || '-'}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px;">${r.purchasesCount}</td>
        <td style="text-align: center; padding: 6px 4px; font-weight: bold; font-size: 12px;">${r.unitsBought}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px;">روپے ${r.totalAmount.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; color: #059669; font-weight: bold; font-size: 12px;">روپے ${r.cashPaid.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px; color: #dc2626;">روپے ${r.creditPending.toLocaleString()}</td>
      </tr>
    `
      )
      .join('');

    tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="text-align: right;">خریدار / دکاندار</th>
            <th style="width: 95px; text-align: center;">فون نمبر</th>
            <th style="width: 60px; text-align: center;">سودے</th>
            <th style="width: 65px; text-align: center;">کل نگ</th>
            <th style="width: 90px; text-align: right;">کل خریداری</th>
            <th style="width: 80px; text-align: right;">نقد وصول</th>
            <th style="width: 90px; text-align: right;">بقایا ادھار</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  } else if (vendorRows && vendorRows.length > 0) {
    const rows = vendorRows
      .map(
        (r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="text-align: center; padding: 6px 4px; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12.5px; font-family: 'Noto Nastaliq Urdu', serif;">${r.vendorName}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px;">${r.city || '-'}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px;">${r.lotsCount}</td>
        <td style="text-align: center; padding: 6px 4px; font-weight: bold; font-size: 12px;">${r.unitsSold} / ${r.totalUnits}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px;">روپے ${r.grossSales.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; color: #059669; font-weight: bold; font-size: 12px;">روپے ${r.commission.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px; color: #0284c7;">روپے ${r.netPayable.toLocaleString()}</td>
      </tr>
    `
      )
      .join('');

    tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="text-align: right;">زمیندار / کاشتکار</th>
            <th style="width: 90px; text-align: center;">شہر</th>
            <th style="width: 55px; text-align: center;">لاٹس</th>
            <th style="width: 75px; text-align: center;">فروخت/آمد</th>
            <th style="width: 90px; text-align: right;">کل فروخت</th>
            <th style="width: 75px; text-align: right;">کمیشن</th>
            <th style="width: 90px; text-align: right;">صافی واجب الادا</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  } else if (productRows && productRows.length > 0) {
    const rows = productRows
      .map(
        (r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="text-align: center; padding: 6px 4px; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12.5px; font-family: 'Noto Nastaliq Urdu', serif;">${r.productName}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px;">${r.totalLots}</td>
        <td style="text-align: center; padding: 6px 4px; font-weight: bold; font-size: 12px;">${r.soldUnits} / ${r.totalUnits}</td>
        <td style="text-align: right; padding: 6px 6px; font-size: 12px;">روپے ${Math.round(r.avgRate).toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px;">روپے ${r.grossTurnover.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; color: #059669; font-weight: bold; font-size: 12px;">روپے ${r.commission.toLocaleString()}</td>
      </tr>
    `
      )
      .join('');

    tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="text-align: right;">جنس / سبزی / پھل</th>
            <th style="width: 60px; text-align: center;">کل لاٹس</th>
            <th style="width: 80px; text-align: center;">فروخت / آمد</th>
            <th style="width: 80px; text-align: right;">اوسط ریٹ</th>
            <th style="width: 100px; text-align: right;">کل فروخت رقم</th>
            <th style="width: 85px; text-align: right;">خالص کمیشن</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  const summaryHtml = summary
    ? `
    <div class="summary-cards">
      <div class="card">
        <span class="card-label">مجموعی فروخت</span>
        <span class="card-val" style="color: #0f172a;">روپے ${summary.grossSales.toLocaleString()}</span>
      </div>
      <div class="card" style="border-color: #a7f3d0; background: #ecfdf5;">
        <span class="card-label" style="color: #065f46;">کمیشن آمدن</span>
        <span class="card-val" style="color: #065f46;">روپے ${summary.commission.toLocaleString()}</span>
      </div>
      <div class="card" style="border-color: #bfdbfe; background: #eff6ff;">
        <span class="card-label" style="color: #1e40af;">نقد وصولی</span>
        <span class="card-val" style="color: #1e40af;">روپے ${(summary.cashReceived || 0).toLocaleString()}</span>
      </div>
      <div class="card" style="border-color: #fecdd3; background: #fff1f2;">
        <span class="card-label" style="color: #9f1239;">بقایا ادھار</span>
        <span class="card-val" style="color: #9f1239;">روپے ${(summary.creditPending || 0).toLocaleString()}</span>
      </div>
    </div>
  `
    : '';

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          body {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', Tahoma, sans-serif;
          color: #0f172a;
          background: #ffffff;
          direction: rtl;
          text-align: right;
          padding: 16px;
          line-height: 1.5;
        }
        .report-container {
          max-width: 820px;
          margin: 0 auto;
          border: 1.5px solid #0f172a;
          border-radius: 12px;
          padding: 20px;
          background: #ffffff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 14px;
        }
        .bismillah {
          font-size: 14px;
          font-weight: bold;
          color: #0f172a;
          margin-bottom: 3px;
        }
        .shop-name {
          font-size: 24px;
          font-weight: 800;
          color: #020617;
          margin-bottom: 3px;
        }
        .arhti-info {
          font-size: 12.5px;
          font-weight: bold;
          color: #1e293b;
        }
        .contact-info {
          font-size: 11.5px;
          color: #475569;
          margin-top: 2px;
        }
        .report-badge {
          background: #0f766e;
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 13.5px;
          font-weight: bold;
          margin-top: 8px;
          display: inline-block;
        }
        .period-bar {
          display: flex;
          justify-content: space-between;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 12px;
          margin-bottom: 14px;
          font-size: 11.5px;
          color: #334155;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        .card {
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          border-radius: 8px;
          padding: 8px 10px;
          text-align: center;
        }
        .card-label {
          display: block;
          font-size: 11px;
          font-weight: bold;
          color: #64748b;
          margin-bottom: 3px;
        }
        .card-val {
          display: block;
          font-size: 14px;
          font-weight: 900;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
        }
        th {
          background: #0f172a;
          color: #ffffff;
          font-weight: bold;
          font-size: 12px;
          padding: 7px 6px;
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          padding-top: 8px;
        }
        .sig-col {
          text-align: center;
          width: 180px;
          border-top: 1.5px dashed #94a3b8;
          padding-top: 6px;
          font-size: 11.5px;
          font-weight: bold;
          color: #334155;
        }
        .footer-note {
          text-align: center;
          font-size: 10px;
          color: #64748b;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="report-container">
        <!-- Header -->
        <div class="header">
          <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ</div>
          <div class="shop-name">${isUrdu ? settings.shopNameUrdu : settings.shopNameEn}</div>
          <div class="arhti-info">پروپرائٹر: ${isUrdu ? settings.arhtiNameUrdu : settings.arhtiNameEn}</div>
          <div class="contact-info">📍 ${isUrdu ? settings.shopAddressUrdu : settings.shopAddressEn}  •  📞 فون: ${settings.shopPhone}</div>
          <div class="report-badge">${title}</div>
        </div>

        <!-- Period Info -->
        <div class="period-bar">
          <div>دورانیہ: <b>${dateFilterLabel || 'تمام ریکارڈ'} ${dateRangeStr ? `(${dateRangeStr})` : ''}</b></div>
          <div>تاریخ اجرا: <b>${generatedDate || new Date().toISOString().slice(0, 10)}</b></div>
        </div>

        <!-- Summary -->
        ${summaryHtml}

        <!-- Data Table -->
        ${tableHtml}

        <!-- Signatures -->
        <div class="signatures">
          <div class="sig-col">دستخط منشی / کیشیئر</div>
          <div class="sig-col">دستخط و مہر آڑھتی</div>
        </div>

        <div class="footer-note">کمپیوٹرائزڈ رپورٹ | ڈیجیٹل منڈی منشی سسٹم | شکریہ</div>
      </div>
    </body>
    </html>
  `;

  printHtmlViaIframe(html, title);
}
