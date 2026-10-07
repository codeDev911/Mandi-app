import { VendorLot, AppSettings } from '../types';
import { unitLabels, formatFullRealDate, getUnitDisplayLabel } from './localization';
import { formatPKR } from './currency';
import { PDFPreviewData } from './pdfReportGenerator';

/**
 * Universal High-Reliability Isolated Print Engine.
 * - Prints HTML documents strictly inside an isolated iframe.
 * - NEVER touches or injects styles/DOM into the main parent window.
 * - Safely handles font loading, focus, and cross-browser trigger.
 * - Fallback to a dedicated pop-up window if the iframe sandbox forbids sub-frame printing.
 */
export function printHtmlViaIframe(htmlContent: string, documentTitle: string = 'Print'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    // 1. Immediately clean up any previous print elements
    const oldIframe = document.getElementById('mandi-isolated-print-iframe');
    if (oldIframe) {
      try {
        oldIframe.remove();
      } catch {}
    }
    const rogueElements = document.querySelectorAll(
      '#mandi-universal-print-portal, #mandi-universal-print-styles, #mandi-print-floating-notice'
    );
    rogueElements.forEach((el) => {
      try {
        el.remove();
      } catch {}
    });

    // 2. Create off-screen isolated iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'mandi-isolated-print-iframe';
    iframe.title = documentTitle;
    iframe.setAttribute(
      'style',
      'position: fixed; top: -10000px; left: -10000px; width: 800px; height: 1000px; border: none; opacity: 0; pointer-events: none; z-index: -99999;'
    );
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!frameDoc) {
      openPrintWindowFallback(htmlContent, documentTitle);
      return;
    }

    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    const cleanup = () => {
      setTimeout(() => {
        try {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch {}
      }, 2000);
    };

    const triggerPrint = () => {
      try {
        if (!iframe.contentWindow) {
          openPrintWindowFallback(htmlContent, documentTitle);
          return;
        }
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        cleanup();
      } catch (err) {
        console.warn('Iframe print failed or blocked by sandbox, attempting popup window fallback:', err);
        cleanup();
        openPrintWindowFallback(htmlContent, documentTitle);
      }
    };

    // Wait for content, fonts & all images to be fully loaded
    const waitForImagesAndPrint = () => {
      const imgs = Array.from(frameDoc.images || []);
      if (imgs.length === 0) {
        setTimeout(triggerPrint, 250);
        return;
      }
      let loaded = 0;
      let hasTriggered = false;
      const done = () => {
        if (hasTriggered) return;
        loaded++;
        if (loaded >= imgs.length) {
          hasTriggered = true;
          setTimeout(triggerPrint, 150);
        }
      };
      imgs.forEach((img) => {
        if (img.complete) {
          done();
        } else {
          img.onload = done;
          img.onerror = done;
        }
      });
      // Safety timeout in case an image event stalls
      setTimeout(() => {
        if (!hasTriggered) {
          hasTriggered = true;
          triggerPrint();
        }
      }, 1000);
    };

    if (frameDoc.readyState === 'complete') {
      waitForImagesAndPrint();
    } else {
      iframe.onload = () => {
        waitForImagesAndPrint();
      };
      setTimeout(waitForImagesAndPrint, 800);
    }
  } catch (err) {
    console.error('Print trigger error:', err);
    openPrintWindowFallback(htmlContent, documentTitle);
  }
}

/**
 * Fallback to a dedicated clean window for printing
 */
function openPrintWindowFallback(htmlContent: string, title: string) {
  try {
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(htmlContent);
      win.document.close();
      win.onload = () => {
        setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch {}
        }, 300);
      };
    }
  } catch (e) {
    console.warn('Popup print fallback blocked:', e);
  }
}

/**
 * Generates the authentic Insaf Mandi Commission Shop printed bill HTML matching the physical pad
 */
export function generateInsafMandiBillHtmlSingle(
  vendorName: string,
  vendorPhone: string | undefined,
  vendorCity: string | undefined,
  lots: VendorLot[],
  settings: AppSettings,
  dateLabel?: string,
  isAveraged: boolean = false,
  billNumber?: string
): string {
  const isUrdu = settings.language === 'ur';
  const displayDate = formatFullRealDate(dateLabel, lots[0]?.arrivalDate);
  const displayBillNo = billNumber || lots[0]?.lotNumber || '101';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shopName = settings.shopNameUrdu || settings.shopNameEn || 'کمیشن شاپ';
  const shopAddress = settings.shopAddressUrdu || settings.shopAddressEn || '';
  const arhtiName = settings.arhtiNameUrdu || settings.arhtiNameEn || '';
  const phone1 = settings.shopPhone?.trim() || '';
  const phone2 = settings.shopPhone2?.trim() || '';
  const tarKaPata = settings.tarKaPataUrdu?.trim() || '';

  const aggregatedExpenses = {
    commission: 0,
    kiraya: 0,
    mazdoori: 0,
    munshiana: 0,
    naqdAdvance: 0,
    marketFee: 0,
    customTotal: 0,
  };

  let totalGross = 0;
  let totalExpenses = 0;
  let totalNetPayable = 0;
  let totalUnits = 0;
  let totalPaid = 0;
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

    if (lot.expenses.commission.enabled) aggregatedExpenses.commission += Number(lot.expenses.commission.amount) || 0;
    if (lot.expenses.kiraya.enabled) aggregatedExpenses.kiraya += Number(lot.expenses.kiraya.amount) || 0;
    if (lot.expenses.mazdoori.enabled) aggregatedExpenses.mazdoori += Number(lot.expenses.mazdoori.amount) || 0;
    if (lot.expenses.munshiana.enabled) aggregatedExpenses.munshiana += Math.round(Number(lot.expenses.munshiana.amount) || 0);
    if (lot.expenses.naqdAdvance.enabled) aggregatedExpenses.naqdAdvance += Number(lot.expenses.naqdAdvance.amount) || 0;
    if (lot.expenses.marketFee.enabled) aggregatedExpenses.marketFee += Number(lot.expenses.marketFee.amount) || 0;
    lot.expenses.customExpenses?.forEach((ce) => {
      aggregatedExpenses.customTotal += Number(ce.amount) || 0;
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

  // Build items list
  const allItems: Array<{
    lotNumber: string;
    productUrdu: string;
    quantity: number;
    unitLabel: string;
    ratePerUnit: number;
    totalAmount: number;
  }> = [];

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
    // Averaged: Group by Product
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
  const minRows = 6;
  const emptyRowsCount = Math.max(0, minRows - allItems.length);

  const saleRowsHtml = allItems
    .map(
      (item) => `
    <div style="height: 22px; display: flex; align-items: center; border-bottom: 1px solid rgba(185, 28, 28, 0.6); font-size: 11px; font-weight: 600; color: #0f172a;">
      <div style="width: 82px; height: 100%; border-left: 1.5px solid rgba(185, 28, 28, 0.6); display: flex; align-items: center; justify-content: center; font-weight: bold; font-family: monospace, sans-serif;">
        ${Math.round(item.totalAmount).toLocaleString()}
      </div>
      <div dir="ltr" style="flex: 1; height: 100%; display: flex; align-items: center; justify-content: flex-start; padding: 0 6px; text-align: left;">
        <!-- 1. Rate (from left) -->
        <div style="width: 58px; text-align: left; flex-shrink: 0; font-family: monospace, sans-serif; font-size: 11.5px; font-weight: bold; color: #0f172a;">
          ${Math.round(item.ratePerUnit).toLocaleString()}
        </div>
        <span style="color: #f87171; font-size: 10px; margin: 0 4px; flex-shrink: 0;">•</span>
        <!-- 2. Product Name -->
        <div style="flex: 1; text-align: center; font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', serif; font-size: 12.5px; font-weight: bold; color: #020617; padding: 0 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;" dir="rtl">
          ${item.productUrdu}
        </div>
        <span style="color: #f87171; font-size: 10px; margin: 0 4px; flex-shrink: 0;">•</span>
        <!-- 3. Unit Type -->
        <div style="width: 48px; text-align: center; flex-shrink: 0; font-family: 'Noto Sans Arabic', sans-serif; font-size: 11px; font-weight: 600; color: #334155;" dir="rtl">
          ${item.unitLabel}
        </div>
        <span style="color: #f87171; font-size: 10px; margin: 0 4px; flex-shrink: 0;">•</span>
        <!-- 4. Qty -->
        <div style="width: 44px; text-align: center; flex-shrink: 0; font-family: monospace, sans-serif; font-size: 12px; font-weight: 900; color: #0f172a;">
          ${item.quantity}
        </div>
      </div>
    </div>
  `
    )
    .join('');

  const emptyRowsHtml = Array.from({ length: emptyRowsCount })
    .map(
      () => `
    <div style="height: 21px; display: flex; align-items: center; border-bottom: 1px solid rgba(185, 28, 28, 0.6);">
      <div style="width: 82px; height: 100%; border-left: 1.5px solid rgba(185, 28, 28, 0.6);"></div>
      <div style="flex: 1; height: 100%;"></div>
    </div>
  `
    )
    .join('');

  return `
    <div dir="rtl" class="insaf-mandi-bill-wrapper" style="width: 148.8mm; height: 210mm; min-height: 210mm; max-height: 210mm; margin: 0 auto; background: #ffffff; color: #0f172a; box-sizing: border-box; font-family: 'Noto Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif; display: flex; border: 1.5px solid #cbd5e1; overflow: hidden;">
      <!-- Right Produce Border -->
      <div style="width: 7mm; background-image: url('${origin}/bill_produce_border.jpg'); background-size: 100% auto; background-repeat: repeat-y; flex-shrink: 0; border-left: 1px solid #e2e8f0;"></div>

      <!-- Main Center Content -->
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 1.5mm 3mm; background: #ffffff; box-sizing: border-box; overflow: hidden; height: 100%;">
        <!-- Top Header (Clean White Background, Red Outline - NO MOUNTAIN IMAGE) -->
        <div style="position: relative; width: 100%; border: 2px solid #b91c1c; border-radius: 6px 6px 0 0; background: #ffffff; padding: 1.5mm 2.5mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; font-family: 'Noto Nastaliq Urdu', serif; color: #dc2626; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 2px 4px rgba(0,0,0,0.25); line-height: 1.2;">
              ${shopName}
            </h1>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 1px;">
            <!-- Yellow Phone Badge from Settings -->
            ${
              phone1
                ? `<div style="background: #fef08a; border: 1px solid #000; border-radius: 4px; padding: 1px 6px; font-weight: 900; font-size: 9.5px; font-family: monospace; color: #020617; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                    <div>📱 ${phone1}</div>
                    ${phone2 ? `<div style="border-top: 1px solid #94a3b8; margin-top: 1px;">${phone2}</div>` : ''}
                   </div>`
                : '<div style="width: 1px;"></div>'
            }

            <!-- Mandi Address from Settings -->
            ${
              shopAddress
                ? `<div style="flex: 1; text-align: center; padding-right: 6px;">
                    <span style="font-size: 12px; font-weight: 900; font-family: 'Noto Nastaliq Urdu', serif; color: #0f172a;">
                      ${shopAddress}
                    </span>
                   </div>`
                : ''
            }
          </div>

          <!-- Proprietor Info & Tar Ka Pata from Settings -->
          ${
            arhtiName || tarKaPata
              ? `<div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 1px; margin-top: 2px;">
                  <span style="font-size: 10px; font-weight: bold; font-family: 'Noto Nastaliq Urdu', serif; color: #334155;">
                    ${arhtiName ? `پروپرائیٹر: ${arhtiName}` : ''}${tarKaPata ? `${arhtiName ? ' • ' : ''}تار کا پتہ: ${tarKaPata}` : ''}
                  </span>
                 </div>`
              : ''
          }
        </div>

        <!-- Subheader Metadata Row -->
        <div style="margin: 2px 0; border-top: 2px solid #b91c1c; border-bottom: 2px solid #b91c1c; padding: 2px 6px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: bold; background: #ffffff;">
          <div style="flex-shrink: 0;">
            <span style="color: #b91c1c; font-family: 'Noto Nastaliq Urdu', serif; font-size: 11.5px; font-weight: bold;">نمبر:</span>
            <span style="text-decoration: underline; font-family: monospace; font-weight: bold; padding: 0 4px; font-size: 11.5px;">${displayBillNo}</span>
          </div>
          <div style="flex: 1; text-align: center; padding: 0 6px; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span style="color: #b91c1c; font-family: 'Noto Nastaliq Urdu', serif; font-size: 14px; font-weight: 900; flex-shrink: 0;">بل بنام:</span>
            <span style="text-decoration: underline; text-decoration-color: #b91c1c; font-size: 21px; font-weight: 900; font-family: 'Noto Nastaliq Urdu', 'Noto Sans Arabic', serif; padding: 0 4px; color: #020617; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${vendorName} ${vendorCity ? `(${vendorCity})` : ''}</span>
          </div>
          <div style="flex-shrink: 0;">
            <span style="color: #b91c1c; font-family: 'Noto Nastaliq Urdu', serif; font-size: 11.5px; font-weight: bold;">السلام علیکم تاریخ:</span>
            <span style="text-decoration: underline; font-family: monospace; font-weight: bold; padding: 0 4px; font-size: 11.5px;">${displayDate}</span>
          </div>
        </div>

        <!-- Red Ruled Table Grid (Half-A4 Landscape Sizing) -->
        <div style="flex: 1; display: flex; border: 2px solid #b91c1c; background: #ffffff; min-height: 0; overflow: hidden;">
          <!-- Left Column: اخراجات (7 Badges + ICS Badge) -->
          <div style="width: 28%; border-left: 2px solid #b91c1c; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff;">
            <div>
              <div style="height: 22px; border-bottom: 2px solid #b91c1c; background: #fef2f2; display: flex; align-items: center; justify-content: center;">
                <h3 style="margin: 0; font-size: 11px; font-weight: 900; font-family: 'Noto Nastaliq Urdu', serif; color: #991b1b;">اخراجات</h3>
              </div>

              <!-- 7 Badges Stack -->
              <div style="padding: 3px; display: flex; flex-direction: column; gap: 3px;">
                <!-- 1. کمیشن -->
                <div style="display: flex; align-items: center; gap: 3px;">
                  <div style="flex: 1; height: 20px; border: 1px solid #b91c1c; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; font-family: monospace;">
                    ${aggregatedExpenses.commission > 0 ? Math.round(aggregatedExpenses.commission).toLocaleString() : ''}
                  </div>
                  <div style="width: 48px; height: 20px; border-radius: 9999px; background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: bold; font-family: 'Noto Sans Arabic', sans-serif;">
                    کمیشن
                  </div>
                </div>

                <!-- 2. کرایہ -->
                <div style="display: flex; align-items: center; gap: 3px;">
                  <div style="flex: 1; height: 20px; border: 1px solid #b91c1c; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; font-family: monospace;">
                    ${aggregatedExpenses.kiraya > 0 ? Math.round(aggregatedExpenses.kiraya).toLocaleString() : ''}
                  </div>
                  <div style="width: 48px; height: 20px; border-radius: 9999px; background: linear-gradient(135deg, #16a34a, #15803d); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: bold; font-family: 'Noto Sans Arabic', sans-serif;">
                    کرایہ
                  </div>
                </div>

                <!-- 3. مزدوری -->
                <div style="display: flex; align-items: center; gap: 3px;">
                  <div style="flex: 1; height: 20px; border: 1px solid #b91c1c; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; font-family: monospace;">
                    ${aggregatedExpenses.mazdoori > 0 ? Math.round(aggregatedExpenses.mazdoori).toLocaleString() : ''}
                  </div>
                  <div style="width: 48px; height: 20px; border-radius: 9999px; background: linear-gradient(135deg, #db2777, #be185d); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: bold; font-family: 'Noto Sans Arabic', sans-serif;">
                    مزدوری
                  </div>
                </div>

                <!-- 4. منشیانہ -->
                <div style="display: flex; align-items: center; gap: 3px;">
                  <div style="flex: 1; height: 20px; border: 1px solid #b91c1c; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; font-family: monospace;">
                    ${aggregatedExpenses.munshiana > 0 ? Math.round(aggregatedExpenses.munshiana).toLocaleString() : ''}
                  </div>
                  <div style="width: 48px; height: 20px; border-radius: 9999px; background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: bold; font-family: 'Noto Sans Arabic', sans-serif;">
                    منشیانہ
                  </div>
                </div>

                <!-- 5. نقد -->
                <div style="display: flex; align-items: center; gap: 3px;">
                  <div style="flex: 1; height: 20px; border: 1px solid #b91c1c; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; font-family: monospace;">
                    ${aggregatedExpenses.naqdAdvance > 0 ? Math.round(aggregatedExpenses.naqdAdvance).toLocaleString() : ''}
                  </div>
                  <div style="width: 48px; height: 20px; border-radius: 9999px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: bold; font-family: 'Noto Sans Arabic', sans-serif;">
                    نقد
                  </div>
                </div>

                <!-- 6. مارکیٹ فیس -->
                <div style="display: flex; align-items: center; gap: 3px;">
                  <div style="flex: 1; height: 20px; border: 1px solid #b91c1c; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; font-family: monospace;">
                    ${aggregatedExpenses.marketFee > 0 ? Math.round(aggregatedExpenses.marketFee).toLocaleString() : ''}
                  </div>
                  <div style="width: 48px; height: 20px; border-radius: 9999px; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: bold; font-family: 'Noto Sans Arabic', sans-serif;">
                    مارکیٹ فیس
                  </div>
                </div>

                <!-- 7. میزان -->
                <div style="display: flex; align-items: center; gap: 3px;">
                  <div style="flex: 1; height: 22px; border: 1.5px solid #6b21a8; background: #faf5ff; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; font-family: monospace; color: #581c87;">
                    ${meezanExpenses > 0 ? Math.round(meezanExpenses).toLocaleString() : '0'}
                  </div>
                  <div style="width: 48px; height: 22px; border-radius: 9999px; background: linear-gradient(135deg, #9333ea, #7e22ce); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; font-family: 'Noto Sans Arabic', sans-serif;">
                    میزان
                  </div>
                </div>
              </div>
            </div>

            <!-- ICS Logo Badge at Bottom Left -->
            <div style="padding: 3px; border-top: 1px solid rgba(185, 28, 28, 0.4); background: #fef2f2; margin-top: auto;">
              <div style="background: linear-gradient(to bottom, #9f1239, #4c0519); border: 1.5px solid #facc15; border-radius: 6px; padding: 2px 2px; text-align: center;">
                <div style="font-size: 8px; font-weight: bold; font-family: 'Noto Nastaliq Urdu', serif; color: #fef08a; line-height: 1;">
                  آپ کے اعتماد کا نام
                </div>
                <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #facc15; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, 0 1px 2px rgba(0,0,0,0.8); line-height: 1.1;">
                  ICS
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: تفصیل مال بکری & ٹوٹل -->
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff; min-height: 0; overflow: hidden;">
            <div style="overflow: hidden;">
              <div style="height: 22px; border-bottom: 2px solid #b91c1c; background: #fef2f2; display: flex; align-items: center;">
                <div style="width: 82px; height: 100%; border-left: 2px solid #b91c1c; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; font-family: 'Noto Nastaliq Urdu', serif; color: #991b1b;">
                  ٹوٹل
                </div>
                <div style="flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; font-family: 'Noto Nastaliq Urdu', serif; color: #991b1b;">
                  تفصیل مال بکری
                </div>
              </div>

              <!-- Item Rows -->
              <div>
                ${saleRowsHtml}
                ${emptyRowsHtml}
              </div>
            </div>

            <!-- Bottom 3 Summary Rows (Background colors removed) -->
            <div style="border-top: 2px solid #b91c1c; margin-top: auto; background: #ffffff;">
              <!-- خام بکری -->
              <div style="height: 22px; display: flex; align-items: center; background: #ffffff; color: #0f172a; font-weight: bold; border-bottom: 1px solid #b91c1c;">
                <div style="width: 82px; height: 100%; border-left: 2px solid #b91c1c; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 11.5px; font-weight: 900; color: #0f172a;">
                  ${Math.round(totalGross).toLocaleString()}
                </div>
                <div style="flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; font-family: 'Noto Nastaliq Urdu', serif; font-size: 11.5px; font-weight: bold; color: #991b1b;">
                  خام بکری
                </div>
              </div>

              <!-- جملہ اخراجات -->
              <div style="height: 22px; display: flex; align-items: center; background: #ffffff; color: #0f172a; font-weight: bold; border-bottom: 1px solid #b91c1c;">
                <div style="width: 82px; height: 100%; border-left: 2px solid #b91c1c; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 11.5px; font-weight: 900; color: #0f172a;">
                  ${Math.round(meezanExpenses).toLocaleString()}
                </div>
                <div style="flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; font-family: 'Noto Nastaliq Urdu', serif; font-size: 11.5px; font-weight: bold; color: #991b1b;">
                  جملہ اخراجات
                </div>
              </div>

              <!-- پختہ بکری -->
              <div style="height: 24px; display: flex; align-items: center; background: #ffffff; color: #0f172a; font-weight: 900;">
                <div style="width: 82px; height: 100%; border-left: 2px solid #b91c1c; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 13.5px; font-weight: 900; color: #0f172a;">
                  ${Math.round(totalNetPayable).toLocaleString()}
                </div>
                <div style="flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; font-family: 'Noto Nastaliq Urdu', serif; font-size: 13px; font-weight: 900; color: #991b1b;">
                  پختہ بکری
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Row -->
        <div style="margin-top: 2px; padding-top: 2px; border-top: 2px solid #b91c1c; display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; color: #1e293b;">
          <div style="display: flex; align-items: center; gap: 3px;">
            <span style="font-family: 'Noto Nastaliq Urdu', serif; font-size: 11px;">دستخط:</span>
            <span style="display: inline-block; width: 70px; border-bottom: 1.5px dotted #475569;"></span>
          </div>

          <div>
            ${
              isFullyPaid
                ? `<div style="border: 1.5px solid #dc2626; color: #dc2626; border-radius: 4px; padding: 1px 6px; font-weight: 900; font-size: 12px; font-family: monospace; transform: rotate(-5deg); display: inline-block;">PAID</div>`
                : `<div style="border: 1.5px solid #d97706; color: #b45309; border-radius: 4px; padding: 1px 6px; font-weight: bold; font-size: 10px; font-family: 'Noto Sans Arabic', sans-serif; display: inline-block;">باقی / نابلد</div>`
            }
          </div>

          <div style="text-align: left; font-family: sans-serif; line-height: 1;">
            <div style="font-size: 10.5px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px;">${settings.shopNameEn ? settings.shopNameEn.slice(0, 16) : 'COMMISSION'}</div>
            <div style="font-size: 8.5px; font-weight: bold; color: #166534;">Commission Shop</div>
          </div>
        </div>
      </div>

      <!-- Left Produce Border (Mirrored) -->
      <div style="width: 7mm; background-image: url('${origin}/bill_produce_border.jpg'); background-size: 100% auto; background-repeat: repeat-y; flex-shrink: 0; border-right: 1px solid #e2e8f0; transform: scaleX(-1);"></div>
    </div>
  `;
}

/**
 * Prints a single Vendor Bill Slip in the authentic Insaf Mandi Commission Shop design
 */
export function printVendorBillSlipA4(
  vendorName: string,
  vendorPhone: string | undefined,
  vendorCity: string | undefined,
  lots: VendorLot[],
  settings: AppSettings,
  dateLabel?: string,
  isAveraged: boolean = false
): void {
  const billHtml = generateInsafMandiBillHtmlSingle(
    vendorName,
    vendorPhone,
    vendorCity,
    lots,
    settings,
    dateLabel,
    isAveraged
  );

  const fullHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
      <meta charset="utf-8" />
      <title>بل رسید - ${vendorName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700;900&family=Noto+Sans+Arabic:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
      <style>
        @page {
          size: 148.8mm 210mm;
          margin: 0;
        }
        @media print {
          @page {
            size: 148.8mm 210mm;
            margin: 0;
          }
          html, body {
            width: 148.8mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .insaf-mandi-bill-wrapper {
            width: 148.8mm !important;
            height: 210mm !important;
            min-height: 210mm !important;
            max-height: 210mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            margin: 0 !important;
          }
          .no-print { display: none !important; }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          background: #ffffff;
          padding: 0;
          margin: 0;
          display: flex;
          justify-content: center;
        }
      </style>
    </head>
    <body>
      ${billHtml}
    </body>
    </html>
  `;

  printHtmlViaIframe(fullHtml, `Vendor_Bill_${vendorName}`);
}

/**
 * Batch Prints multiple selected Vendor Bills in one unified print operation with clean page breaks
 */
export function printBatchVendorBillsA4(
  vendorDataList: Array<{
    vendorName: string;
    vendorPhone?: string;
    vendorCity?: string;
    lots: VendorLot[];
    billNumber?: string;
  }>,
  settings: AppSettings,
  dateLabel?: string,
  isAveraged: boolean = false
): void {
  if (vendorDataList.length === 0) return;

  const billsPagesHtml = vendorDataList
    .map(
      (v) => `
    <div class="bill-page" style="page-break-after: always; break-after: page; width: 148.8mm; height: 210mm; min-height: 210mm; max-height: 210mm; overflow: hidden; display: flex; justify-content: center; box-sizing: border-box; margin: 0 auto;">
      ${generateInsafMandiBillHtmlSingle(
        v.vendorName,
        v.vendorPhone,
        v.vendorCity,
        v.lots,
        settings,
        dateLabel,
        isAveraged,
        v.billNumber
      )}
    </div>
  `
    )
    .join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
      <meta charset="utf-8" />
      <title>زمیندار بل بک - مجموعی پرنٹ (${vendorDataList.length} بل)</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700;900&family=Noto+Sans+Arabic:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
      <style>
        @page {
          size: 148.8mm 210mm;
          margin: 0;
        }
        @media print {
          @page {
            size: 148.8mm 210mm;
            margin: 0;
          }
          html, body {
            width: 148.8mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .bill-page, .insaf-mandi-bill-wrapper {
            page-break-after: always !important;
            break-after: page !important;
            width: 148.8mm !important;
            height: 210mm !important;
            min-height: 210mm !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .no-print { display: none !important; }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          background: #ffffff;
          padding: 0;
          margin: 0;
        }
      </style>
    </head>
    <body>
      ${billsPagesHtml}
    </body>
    </html>
  `;

  printHtmlViaIframe(fullHtml, `Batch_Vendor_Bills_${vendorDataList.length}`);
}

/**
 * Prints a clean, single-lot Vendor Invoice / Receipt in A4 / Standard Paper format
 * Without lot number or lot id.
 */
export function printSingleLotReceiptA4(lot: VendorLot, settings: AppSettings): void {
  const isUrdu = settings.language === 'ur';
  const unitLabel = getUnitDisplayLabel(lot.unitType, settings.language);
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
export function printDetailedReportDocument(previewData: PDFPreviewData, previewImageUrls?: string | string[]): void {
  const { settings, title, dateFilterLabel, dateRangeStr, generatedDate, summary, dateRows, customerRows, vendorRows, productRows, expenseRows } = previewData;
  const isUrdu = settings.language === 'ur';

  // If exact rendered PDF Canvas image(s) are available, print that pixel-perfect multi-page layout
  if (previewImageUrls) {
    const images = Array.isArray(previewImageUrls)
      ? previewImageUrls
      : (previewImageUrls ? [previewImageUrls] : []);

    if (images.length > 0) {
      const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ur">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .pdf-preview-page {
            width: 100%;
            max-width: 210mm;
            height: 297mm;
            min-height: 297mm;
            max-height: 297mm;
            margin: 0 auto;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: hidden;
            background: #ffffff;
          }
          .pdf-preview-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .pdf-preview-print-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
            margin: 0 auto;
            image-rendering: -webkit-optimize-contrast;
          }
          @media print {
            body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .pdf-preview-page {
              width: 210mm !important;
              height: 297mm !important;
              max-width: none !important;
              margin: 0 !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            .pdf-preview-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          }
        </style>
      </head>
      <body>
        ${images
          .map(
            (imgUrl, idx) => `
          <div class="pdf-preview-page">
            <img src="${imgUrl}" alt="${title} - Page ${idx + 1}" class="pdf-preview-print-img" />
          </div>
        `
          )
          .join('')}
      </body>
      </html>
    `;
      printHtmlViaIframe(html, title);
      return;
    }
  }

  let tableHtml = '';

  if (previewData.reportType === 'entire_record' || (previewData.entireLots && previewData.entireLots.length > 0)) {
    const lots = previewData.entireLots || [];

    // Group purely by date into shop financial lines (NO vendor products or lots)
    const dateMap = new Map<
      string,
      {
        date: string;
        grossSales: number;
        mazdoori: number;
        munshiana: number;
        commission: number;
        shopProfit: number;
        cashReceived: number;
        creditPending: number;
      }
    >();

    lots.forEach((l) => {
      const d = l.arrivalDate || 'N/A';
      if (!dateMap.has(d)) {
        dateMap.set(d, {
          date: d,
          grossSales: 0,
          mazdoori: 0,
          munshiana: 0,
          commission: 0,
          shopProfit: 0,
          cashReceived: 0,
          creditPending: 0,
        });
      }
      const entry = dateMap.get(d)!;
      entry.grossSales += (l.summary?.grossSales || 0);
      const maz = l.expenses?.mazdoori?.enabled ? Number(l.expenses.mazdoori.amount) || 0 : 0;
      const mun = l.expenses?.munshiana?.enabled ? Number(l.expenses.munshiana.amount) || 0 : 0;
      const com = l.summary?.arhtiProfitCommission || 0;
      entry.mazdoori += maz;
      entry.munshiana += mun;
      entry.commission += com;
      entry.shopProfit += (com + mun);

      (l.sales || []).forEach((s) => {
        if (s.paymentStatus === 'cash') {
          entry.cashReceived += s.totalAmount;
        } else {
          const paid = s.paidAmount || 0;
          entry.cashReceived += paid;
          entry.creditPending += Math.max(0, s.totalAmount - paid);
        }
      });
    });

    const shopRows = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    const rows = shopRows
      .map((r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="text-align: center; padding: 7px 4px; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="text-align: center; padding: 7px 4px; font-size: 11px; font-family: monospace;">${r.date}</td>
        <td style="text-align: right; padding: 7px 6px; font-weight: bold; font-size: 12px; font-family: 'Noto Nastaliq Urdu', serif;">دکان کاروباری سیل و حساب</td>
        <td style="text-align: right; padding: 7px 6px; font-weight: bold; font-size: 11.5px;">روپے ${r.grossSales.toLocaleString()}</td>
        <td style="text-align: right; padding: 7px 6px; font-size: 11px; color: #1e293b;">روپے ${r.mazdoori.toLocaleString()}</td>
        <td style="text-align: right; padding: 7px 6px; font-size: 11px; color: #7c3aed;">روپے ${r.munshiana.toLocaleString()}</td>
        <td style="text-align: right; padding: 7px 6px; font-size: 11px; color: #059669; font-weight: bold;">روپے ${r.commission.toLocaleString()}</td>
        <td style="text-align: right; padding: 7px 6px; font-weight: bold; font-size: 11.5px; color: #047857;">روپے ${r.shopProfit.toLocaleString()}</td>
        <td style="text-align: center; padding: 7px 4px; font-size: 10px; color: ${r.creditPending > 0 ? '#b45309' : '#047857'}; font-weight: bold;">نقد: ${Math.round(r.cashReceived / 1000)}k | ادھار: ${Math.round(r.creditPending / 1000)}k</td>
      </tr>
    `)
      .join('');

    tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="width: 80px; text-align: center;">تاریخ</th>
            <th style="text-align: right;">مالی کھاتہ / تفصیل</th>
            <th style="width: 100px; text-align: right;">مجموعی فروخت</th>
            <th style="width: 80px; text-align: right;">مزدوری فنڈ</th>
            <th style="width: 80px; text-align: right;">منشیانہ آمدن</th>
            <th style="width: 80px; text-align: right;">کمیشن آمدن</th>
            <th style="width: 85px; text-align: right;">دکان خالص منافع</th>
            <th style="width: 105px; text-align: center;">نقد و ادھار</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  } else if (dateRows && dateRows.length > 0) {
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
            <th style="width: 75px; text-align: center;">کل تعداد / پیکنگ</th>
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
        (r, idx) => {
          const isPaid = (r.pendingBalance !== undefined && r.pendingBalance <= 0 && r.netPayable > 0) || r.paymentStatus === 'paid' || r.paymentStatus === 'cash';
          const isPartial = (r.totalPaid && r.totalPaid > 0 && r.pendingBalance && r.pendingBalance > 0) || r.paymentStatus === 'partial';
          const statusText = isPaid ? 'نقد (ادا شدہ)' : isPartial ? 'جزوی نقد' : 'ادھار (بقایا)';
          const statusBg = isPaid ? '#ecfdf5' : isPartial ? '#fef3c7' : '#fff1f2';
          const statusColor = isPaid ? '#065f46' : isPartial ? '#b45309' : '#9f1239';

          return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="text-align: center; padding: 6px 4px; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12.5px; font-family: 'Noto Nastaliq Urdu', serif;">${r.vendorName}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px;">${r.city || '-'}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px;">${r.lotsCount}</td>
        <td style="text-align: center; padding: 6px 4px; font-weight: bold; font-size: 12px;">${r.unitsSold} / ${r.totalUnits}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px;">روپے ${r.grossSales.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px; color: #0284c7;">روپے ${r.netPayable.toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px; color: #059669;">روپے ${(r.totalPaid || 0).toLocaleString()}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px; color: #dc2626;">روپے ${(r.pendingBalance !== undefined ? r.pendingBalance : Math.max(0, r.netPayable - (r.totalPaid || 0))).toLocaleString()}</td>
        <td style="text-align: center; padding: 6px 4px;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: bold; background: ${statusBg}; color: ${statusColor};">${statusText}</span>
        </td>
      </tr>
    `;
        }
      )
      .join('');

    tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 25px; text-align: center;">#</th>
            <th style="text-align: right;">زمیندار / کاشتکار</th>
            <th style="width: 75px; text-align: center;">شہر</th>
            <th style="width: 45px; text-align: center;">لاٹس</th>
            <th style="width: 70px; text-align: center;">فروخت/آمد</th>
            <th style="width: 85px; text-align: right;">کل فروخت</th>
            <th style="width: 85px; text-align: right;">صافی واجب الادا</th>
            <th style="width: 80px; text-align: right;">ادا شدہ (نقد)</th>
            <th style="width: 80px; text-align: right;">بقایا (ادھار)</th>
            <th style="width: 95px; text-align: center;">حیثیت (نقد/ادھار)</th>
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
  } else if (expenseRows && expenseRows.length > 0) {
    const rows = expenseRows
      .map(
        (r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background: #f8fafc;' : ''}">
        <td style="text-align: center; padding: 6px 4px; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11.5px; font-family: monospace;">${r.date}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12px; color: #1e293b;">${r.category}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12.5px; font-family: 'Noto Nastaliq Urdu', serif;">${r.title}</td>
        <td style="text-align: right; padding: 6px 6px; font-size: 11.5px; color: #475569;">${r.paidTo || '-'}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 11px;">${r.paymentMethod === 'cash' ? 'نقد' : r.paymentMethod === 'online' ? 'آن لائن' : 'چیک'}</td>
        <td style="text-align: right; padding: 6px 6px; font-weight: bold; font-size: 12.5px; color: #be123c;">روپے ${r.amount.toLocaleString()}</td>
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
            <th style="width: 100px; text-align: right;">مد / کیٹیگری</th>
            <th style="text-align: right;">تفصیل / عنوان</th>
            <th style="width: 100px; text-align: right;">بنام / وصول کنندہ</th>
            <th style="width: 70px; text-align: center;">طریقہ</th>
            <th style="width: 95px; text-align: right;">رقم (روپے)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  const summaryHtml = summary
    ? summary.totalExpenses !== undefined && previewData.reportType === 'expenses'
      ? `
    <div class="summary-cards">
      <div class="card" style="border-color: #fecdd3; background: #fff1f2;">
        <span class="card-label" style="color: #9f1239;">کل دکان اخراجات</span>
        <span class="card-val" style="color: #9f1239;">روپے ${(summary.totalExpenses || 0).toLocaleString()}</span>
      </div>
      <div class="card" style="border-color: #a7f3d0; background: #ecfdf5;">
        <span class="card-label" style="color: #065f46;">نقد ادائیگی</span>
        <span class="card-val" style="color: #065f46;">روپے ${(summary.cashReceived || 0).toLocaleString()}</span>
      </div>
      <div class="card" style="border-color: #bfdbfe; background: #eff6ff;">
        <span class="card-label" style="color: #1e40af;">آن لائن / بینک</span>
        <span class="card-val" style="color: #1e40af;">روپے ${(summary.creditPending || 0).toLocaleString()}</span>
      </div>
      <div class="card">
        <span class="card-label">کل اندراجات</span>
        <span class="card-val" style="color: #0f172a;">${summary.lotsCount || expenseRows?.length || 0}</span>
      </div>
    </div>
  `
      : previewData.reportType === 'vendor'
      ? `
    <div class="summary-cards">
      <div class="card">
        <span class="card-label">مجموعی مال فروخت (زمیندار)</span>
        <span class="card-val" style="color: #0f172a;">روپے ${summary.grossSales.toLocaleString()}</span>
      </div>
      <div class="card" style="border-color: #a7f3d0; background: #ecfdf5;">
        <span class="card-label" style="color: #065f46;">کمیشن فیس آڑھت</span>
        <span class="card-val" style="color: #065f46;">روپے ${summary.commission.toLocaleString()}</span>
      </div>
      <div class="card" style="border-color: #a7f3d0; background: #ecfdf5;">
        <span class="card-label" style="color: #065f46;">زمینداروں کو نقد ادا</span>
        <span class="card-val" style="color: #065f46;">روپے ${(summary.vendorPaid !== undefined ? summary.vendorPaid : (summary.cashReceived || 0)).toLocaleString()}</span>
      </div>
      <div class="card" style="border-color: #fecdd3; background: #fff1f2;">
        <span class="card-label" style="color: #9f1239;">واجب الادا بقایا (ادھار)</span>
        <span class="card-val" style="color: #9f1239;">روپے ${(summary.vendorPending !== undefined ? summary.vendorPending : (summary.vendorPayable || summary.creditPending || 0)).toLocaleString()}</span>
      </div>
    </div>
  `
      : `
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
