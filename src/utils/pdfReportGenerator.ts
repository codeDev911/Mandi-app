import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppSettings, VendorLot, CustomerBuyer, ShopExpense, expenseCategoryLabels } from '../types';

export interface PDFPreviewData {
  title: string;
  filename: string;
  reportType: 'date' | 'vendor' | 'customer' | 'product' | 'entire_record' | 'single_lot' | 'single_customer' | 'single_product' | 'single_vendor' | 'expenses';
  settings: AppSettings;
  dateFilterLabel?: string;
  dateRangeStr?: string;
  generatedDate?: string;
  summary?: {
    grossSales: number;
    commission: number;
    totalExpenses?: number;
    totalMazdoori?: number;
    totalMunshiana?: number;
    shopProfit?: number;
    vendorPayable?: number;
    vendorPaid?: number;
    vendorPending?: number;
    cashReceived?: number;
    creditPending?: number;
    unitsSold?: number;
    lotsCount?: number;
  };
  dateRows?: Array<{
    lotNumber: string;
    date: string;
    vendor: string;
    product: string;
    totalQty: number;
    soldQty: number;
    grossSales: number;
    commission: number;
    netPayable: number;
  }>;
  customerRows?: Array<{
    customerName: string;
    phone: string;
    purchasesCount: number;
    unitsBought: number;
    totalAmount: number;
    cashPaid: number;
    creditPending: number;
  }>;
  productRows?: Array<{
    productName: string;
    totalLots: number;
    totalUnits: number;
    soldUnits: number;
    grossTurnover: number;
    avgRate: number;
    minRate: number;
    maxRate: number;
    commission: number;
  }>;
  vendorRows?: Array<{
    vendorName: string;
    city: string;
    phone: string;
    lotsCount: number;
    totalUnits: number;
    unitsSold: number;
    grossSales: number;
    commission: number;
    netPayable: number;
    totalPaid?: number;
    pendingBalance?: number;
    paymentStatus?: 'cash' | 'credit' | 'partial' | 'paid' | 'pending';
  }>;
  expenseRows?: ShopExpense[];
  entireLots?: VendorLot[];
  singleLot?: VendorLot;
  singleCustomer?: {
    customerName: string;
    shopName?: string;
    phone?: string;
    totalPurchases: number;
    totalUnitsBought: number;
    totalAmount: number;
    cashPaid: number;
    creditPending: number;
    transactions: Array<{
      date: string;
      productUrdu: string;
      quantity: number;
      ratePerUnit: number;
      totalAmount: number;
      paymentStatus: string;
    }>;
  };
  singleProduct?: {
    productName: string;
    productUrdu: string;
    emoji: string;
    totalLots: number;
    totalUnits: number;
    totalSold: number;
    grossTurnover: number;
    avgRate: number;
    minRate: number;
    maxRate: number;
    commissionEarned: number;
    lots: VendorLot[];
  };
  singleVendor?: {
    vendorName: string;
    vendorCity?: string;
    vendorPhone?: string;
    lotsCount: number;
    totalUnits: number;
    unitsSold: number;
    grossSales: number;
    totalExpenses: number;
    commission: number;
    netPayable: number;
    totalPaid?: number;
    pendingBalance?: number;
    lots: VendorLot[];
  };
  pdfDoc?: jsPDF;
  blobUrl?: string;
}

function addPDFHeader(doc: jsPDF, settings: AppSettings, reportTitle: string, periodInfo: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 14;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  const titleText = settings.shopNameEn || 'SABZI & PHAL MANDI COMMISSION SHOP';
  doc.text(titleText, pageWidth / 2, currentY, { align: 'center' });
  currentY += 6;

  // Subtitle / Arhti Info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(80, 80, 80);
  const shopAddr = settings.shopAddressEn || '';
  const subText = `${settings.arhtiNameEn || 'Arhti Commission Agent'} | Phone: ${settings.shopPhone || ''} ${shopAddr ? `| ${shopAddr}` : ''}`;
  doc.text(subText, pageWidth / 2, currentY, { align: 'center' });
  currentY += 6;

  // Divider Line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 6;

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 80, 50);
  doc.text(reportTitle, 14, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`${periodInfo}   |   Generated on: ${new Date().toLocaleString('en-PK')}`, 14, currentY);
  currentY += 6;

  return currentY;
}

function addPDFFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Mandi Digital Munshi Pro System  •  Page ${i} of ${totalPages}  •  Verified Record`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 7,
      { align: 'center' }
    );
  }
}

function createPreviewData(
  doc: jsPDF,
  title: string,
  filename: string,
  extra: Partial<PDFPreviewData> = {}
): PDFPreviewData {
  addPDFFooter(doc);
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  return {
    title,
    filename,
    reportType: extra.reportType || 'date',
    settings: extra.settings!,
    dateFilterLabel: extra.dateFilterLabel,
    dateRangeStr: extra.dateRangeStr,
    generatedDate: new Date().toLocaleString('en-PK'),
    summary: extra.summary,
    dateRows: extra.dateRows,
    customerRows: extra.customerRows,
    productRows: extra.productRows,
    vendorRows: extra.vendorRows,
    expenseRows: extra.expenseRows,
    entireLots: extra.entireLots,
    singleLot: extra.singleLot,
    singleCustomer: extra.singleCustomer,
    singleProduct: extra.singleProduct,
    singleVendor: extra.singleVendor,
    pdfDoc: doc,
    blobUrl,
  };
}

// 1. MASTER REPORT GENERATOR (FOR TABS: DATE, CUSTOMER, PRODUCT, VENDOR)
interface GenerateReportPDFParams {
  reportType: 'customer' | 'date' | 'product' | 'vendor';
  settings: AppSettings;
  dateFilterLabel: string;
  dateRangeStr: string;
  summary: {
    grossSales: number;
    commission: number;
    totalExpenses?: number;
    vendorPayable?: number;
    vendorPaid?: number;
    vendorPending?: number;
    cashReceived?: number;
    creditPending?: number;
    unitsSold?: number;
    lotsCount?: number;
  };
  dateRows?: Array<{
    lotNumber: string;
    date: string;
    vendor: string;
    product: string;
    totalQty: number;
    soldQty: number;
    grossSales: number;
    commission: number;
    netPayable: number;
  }>;
  customerRows?: Array<{
    customerName: string;
    phone: string;
    purchasesCount: number;
    unitsBought: number;
    totalAmount: number;
    cashPaid: number;
    creditPending: number;
  }>;
  productRows?: Array<{
    productName: string;
    totalLots: number;
    totalUnits: number;
    soldUnits: number;
    grossTurnover: number;
    avgRate: number;
    minRate: number;
    maxRate: number;
    commission: number;
  }>;
  vendorRows?: Array<{
    vendorName: string;
    city: string;
    phone: string;
    lotsCount: number;
    totalUnits: number;
    unitsSold: number;
    grossSales: number;
    commission: number;
    netPayable: number;
    totalPaid?: number;
    pendingBalance?: number;
    paymentStatus?: 'cash' | 'credit' | 'partial' | 'paid' | 'pending';
  }>;
}

export function buildReportPDF({
  reportType,
  settings,
  dateFilterLabel,
  dateRangeStr,
  summary,
  dateRows = [],
  customerRows = [],
  productRows = [],
  vendorRows = [],
}: GenerateReportPDFParams): PDFPreviewData {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  let reportTitle = '';
  if (reportType === 'customer') reportTitle = 'CUSTOMER SALES & CREDIT REPORT (KHAATA / BUYERS)';
  else if (reportType === 'date') reportTitle = 'DAILY ROZNAMCHA & SALES REPORT (DATE-WISE)';
  else if (reportType === 'product') reportTitle = 'PRODUCT-WISE COMMODITY TURNOVER & RATES REPORT';
  else if (reportType === 'vendor') reportTitle = 'VENDOR & ZAMINDAR SUPPLY REPORT';

  const periodInfo = `Period / Filter: ${dateFilterLabel} (${dateRangeStr})`;
  let currentY = addPDFHeader(doc, settings, reportTitle, periodInfo);

  // Key Summary Stats Grid
  doc.setFillColor(245, 247, 245);
  doc.roundedRect(14, currentY, pageWidth - 28, 15, 2, 2, 'F');
  doc.setDrawColor(215, 225, 215);
  doc.roundedRect(14, currentY, pageWidth - 28, 15, 2, 2, 'D');

  if (reportType === 'vendor') {
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text('TOTAL GROSS SALES', 20, currentY + 4.5);
    doc.text('COMMISSION EARNED', 72, currentY + 4.5);
    doc.text('PAID TO VENDORS (CASH)', 118, currentY + 4.5);
    doc.text('PENDING TO VENDORS (CREDIT)', 158, currentY + 4.5);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(`Rs. ${summary.grossSales.toLocaleString()}`, 20, currentY + 10.5);

    doc.setTextColor(15, 120, 60);
    doc.text(`Rs. ${summary.commission.toLocaleString()}`, 72, currentY + 10.5);

    doc.setTextColor(15, 120, 50);
    const paidVal = summary.vendorPaid !== undefined ? summary.vendorPaid : (summary.cashReceived || 0);
    doc.text(`Rs. ${paidVal.toLocaleString()}`, 118, currentY + 10.5);

    doc.setTextColor(180, 40, 20);
    const pendingVal = summary.vendorPending !== undefined ? summary.vendorPending : (summary.vendorPayable || summary.creditPending || 0);
    doc.text(`Rs. ${pendingVal.toLocaleString()}`, 158, currentY + 10.5);
  } else {
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text('TOTAL GROSS SALES', 20, currentY + 4.5);
    doc.text('COMMISSION EARNED', 72, currentY + 4.5);
    doc.text('CASH COLLECTED', 124, currentY + 4.5);
    doc.text('PENDING CREDIT (UDHAAR)', 162, currentY + 4.5);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(`Rs. ${summary.grossSales.toLocaleString()}`, 20, currentY + 10.5);

    doc.setTextColor(15, 120, 60);
    doc.text(`Rs. ${summary.commission.toLocaleString()}`, 72, currentY + 10.5);

    doc.setTextColor(20, 100, 40);
    doc.text(`Rs. ${(summary.cashReceived || 0).toLocaleString()}`, 124, currentY + 10.5);

    doc.setTextColor(180, 80, 20);
    doc.text(`Rs. ${(summary.creditPending || 0).toLocaleString()}`, 162, currentY + 10.5);
  }

  currentY += 19;

  // Build Tables based on reportType
  if (reportType === 'customer') {
    const tableBody = customerRows.map((row, idx) => [
      idx + 1,
      row.customerName,
      row.phone || '-',
      row.purchasesCount,
      row.unitsBought,
      `Rs. ${row.totalAmount.toLocaleString()}`,
      `Rs. ${row.cashPaid.toLocaleString()}`,
      `Rs. ${row.creditPending.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Customer Name', 'Phone', 'Bills', 'Qty', 'Total Purchase', 'Cash Paid', 'Credit (Udhaar)']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [30, 30, 30],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { fontStyle: 'bold' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right', textColor: [20, 120, 50] },
        7: { halign: 'right', fontStyle: 'bold', textColor: [180, 40, 20] },
      },
      foot: [[
        'Total',
        `${customerRows.length} Customers`,
        '',
        customerRows.reduce((a, b) => a + b.purchasesCount, 0),
        customerRows.reduce((a, b) => a + b.unitsBought, 0),
        `Rs. ${customerRows.reduce((a, b) => a + b.totalAmount, 0).toLocaleString()}`,
        `Rs. ${customerRows.reduce((a, b) => a + b.cashPaid, 0).toLocaleString()}`,
        `Rs. ${customerRows.reduce((a, b) => a + b.creditPending, 0).toLocaleString()}`,
      ]],
      footStyles: {
        fillColor: [240, 243, 246],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
    });
  } else if (reportType === 'date') {
    const tableBody = dateRows.map((row, idx) => [
      idx + 1,
      row.date,
      row.vendor,
      row.product,
      `${row.soldQty} / ${row.totalQty}`,
      `Rs. ${row.grossSales.toLocaleString()}`,
      `Rs. ${row.commission.toLocaleString()}`,
      `Rs. ${row.netPayable.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Date', 'Vendor (Zamindar)', 'Product', 'Sold/Total', 'Gross Sale', 'Commission', 'Net to Vendor']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 80, 50],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [30, 30, 30],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right', textColor: [15, 120, 50] },
        7: { halign: 'right' },
      },
      foot: [[
        'Total',
        `${dateRows.length} Items`,
        '',
        '',
        dateRows.reduce((a, b) => a + b.soldQty, 0),
        `Rs. ${dateRows.reduce((a, b) => a + b.grossSales, 0).toLocaleString()}`,
        `Rs. ${dateRows.reduce((a, b) => a + b.commission, 0).toLocaleString()}`,
        `Rs. ${dateRows.reduce((a, b) => a + b.netPayable, 0).toLocaleString()}`,
      ]],
      footStyles: {
        fillColor: [240, 245, 240],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
    });
  } else if (reportType === 'product') {
    const tableBody = productRows.map((row, idx) => [
      idx + 1,
      row.productName,
      row.totalLots,
      `${row.soldUnits} / ${row.totalUnits}`,
      row.avgRate > 0 ? `Rs. ${row.avgRate}` : '-',
      row.minRate > 0 ? `Rs. ${row.minRate}` : '-',
      row.maxRate > 0 ? `Rs. ${row.maxRate}` : '-',
      `Rs. ${row.grossTurnover.toLocaleString()}`,
      `Rs. ${row.commission.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Commodity / Product', 'Lots', 'Sold/Total', 'Avg Rate', 'Min Rate', 'Max Rate', 'Gross Turnover', 'Commission']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [40, 60, 100],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [30, 30, 30],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'right', fontStyle: 'bold' },
        8: { halign: 'right', textColor: [15, 120, 50] },
      },
      foot: [[
        'Total',
        `${productRows.length} Items`,
        productRows.reduce((a, b) => a + b.totalLots, 0),
        productRows.reduce((a, b) => a + b.soldUnits, 0),
        '',
        '',
        '',
        `Rs. ${productRows.reduce((a, b) => a + b.grossTurnover, 0).toLocaleString()}`,
        `Rs. ${productRows.reduce((a, b) => a + b.commission, 0).toLocaleString()}`,
      ]],
      footStyles: {
        fillColor: [240, 243, 250],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
    });
  } else if (reportType === 'vendor') {
    const tableBody = vendorRows.map((row, idx) => {
      const isPaid = (row.pendingBalance !== undefined && row.pendingBalance <= 0 && row.netPayable > 0) || row.paymentStatus === 'paid' || row.paymentStatus === 'cash';
      const isPartial = (row.totalPaid && row.totalPaid > 0 && row.pendingBalance && row.pendingBalance > 0) || row.paymentStatus === 'partial';
      const statusStr = isPaid ? 'Cash (Paid)' : isPartial ? 'Partial' : 'Credit (Pending)';

      return [
        idx + 1,
        row.vendorName,
        row.city || '-',
        row.lotsCount,
        `${row.unitsSold} / ${row.totalUnits}`,
        `Rs. ${row.grossSales.toLocaleString()}`,
        `Rs. ${row.netPayable.toLocaleString()}`,
        `Rs. ${(row.totalPaid || 0).toLocaleString()}`,
        `Rs. ${(row.pendingBalance !== undefined ? row.pendingBalance : Math.max(0, row.netPayable - (row.totalPaid || 0))).toLocaleString()}`,
        statusStr,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Vendor / Zamindar', 'City', 'Lots', 'Sold/Total', 'Gross Sales', 'Net Payable', 'Cash Paid', 'Pending (Credit)', 'Status']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [70, 40, 20],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 30, 30],
      },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold', textColor: [20, 30, 70] },
        7: { halign: 'right', textColor: [15, 120, 50], fontStyle: 'bold' },
        8: { halign: 'right', textColor: [180, 40, 20], fontStyle: 'bold' },
        9: { halign: 'center', fontStyle: 'bold' },
      },
      foot: [[
        'Total',
        `${vendorRows.length} Vendors`,
        '',
        vendorRows.reduce((a, b) => a + b.lotsCount, 0),
        vendorRows.reduce((a, b) => a + b.unitsSold, 0),
        `Rs. ${vendorRows.reduce((a, b) => a + b.grossSales, 0).toLocaleString()}`,
        `Rs. ${vendorRows.reduce((a, b) => a + b.netPayable, 0).toLocaleString()}`,
        `Rs. ${vendorRows.reduce((a, b) => a + (b.totalPaid || 0), 0).toLocaleString()}`,
        `Rs. ${vendorRows.reduce((a, b) => a + (b.pendingBalance !== undefined ? b.pendingBalance : Math.max(0, b.netPayable - (b.totalPaid || 0))), 0).toLocaleString()}`,
        '',
      ]],
      footStyles: {
        fillColor: [250, 245, 240],
        textColor: [20, 20, 20],
        fontStyle: 'bold',
        fontSize: 8,
      },
    });
  }

  const filename = `mandi_report_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return createPreviewData(doc, reportTitle, filename, {
    reportType,
    settings,
    dateFilterLabel,
    dateRangeStr,
    summary,
    dateRows,
    customerRows,
    productRows,
    vendorRows,
  });
}

// 2. ENTIRE RECORD COMPREHENSIVE MASTER REPORT (ALL DETAILS IN ONE FILE)
export function buildEntireRecordReportPDF({
  lots,
  settings,
  dateFilterLabel,
  dateRangeStr,
  customers = [],
}: {
  lots: VendorLot[];
  settings: AppSettings;
  dateFilterLabel: string;
  dateRangeStr: string;
  customers?: CustomerBuyer[];
}): PDFPreviewData {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Grand summary stats for the Shop
  const totalLots = lots.length;
  const totalUnits = lots.reduce((a, b) => a + b.totalQuantity, 0);
  const totalSold = lots.reduce((a, b) => a + b.summary.totalSoldQuantity, 0);
  const grossSales = lots.reduce((a, b) => a + b.summary.grossSales, 0);
  const totalCommission = lots.reduce((a, b) => a + (b.summary.arhtiProfitCommission || 0), 0);
  const totalMazdoori = lots.reduce(
    (a, b) => a + (b.expenses?.mazdoori?.enabled ? Number(b.expenses.mazdoori.amount) || 0 : 0),
    0
  );
  const totalMunshiana = lots.reduce(
    (a, b) => a + (b.expenses?.munshiana?.enabled ? Number(b.expenses.munshiana.amount) || 0 : 0),
    0
  );
  const totalShopProfit = totalCommission + totalMunshiana;
  const netVendorPayable = lots.reduce((a, b) => a + b.summary.netPayableToVendor, 0);

  const allSales = lots.flatMap((l) => l.sales);
  const cashReceived = allSales.filter((s) => s.paymentStatus === 'cash').reduce((a, b) => a + b.totalAmount, 0);
  const creditPending = allSales.filter((s) => s.paymentStatus === 'credit').reduce((a, b) => a + b.totalAmount, 0);

  let currentY = addPDFHeader(
    doc,
    settings,
    'COMPLETE SHOP FINANCIAL AUDIT REPORT (مکمل دکان رپورٹ و حساب)',
    `Period / Scope: ${dateFilterLabel} (${dateRangeStr})`
  );

  // Financial KPI Overview - Shop Centric (No vendor product details)
  doc.setFillColor(245, 247, 245);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'F');
  doc.setDrawColor(215, 225, 215);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'D');

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('TOTAL GROSS SELL (مجموعی فروخت)', 18, currentY + 4.5);
  doc.text('LABOUR & MANSHIYANA (مزدوری و منشیانہ)', 62, currentY + 4.5);
  doc.text('SHOP PROFIT (خالص دکان منافع)', 118, currentY + 4.5);
  doc.text('CASH / UDHAAR (نقد و ادھار)', 162, currentY + 4.5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(`Rs. ${grossSales.toLocaleString()}`, 18, currentY + 11);

  doc.setTextColor(109, 40, 217);
  doc.text(`Rs. ${(totalMazdoori + totalMunshiana).toLocaleString()}`, 62, currentY + 11);

  doc.setTextColor(4, 120, 87);
  doc.text(`Rs. ${totalShopProfit.toLocaleString()}`, 118, currentY + 11);

  doc.setTextColor(180, 80, 20);
  doc.text(`${Math.round(cashReceived / 1000)}k / ${Math.round(creditPending / 1000)}k`, 162, currentY + 11);

  currentY += 21;

  // SECTION 1: MASTER SHOP FINANCIAL AUDIT LINE BY LINE (NO VENDOR PRODUCT DETAILS)
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 80, 50);
  doc.text('1. SHOP FINANCIAL REVENUE, LABOUR, MANSHIYANA & PROFIT (دکان مالیاتی حسابات و منافع)', 14, currentY);
  currentY += 3;

  // Group shop financial figures by date
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

    const row = dateMap.get(d)!;
    row.grossSales += l.summary.grossSales;
    const maz = l.expenses?.mazdoori?.enabled ? Number(l.expenses.mazdoori.amount) || 0 : 0;
    const mun = l.expenses?.munshiana?.enabled ? Number(l.expenses.munshiana.amount) || 0 : 0;
    const com = l.summary?.arhtiProfitCommission || 0;
    row.mazdoori += maz;
    row.munshiana += mun;
    row.commission += com;
    row.shopProfit += (com + mun);

    (l.sales || []).forEach((s) => {
      if (s.paymentStatus === 'cash') {
        row.cashReceived += s.totalAmount;
      } else {
        const paid = s.paidAmount || 0;
        row.cashReceived += paid;
        row.creditPending += Math.max(0, s.totalAmount - paid);
      }
    });
  });

  const shopFinancialDateRows = Array.from(dateMap.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r, idx) => [
      idx + 1,
      r.date,
      'دکان کاروباری سیل و آمدن',
      `Rs. ${r.grossSales.toLocaleString()}`,
      `Rs. ${r.mazdoori.toLocaleString()}`,
      `Rs. ${r.munshiana.toLocaleString()}`,
      `Rs. ${r.commission.toLocaleString()}`,
      `Rs. ${r.shopProfit.toLocaleString()}`,
      `Rs. ${r.cashReceived.toLocaleString()}`,
      `Rs. ${r.creditPending.toLocaleString()}`,
    ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Date', 'Shop Financial Head', 'Gross Sell', 'Labour', 'Manshiyana', 'Commission', 'Shop Profit', 'Cash Received', 'Market Udhaar']],
    body: shopFinancialDateRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 80, 50], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { halign: 'left', fontStyle: 'bold' },
      3: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 18, halign: 'right', textColor: [109, 40, 217] },
      6: { cellWidth: 18, halign: 'right', textColor: [6, 95, 70] },
      7: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
      8: { cellWidth: 22, halign: 'right', textColor: [6, 95, 70] },
      9: { cellWidth: 22, halign: 'right', textColor: [180, 40, 20] },
    },
    foot: [[
      'Total',
      `${shopFinancialDateRows.length} Days`,
      'Grand Shop Totals',
      `Rs. ${grossSales.toLocaleString()}`,
      `Rs. ${totalMazdoori.toLocaleString()}`,
      `Rs. ${totalMunshiana.toLocaleString()}`,
      `Rs. ${totalCommission.toLocaleString()}`,
      `Rs. ${totalShopProfit.toLocaleString()}`,
      `Rs. ${cashReceived.toLocaleString()}`,
      `Rs. ${creditPending.toLocaleString()}`,
    ]],
    footStyles: { fillColor: [240, 245, 240], textColor: [20, 20, 20], fontStyle: 'bold', fontSize: 7.5 },
  });

  // SECTION 2: SHOP FINANCIAL SUMMARY & POSITION STATEMENT
  doc.addPage();
  currentY = 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('2. SHOP FINANCIAL POSITION & SUMMARY STATEMENT (خلاصہ مالی گوشوارہ دکان)', 14, currentY);
  currentY += 4;

  const summaryStatementRows = [
    ['1', 'مجموعی دکان کاروبار / ٹرن اوور (Gross Sales Turnover)', `Rs. ${grossSales.toLocaleString()}`, 'دکان پر ہوئی کل نیلامی کی مالیت'],
    ['2', 'چنائی و اترائی لیبر / مزدوری فنڈ (Total Labour Handled)', `Rs. ${totalMazdoori.toLocaleString()}`, 'مزدوروں اور پلے داروں کیلئے منہا کردہ رقم'],
    ['3', 'منشیانہ فیس آمدن (Munshiana / Desk Fee Income)', `Rs. ${totalMunshiana.toLocaleString()}`, 'دکان کی خالص منشیانہ فیس'],
    ['4', 'آڑھت کمیشن آمدن (Arhti Commission Income)', `Rs. ${totalCommission.toLocaleString()}`, 'دکان کا خالص طے شدہ کمیشن'],
    ['5', 'مجموعی کاروباری آمدن (Total Gross Shop Revenue)', `Rs. ${(totalCommission + totalMunshiana).toLocaleString()}`, 'کمیشن + منشیانہ کی مجموعی رقم'],
    ['6', 'دکان پر نقد وصولی (Total Cash Collected In Hand)', `Rs. ${cashReceived.toLocaleString()}`, 'خریداروں سے نقد موصول ہوئی رقم'],
    ['7', 'مارکیٹ میں بقایا ادھار کھاتہ (Market Udhaar Outstanding)', `Rs. ${creditPending.toLocaleString()}`, 'خریداروں کی طرف بقایا رقم'],
    ['8', 'زمینداروں کی صافی واجب الادا رقم (Net Vendor Payable)', `Rs. ${netVendorPayable.toLocaleString()}`, 'تمام اخراجات منہا کرنے کے بعد کاشتکاروں کا حق'],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Financial Account Head (کھاتہ / مد)', 'Amount (روپے)', 'Description (تفصیل و وضاحتی نوٹ)']],
    body: summaryStatementRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 75, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
      3: { halign: 'right' },
    },
  });

  const filename = `mandi_entire_shop_report_${new Date().toISOString().slice(0, 10)}.pdf`;
  const totalExpenses = lots.reduce((a, b) => a + b.summary.totalExpenses, 0);
  return createPreviewData(doc, 'COMPLETE SHOP FINANCIAL RECORD (تمام دکان تفصیلات)', filename, {
    reportType: 'entire_record',
    settings,
    dateFilterLabel,
    dateRangeStr,
    entireLots: lots,
    summary: {
      grossSales,
      commission: totalCommission,
      totalExpenses,
      totalMazdoori,
      totalMunshiana,
      shopProfit: totalShopProfit,
      vendorPayable: netVendorPayable,
      cashReceived,
      creditPending,
      unitsSold: totalSold,
      lotsCount: lots.length,
    },
  });
}

// 3. INDIVIDUAL LOT REPORT PDF
export function buildSingleLotReportPDF(
  lot: VendorLot,
  settings: AppSettings,
  periodInfo?: string
): PDFPreviewData {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const subInfo = periodInfo
    ? `Arrival Date: ${lot.arrivalDate} | Vehicle: ${lot.vehicleNumber || 'N/A'} | Filter: ${periodInfo}`
    : `Arrival Date: ${lot.arrivalDate} | Vehicle: ${lot.vehicleNumber || 'N/A'}`;

  let currentY = addPDFHeader(
    doc,
    settings,
    `LOT REPORT & AUCTION SUMMARY - LOT #${lot.lotNumber}`,
    subInfo
  );

  // Lot Details Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 26, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 26, 2, 2, 'D');

  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text('VENDOR (ZAMINDAR):', 20, currentY + 6);
  doc.text('PRODUCT / COMMODITY:', 20, currentY + 13);
  doc.text('TOTAL QUANTITY:', 20, currentY + 20);

  doc.text('GROSS SALE:', 110, currentY + 6);
  doc.text('ARHTI COMMISSION:', 110, currentY + 13);
  doc.text('NET TO VENDOR:', 110, currentY + 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(`${lot.vendorName} ${lot.vendorCity ? `(${lot.vendorCity})` : ''}`, 65, currentY + 6);
  doc.text(`${lot.productUrdu || lot.productName} (${lot.unitType})`, 65, currentY + 13);
  doc.text(`${lot.totalQuantity} (Sold: ${lot.summary.totalSoldQuantity}, Left: ${lot.summary.remainingQuantity})`, 65, currentY + 20);

  doc.text(`Rs. ${lot.summary.grossSales.toLocaleString()}`, 155, currentY + 6);
  doc.setTextColor(15, 120, 50);
  doc.text(`Rs. ${lot.summary.arhtiProfitCommission.toLocaleString()}`, 155, currentY + 13);
  doc.setTextColor(20, 30, 80);
  doc.text(`Rs. ${lot.summary.netPayableToVendor.toLocaleString()}`, 155, currentY + 20);

  currentY += 32;

  // Sales / Bids Breakdown Table
  const salesRows = lot.sales.map((s, idx) => [
    idx + 1,
    s.timestamp ? s.timestamp.slice(11, 16) || s.timestamp.slice(0, 10) : '-',
    s.buyerName,
    s.quantity,
    `Rs. ${s.ratePerUnit}`,
    `Rs. ${s.totalAmount.toLocaleString()}`,
    s.paymentStatus === 'cash' ? 'CASH' : 'UDHAAR (CREDIT)',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Time', 'Buyer / Customer Name', 'Qty', 'Rate (PKR)', 'Total Amount', 'Payment Type']],
    body: salesRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 80, 50], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { halign: 'center' },
      2: { fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'center' },
    },
    foot: [[
      'Total',
      '',
      `${lot.sales.length} Bids / Sales`,
      lot.summary.totalSoldQuantity,
      '',
      `Rs. ${lot.summary.grossSales.toLocaleString()}`,
      '',
    ]],
    footStyles: { fillColor: [240, 245, 240], textColor: [20, 20, 20], fontStyle: 'bold', fontSize: 8.5 },
  });

  const filename = `lot_${lot.lotNumber}_report_${lot.arrivalDate}.pdf`;
  return createPreviewData(doc, `Lot #${lot.lotNumber} Report`, filename, {
    reportType: 'single_lot',
    settings,
    singleLot: lot,
    dateFilterLabel: periodInfo,
    summary: {
      grossSales: lot.summary.grossSales,
      commission: lot.summary.arhtiProfitCommission,
      totalExpenses: lot.summary.totalExpenses,
      vendorPayable: lot.summary.netPayableToVendor,
      unitsSold: lot.summary.totalSoldQuantity,
      lotsCount: 1,
    },
  });
}

// 4. INDIVIDUAL CUSTOMER STATEMENT PDF (RESPECTING DATE RANGE)
export function buildSingleCustomerReportPDF(
  customer: {
    customerName: string;
    phone?: string;
    shopName?: string;
    totalPurchases: number;
    totalUnitsBought: number;
    totalAmount: number;
    cashPaid: number;
    creditPending: number;
    payments?: Array<{
      date?: string;
      paymentDate?: string;
      amount: number;
      paymentMethod?: string;
      notes?: string;
    }>;
    transactions: Array<{
      date: string;
      lotId: string;
      productName: string;
      productUrdu: string;
      quantity: number;
      ratePerUnit: number;
      totalAmount: number;
      paymentStatus: string;
    }>;
  },
  settings: AppSettings,
  periodInfo?: string
): PDFPreviewData {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const subInfo = periodInfo
    ? `Customer: ${customer.customerName} | Phone: ${customer.phone || 'N/A'} | Shop: ${customer.shopName || 'N/A'} | Period: ${periodInfo}`
    : `Customer: ${customer.customerName} | Phone: ${customer.phone || 'N/A'} | Shop: ${customer.shopName || 'N/A'}`;

  let currentY = addPDFHeader(
    doc,
    settings,
    `CUSTOMER KHAATA & PURCHASES STATEMENT - ${customer.customerName.toUpperCase()}`,
    subInfo
  );

  // Customer Summary Card
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'F');
  doc.setDrawColor(210, 225, 245);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'D');

  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('TOTAL PURCHASES (کل خریداری)', 20, currentY + 4.5);
  doc.text('TOTAL UNITS BOUGHT (تعداد)', 68, currentY + 4.5);
  doc.text('CASH PAID (نقد وصول شدہ)', 115, currentY + 4.5);
  doc.text('REMAINING UDHAAR (بقایا ادھار)', 155, currentY + 4.5);

  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(`Rs. ${customer.totalAmount.toLocaleString()}`, 20, currentY + 11.5);
  doc.text(`${customer.totalUnitsBought} Units`, 68, currentY + 11.5);

  doc.setTextColor(15, 120, 50);
  doc.text(`Rs. ${customer.cashPaid.toLocaleString()}`, 115, currentY + 11.5);

  doc.setTextColor(180, 40, 20);
  doc.text(`Rs. ${customer.creditPending.toLocaleString()}`, 155, currentY + 11.5);

  currentY += 21;

  // Purchases Table (NO MISLEADING KHATA UDHAAR STATUS)
  const txRows = customer.transactions.map((tx, idx) => [
    idx + 1,
    tx.date,
    tx.productUrdu || tx.productName,
    tx.quantity,
    `Rs. ${tx.ratePerUnit}`,
    `Rs. ${tx.totalAmount.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Date', 'Product / Commodity (جنس)', 'Qty', 'Rate (PKR)', 'Total Amount (PKR)']],
    body: txRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 10, fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 3.2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26, halign: 'center' },
      2: { fontStyle: 'bold' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
    },
    foot: [[
      'Total',
      '',
      `${customer.transactions.length} Purchases`,
      customer.totalUnitsBought,
      '',
      `Rs. ${customer.totalAmount.toLocaleString()}`,
    ]],
    footStyles: { fillColor: [240, 243, 246], textColor: [20, 20, 20], fontStyle: 'bold', fontSize: 10 },
  });

  currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : currentY + 30;

  // Section 2: Payments Received & Khata Recovery Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 110, 50);
  doc.text('PAYMENTS RECEIVED & KHATA RECOVERY (وصول شدہ نقد ادائیگیاں)', 14, currentY);
  currentY += 3;

  const paymentRows = (customer.payments || []).map((p, idx) => [
    idx + 1,
    p.date || p.paymentDate || '-',
    p.paymentMethod === 'online' ? 'Online Bank' : p.paymentMethod === 'cheque' ? 'Cheque' : 'Cash (نقد)',
    p.notes || 'نقد وصولی',
    `Rs. ${p.amount.toLocaleString()}`,
  ]);

  if (paymentRows.length === 0 && customer.cashPaid > 0) {
    paymentRows.push([
      1,
      '-',
      'Cash Direct',
      'نقد وصولی بموقع خریداری',
      `Rs. ${customer.cashPaid.toLocaleString()}`,
    ]);
  }

  if (paymentRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Date', 'Payment Method', 'Notes / Description', 'Amount Received (PKR)']],
      body: paymentRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 110, 50], textColor: 255, fontSize: 9.5, fontStyle: 'bold' },
      styles: { fontSize: 9.5, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 32, halign: 'center' },
        3: { halign: 'left' },
        4: { cellWidth: 42, halign: 'right', fontStyle: 'bold', textColor: [15, 110, 50] },
      },
      foot: [[
        'Total',
        '',
        '',
        'Total Cash Received (کل نقد وصول شدہ)',
        `Rs. ${customer.cashPaid.toLocaleString()}`,
      ]],
      footStyles: { fillColor: [240, 248, 240], textColor: [15, 110, 50], fontStyle: 'bold', fontSize: 8.5 },
    });
  }

  const filename = `customer_${customer.customerName}_statement_${new Date().toISOString().slice(0, 10)}.pdf`;
  return createPreviewData(doc, `${customer.customerName} Statement`, filename, {
    reportType: 'single_customer',
    settings,
    singleCustomer: customer,
    dateFilterLabel: periodInfo,
    summary: {
      grossSales: customer.totalAmount,
      commission: 0,
      cashReceived: customer.cashPaid,
      creditPending: customer.creditPending,
      unitsSold: customer.totalUnitsBought,
      lotsCount: customer.totalPurchases,
    },
  });
}

// 5. INDIVIDUAL PRODUCT REPORT PDF (RESPECTING DATE RANGE)
export function buildSingleProductReportPDF(
  product: {
    productName: string;
    productUrdu: string;
    emoji: string;
    totalLots: number;
    totalUnits: number;
    totalSold: number;
    grossTurnover: number;
    avgRate: number;
    minRate: number;
    maxRate: number;
    commissionEarned: number;
    lots: VendorLot[];
  },
  settings: AppSettings,
  periodInfo?: string
): PDFPreviewData {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const subInfo = periodInfo
    ? `Product: ${product.productUrdu} (${product.productName}) | Period: ${periodInfo} | Total Lots: ${product.totalLots}`
    : `Product: ${product.productUrdu} (${product.productName}) | Total Lots: ${product.totalLots}`;

  let currentY = addPDFHeader(
    doc,
    settings,
    `COMMODITY TURNOVER REPORT - ${product.productUrdu || product.productName}`,
    subInfo
  );

  // Stats Card
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'F');
  doc.setDrawColor(220, 230, 245);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'D');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('TOTAL TURNOVER', 20, currentY + 4.5);
  doc.text('UNITS SOLD / TOTAL', 68, currentY + 4.5);
  doc.text('RATE (AVG / MIN / MAX)', 115, currentY + 4.5);
  doc.text('COMMISSION EARNED', 160, currentY + 4.5);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(`Rs. ${product.grossTurnover.toLocaleString()}`, 20, currentY + 11);
  doc.text(`${product.totalSold} / ${product.totalUnits}`, 68, currentY + 11);
  doc.text(`Rs. ${product.avgRate} (${product.minRate}-${product.maxRate})`, 115, currentY + 11);

  doc.setTextColor(15, 120, 50);
  doc.text(`Rs. ${product.commissionEarned.toLocaleString()}`, 160, currentY + 11);

  currentY += 21;

  // Product's Lots Breakdown
  const lotRows = product.lots.map((l, idx) => [
    idx + 1,
    l.arrivalDate,
    l.lotNumber,
    l.vendorName,
    l.vehicleNumber || '-',
    `${l.summary.totalSoldQuantity} / ${l.totalQuantity}`,
    `Rs. ${l.summary.grossSales.toLocaleString()}`,
    `Rs. ${l.summary.arhtiProfitCommission.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Date', 'Lot #', 'Vendor Name', 'Vehicle', 'Sold / Total', 'Gross Sales', 'Commission']],
    body: lotRows,
    theme: 'grid',
    headStyles: { fillColor: [40, 60, 100], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { halign: 'center' },
      2: { halign: 'center', fontStyle: 'bold' },
      3: { fontStyle: 'bold' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold' },
      7: { halign: 'right', textColor: [15, 120, 50] },
    },
    foot: [[
      'Total',
      '',
      '',
      `${product.lots.length} Lots`,
      '',
      `${product.totalSold} / ${product.totalUnits}`,
      `Rs. ${product.grossTurnover.toLocaleString()}`,
      `Rs. ${product.commissionEarned.toLocaleString()}`,
    ]],
    footStyles: { fillColor: [240, 243, 250], textColor: [20, 20, 20], fontStyle: 'bold', fontSize: 8.5 },
  });

  const filename = `product_${product.productName}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
  return createPreviewData(doc, `${product.productUrdu} Report`, filename, {
    reportType: 'single_product',
    settings,
    singleProduct: product,
    dateFilterLabel: periodInfo,
    summary: {
      grossSales: product.grossTurnover,
      commission: product.commissionEarned,
      unitsSold: product.totalSold,
      lotsCount: product.totalLots,
    },
  });
}

// 6. INDIVIDUAL VENDOR REPORT PDF (RESPECTING DATE RANGE)
export function buildSingleVendorReportPDF(
  vendor: {
    vendorName: string;
    vendorCity?: string;
    vendorPhone?: string;
    lotsCount: number;
    totalUnits: number;
    unitsSold: number;
    grossSales: number;
    totalExpenses: number;
    commission: number;
    netPayable: number;
    totalPaid?: number;
    pendingBalance?: number;
    lots: VendorLot[];
  },
  settings: AppSettings,
  periodInfo?: string
): PDFPreviewData {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const subInfo = periodInfo
    ? `Vendor: ${vendor.vendorName} | Phone: ${vendor.vendorPhone || 'N/A'} | City: ${vendor.vendorCity || 'N/A'} | Period: ${periodInfo}`
    : `Vendor: ${vendor.vendorName} | Phone: ${vendor.vendorPhone || 'N/A'} | City: ${vendor.vendorCity || 'N/A'}`;

  let currentY = addPDFHeader(
    doc,
    settings,
    `VENDOR & ZAMINDAR SUPPLY REPORT - ${vendor.vendorName.toUpperCase()}`,
    subInfo
  );

  const svPaid = vendor.totalPaid !== undefined ? vendor.totalPaid : 0;
  const svPending = vendor.pendingBalance !== undefined ? vendor.pendingBalance : Math.max(0, vendor.netPayable - svPaid);

  // Stats Card
  doc.setFillColor(252, 248, 245);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'F');
  doc.setDrawColor(245, 225, 210);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'D');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('TOTAL GROSS SALES', 20, currentY + 4.5);
  doc.text('COMMISSION & EXPENSES', 65, currentY + 4.5);
  doc.text('CASH PAID (نقد ادا)', 118, currentY + 4.5);
  doc.text('PENDING CREDIT (ادھار بقایا)', 155, currentY + 4.5);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text(`Rs. ${vendor.grossSales.toLocaleString()}`, 20, currentY + 11);

  doc.setTextColor(140, 60, 20);
  doc.text(`Rs. ${(vendor.commission + vendor.totalExpenses).toLocaleString()}`, 65, currentY + 11);

  doc.setTextColor(15, 120, 50);
  doc.text(`Rs. ${svPaid.toLocaleString()}`, 118, currentY + 11);

  if (svPending > 0) {
    doc.setTextColor(180, 40, 20);
  } else {
    doc.setTextColor(20, 40, 90);
  }
  doc.text(`Rs. ${svPending.toLocaleString()}`, 155, currentY + 11);

  currentY += 21;

  // Vendor's Lots Breakdown
  const lotRows = vendor.lots.map((l, idx) => {
    const lotNet = l.summary.netPayableToVendor;
    const lotPaid = l.vendorPaymentAmount !== undefined ? l.vendorPaymentAmount : (l.vendorPaymentStatus === 'paid' ? lotNet : 0);
    const isPaid = l.vendorPaymentStatus === 'paid' || lotPaid >= lotNet;
    const isPartial = l.vendorPaymentStatus === 'partial' || (lotPaid > 0 && lotPaid < lotNet);
    const statusStr = isPaid ? 'Cash (Paid)' : isPartial ? 'Partial' : 'Credit (Pending)';

    return [
      idx + 1,
      l.arrivalDate,
      l.lotNumber,
      `${l.productUrdu || l.productName} (${l.unitType})`,
      l.vehicleNumber || '-',
      `${l.summary.totalSoldQuantity} / ${l.totalQuantity}`,
      `Rs. ${l.summary.grossSales.toLocaleString()}`,
      `Rs. ${lotNet.toLocaleString()}`,
      statusStr,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Date', 'Lot #', 'Commodity', 'Vehicle', 'Sold / Total', 'Gross Sales', 'Net Payable', 'Status (Cash/Credit)']],
    body: lotRows,
    theme: 'grid',
    headStyles: { fillColor: [70, 40, 20], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { halign: 'center' },
      2: { halign: 'center', fontStyle: 'bold' },
      3: { fontStyle: 'bold' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold', textColor: [20, 30, 80] },
      8: { halign: 'center', fontStyle: 'bold' },
    },
    foot: [[
      'Total',
      '',
      '',
      `${vendor.lots.length} Lots`,
      '',
      `${vendor.unitsSold} / ${vendor.totalUnits}`,
      `Rs. ${vendor.grossSales.toLocaleString()}`,
      `Rs. ${vendor.netPayable.toLocaleString()}`,
      `Paid: Rs. ${svPaid.toLocaleString()} | Credit: Rs. ${svPending.toLocaleString()}`,
    ]],
    footStyles: { fillColor: [250, 245, 240], textColor: [20, 20, 20], fontStyle: 'bold', fontSize: 8.5 },
  });

  const filename = `vendor_${vendor.vendorName}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
  return createPreviewData(doc, `${vendor.vendorName} Report`, filename, {
    reportType: 'single_vendor',
    settings,
    singleVendor: vendor,
    dateFilterLabel: periodInfo,
    summary: {
      grossSales: vendor.grossSales,
      commission: vendor.commission,
      totalExpenses: vendor.totalExpenses,
      vendorPayable: vendor.netPayable,
      unitsSold: vendor.unitsSold,
      lotsCount: vendor.lotsCount,
    },
  });
}

// 7. GENERAL SHOP EXPENSES REPORT PDF
export function buildExpenseReportPDF(
  expenses: ShopExpense[],
  settings: AppSettings,
  periodInfo?: string,
  totalExpenseAmount?: number,
  cashExpenseAmount?: number,
  onlineExpenseAmount?: number
): PDFPreviewData {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const totalExp = totalExpenseAmount ?? expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalCash = cashExpenseAmount ?? expenses.filter(e => e.paymentMethod === 'cash').reduce((s, e) => s + (e.amount || 0), 0);
  const totalOnline = onlineExpenseAmount ?? (totalExp - totalCash);

  const subInfo = periodInfo
    ? `Shop Expenses Report | Period: ${periodInfo} | Total Entries: ${expenses.length}`
    : `Shop Expenses Report | Total Entries: ${expenses.length}`;

  let currentY = addPDFHeader(
    doc,
    settings,
    'SHOP GENERAL & OPERATING EXPENSES REPORT - روزنامچہ و اخراجات',
    subInfo
  );

  // Stats Card
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'F');
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'D');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('TOTAL SHOP EXPENSES', 20, currentY + 4.5);
  doc.text('ENTRIES COUNT', 68, currentY + 4.5);
  doc.text('CASH EXPENSES', 115, currentY + 4.5);
  doc.text('ONLINE / BANK PAID', 155, currentY + 4.5);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(153, 27, 27);
  doc.text(`Rs. ${totalExp.toLocaleString()}`, 20, currentY + 11);

  doc.setTextColor(30, 41, 59);
  doc.text(`${expenses.length} Records`, 68, currentY + 11);

  doc.setTextColor(22, 101, 52);
  doc.text(`Rs. ${totalCash.toLocaleString()}`, 115, currentY + 11);

  doc.setTextColor(30, 64, 175);
  doc.text(`Rs. ${totalOnline.toLocaleString()}`, 155, currentY + 11);

  currentY += 21;

  // Expenses Table
  const expenseTableRows = expenses.map((e, idx) => {
    const catLabel = expenseCategoryLabels[e.category]?.en || e.category;
    const methodStr = e.paymentMethod === 'online' ? 'Online' : e.paymentMethod === 'cheque' ? 'Cheque' : 'Cash';
    return [
      idx + 1,
      e.date,
      catLabel,
      e.title,
      e.paidTo || '-',
      methodStr,
      `Rs. ${e.amount.toLocaleString()}`,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Date', 'Category', 'Description / Title', 'Paid To / Person', 'Method', 'Amount (PKR)']],
    body: expenseTableRows,
    theme: 'grid',
    headStyles: { fillColor: [153, 27, 27], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { halign: 'center' },
      2: { fontStyle: 'bold' },
      3: { fontStyle: 'normal' },
      4: { halign: 'left' },
      5: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold', textColor: [153, 27, 27] },
    },
    foot: [[
      'Total',
      '',
      '',
      `${expenses.length} Records`,
      '',
      '',
      `Rs. ${totalExp.toLocaleString()}`,
    ]],
    footStyles: { fillColor: [254, 242, 242], textColor: [153, 27, 27], fontStyle: 'bold', fontSize: 8.5 },
  });

  const filename = `shop_expenses_${new Date().toISOString().slice(0, 10)}.pdf`;
  return createPreviewData(doc, 'Shop Expenses Report', filename, {
    reportType: 'expenses',
    settings,
    expenseRows: expenses,
    dateFilterLabel: periodInfo,
    summary: {
      grossSales: 0,
      commission: 0,
      totalExpenses: totalExp,
      cashReceived: totalCash,
      creditPending: totalOnline,
      lotsCount: expenses.length,
    },
  });
}
