import React, { useState, useMemo } from 'react';
import { VendorLot, AppSettings, CustomerBuyer, VendorPaymentStatus } from '../types';
import { translations, unitLabels, commonMandiProducts } from '../utils/localization';
import { formatPKR, parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { VendorConsolidatedBillModal } from './VendorConsolidatedBillModal';
import { ReportPDFPreviewModal } from './ReportPDFPreviewModal';
import {
  PDFPreviewData,
  buildReportPDF,
  buildEntireRecordReportPDF,
  buildSingleLotReportPDF,
  buildSingleCustomerReportPDF,
  buildSingleProductReportPDF,
  buildSingleVendorReportPDF,
} from '../utils/pdfReportGenerator';
import {
  BarChart3,
  Users,
  Calendar,
  Package,
  User,
  Download,
  Printer,
  Share2,
  Filter,
  CheckCircle,
  Clock,
  TrendingUp,
  CreditCard,
  Banknote,
  FileSpreadsheet,
  FileText,
  Search,
  Layers,
  Receipt,
  FileDown,
  Eye,
  FileCheck,
  CheckCircle2,
  Check,
  X,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

interface ReportsViewProps {
  lots: VendorLot[];
  customers: CustomerBuyer[];
  settings: AppSettings;
  onOpenReceipt?: (lotId: string) => void;
  onOpenExpenseSlip?: (lotId: string) => void;
  onToggleVendorPaymentStatus?: (lotId: string, customStatus?: 'pending' | 'paid') => void;
  onRecordVendorPayment?: (
    vendorName: string,
    payment: {
      lotId?: string;
      amount: number;
      notes?: string;
      paymentDate?: string;
      paymentMethod?: 'cash' | 'online' | 'cheque';
      status?: VendorPaymentStatus;
    }
  ) => void;
}

type ReportType = 'vendor' | 'customer' | 'date' | 'product';
type DateFilter = 'all' | 'today' | 'yesterday' | 'last7days' | 'thismonth' | 'custom';

export const ReportsView: React.FC<ReportsViewProps> = ({
  lots,
  customers,
  settings,
  onOpenReceipt,
  onOpenExpenseSlip,
  onToggleVendorPaymentStatus,
  onRecordVendorPayment,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [activeReport, setActiveReport] = useState<ReportType>('date');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customFromDate, setCustomFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customToDate, setCustomToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // State for Dedicated Vendor Payment div
  const [selectedVendorForPayment, setSelectedVendorForPayment] = useState<string | null>(null);
  const [vendorPaymentAmount, setVendorPaymentAmount] = useState<number>(0);
  const [vendorPaymentNote, setVendorPaymentNote] = useState('');
  const [vendorPaymentMethod, setVendorPaymentMethod] = useState<'cash' | 'online' | 'cheque'>('cash');
  const [vendorPaymentTargetLotId, setVendorPaymentTargetLotId] = useState<string>('all');

  // State for PDF preview modal
  const [pdfPreview, setPdfPreview] = useState<PDFPreviewData | null>(null);

  // State for Consolidated Vendor Bill (مجموعی بل - تمام اجناس ایک ساتھ)
  const [consolidatedBillVendor, setConsolidatedBillVendor] = useState<{
    vendorName: string;
    vendorPhone?: string;
    vendorCity?: string;
    lots: VendorLot[];
    dateLabel: string;
  } | null>(null);

  // Date filtering helper
  const isLotInDateRange = (lotDate: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return lotDate === todayStr;
    if (dateFilter === 'yesterday') return lotDate === yesterdayStr;
    if (dateFilter === 'last7days') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return lotDate >= sevenDaysAgo && lotDate <= todayStr;
    }
    if (dateFilter === 'thismonth') {
      const thisMonthPrefix = new Date().toISOString().slice(0, 7);
      return lotDate.startsWith(thisMonthPrefix);
    }
    if (dateFilter === 'custom') {
      return (!customFromDate || lotDate >= customFromDate) && (!customToDate || lotDate <= customToDate);
    }
    return true;
  };

  // Filtered lots based on date range
  const filteredLotsByDate = useMemo(() => {
    return lots.filter((lot) => isLotInDateRange(lot.arrivalDate));
  }, [lots, dateFilter, customFromDate, customToDate]);

  // List of unique vendors
  const allVendors = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string; city?: string }>();
    lots.forEach((l) => {
      if (!map.has(l.vendorName)) {
        map.set(l.vendorName, { name: l.vendorName, phone: l.vendorPhone, city: l.vendorCity });
      }
    });
    return Array.from(map.values());
  }, [lots]);

  // List of unique customers
  const allCustomerNames = useMemo(() => {
    const set = new Set<string>();
    lots.forEach((l) => {
      l.sales.forEach((s) => set.add(s.buyerName));
    });
    customers.forEach((c) => set.add(c.name));
    return Array.from(set);
  }, [lots, customers]);

  // List of unique products
  const allProducts = useMemo(() => {
    const map = new Map<string, { urdu: string; en: string; emoji: string }>();
    lots.forEach((l) => {
      if (!map.has(l.productName)) {
        map.set(l.productName, { urdu: l.productUrdu, en: l.productName, emoji: l.productEmoji });
      }
    });
    return Array.from(map.values());
  }, [lots]);

  // 1. CUSTOMER REPORT DATA
  const customerReports = useMemo(() => {
    const custMap = new Map<
      string,
      {
        customerName: string;
        phone?: string;
        shopName?: string;
        totalPurchases: number;
        totalUnitsBought: number;
        totalAmount: number;
        directCashPaid: number;
        khataPaid: number;
        cashPaid: number;
        creditPending: number;
        transactions: Array<{
          lotId: string;
          lotNumber: string;
          productUrdu: string;
          date: string;
          quantity: number;
          ratePerUnit: number;
          totalAmount: number;
          paymentStatus: 'cash' | 'credit' | 'partial';
        }>;
      }
    >();

    // If viewing all dates or filtering a specific customer, initialize with saved customers
    if (dateFilter === 'all' || selectedCustomerFilter !== 'all') {
      customers.forEach((c) => {
        if (selectedCustomerFilter !== 'all' && c.name.toLowerCase() !== selectedCustomerFilter.toLowerCase()) {
          return;
        }
        if (!custMap.has(c.name)) {
          custMap.set(c.name, {
            customerName: c.name,
            phone: c.phone,
            shopName: c.shopName,
            totalPurchases: 0,
            totalUnitsBought: 0,
            totalAmount: c.openingBalance || 0,
            directCashPaid: 0,
            khataPaid: 0,
            cashPaid: 0,
            creditPending: c.openingBalance || 0,
            transactions: [],
          });
        }
      });
    }

    filteredLotsByDate.forEach((lot) => {
      lot.sales.forEach((sale) => {
        if (selectedCustomerFilter !== 'all' && sale.buyerName.toLowerCase() !== selectedCustomerFilter.toLowerCase()) {
          return;
        }

        const savedCust = customers.find((c) => c.name.toLowerCase() === sale.buyerName.toLowerCase());
        const existing = custMap.get(sale.buyerName) || {
          customerName: sale.buyerName,
          phone: sale.buyerPhone || savedCust?.phone,
          shopName: savedCust?.shopName,
          totalPurchases: 0,
          totalUnitsBought: 0,
          totalAmount: dateFilter === 'all' && savedCust ? (savedCust.openingBalance || 0) : 0,
          directCashPaid: 0,
          khataPaid: 0,
          cashPaid: 0,
          creditPending: 0,
          transactions: [],
        };

        existing.totalPurchases += 1;
        existing.totalUnitsBought += sale.quantity;
        existing.totalAmount += sale.totalAmount;
        if (sale.paymentStatus === 'cash') {
          existing.directCashPaid += sale.totalAmount;
        } else if (sale.paidAmount) {
          existing.directCashPaid += sale.paidAmount;
        }

        if (!existing.phone && (sale.buyerPhone || savedCust?.phone)) {
          existing.phone = sale.buyerPhone || savedCust?.phone;
        }
        if (!existing.shopName && savedCust?.shopName) {
          existing.shopName = savedCust.shopName;
        }

        existing.transactions.push({
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          productUrdu: lot.productUrdu,
          date: lot.arrivalDate,
          quantity: sale.quantity,
          ratePerUnit: sale.ratePerUnit,
          totalAmount: sale.totalAmount,
          paymentStatus: sale.paymentStatus,
        });

        custMap.set(sale.buyerName, existing);
      });
    });

    const list = Array.from(custMap.values()).map((c) => {
      const savedCust = customers.find((sc) => sc.name.toLowerCase() === c.customerName.toLowerCase());
      const khataPayments = (savedCust?.payments || [])
        .filter((p) => dateFilter === 'all' || isLotInDateRange((p.paymentDate || p.date || '').slice(0, 10)))
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const totalPaid = c.directCashPaid + khataPayments;
      const creditRemaining = Math.max(0, c.totalAmount - totalPaid);

      return {
        ...c,
        khataPaid: khataPayments,
        cashPaid: totalPaid,
        creditPending: creditRemaining,
      };
    });

    return list.filter((c) =>
      c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.shopName && c.shopName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [filteredLotsByDate, selectedCustomerFilter, customers, searchTerm, dateFilter, customFromDate, customToDate]);

  // 2. DATE REPORT STATS
  const dateReportStats = useMemo(() => {
    let grossSales = 0;
    let commission = 0;
    let totalExpenses = 0;
    let vendorPayable = 0;
    let vendorPaid = 0;
    let unitsSold = 0;
    let directCashReceived = 0;

    filteredLotsByDate.forEach((lot) => {
      grossSales += lot.summary.grossSales;
      commission += lot.summary.arhtiProfitCommission;
      totalExpenses += lot.summary.totalExpenses;
      vendorPayable += lot.summary.netPayableToVendor;

      const lotPaid =
        lot.vendorPaymentAmount !== undefined
          ? lot.vendorPaymentAmount
          : lot.vendorPaymentStatus === 'paid'
          ? lot.summary.netPayableToVendor
          : 0;
      vendorPaid += lotPaid;

      unitsSold += lot.summary.totalSoldQuantity;

      lot.sales.forEach((s) => {
        if (s.paymentStatus === 'cash') {
          directCashReceived += s.totalAmount;
        } else if (s.paidAmount) {
          directCashReceived += s.paidAmount;
        }
      });
    });

    const totalKhataPaid = customerReports.reduce((sum, c) => sum + c.khataPaid, 0);
    const totalCreditPending = customerReports.reduce((sum, c) => sum + c.creditPending, 0);
    const cashReceived = directCashReceived + totalKhataPaid;
    const vendorPending = Math.max(0, vendorPayable - vendorPaid);

    return {
      lotsCount: filteredLotsByDate.length,
      grossSales,
      commission,
      totalExpenses,
      vendorPayable,
      vendorPaid,
      vendorPending,
      unitsSold,
      cashReceived,
      creditPending: totalCreditPending,
    };
  }, [filteredLotsByDate, customerReports]);

  // 2. VENDOR REPORT DATA
  const vendorReports = useMemo(() => {
    const vendorMap = new Map<
      string,
      {
        vendorName: string;
        vendorPhone?: string;
        vendorCity?: string;
        lotsCount: number;
        totalUnits: number;
        unitsSold: number;
        grossSales: number;
        totalExpenses: number;
        commission: number;
        netPayable: number;
        totalPaid: number;
        pendingBalance: number;
        lots: VendorLot[];
      }
    >();

    filteredLotsByDate.forEach((lot) => {
      if (selectedVendorFilter !== 'all' && lot.vendorName !== selectedVendorFilter) {
        return;
      }

      const existing = vendorMap.get(lot.vendorName) || {
        vendorName: lot.vendorName,
        vendorPhone: lot.vendorPhone,
        vendorCity: lot.vendorCity,
        lotsCount: 0,
        totalUnits: 0,
        unitsSold: 0,
        grossSales: 0,
        totalExpenses: 0,
        commission: 0,
        netPayable: 0,
        totalPaid: 0,
        pendingBalance: 0,
        lots: [],
      };

      const lotPaid =
        lot.vendorPaymentAmount !== undefined
          ? lot.vendorPaymentAmount
          : lot.vendorPaymentStatus === 'paid'
          ? lot.summary.netPayableToVendor
          : 0;

      existing.lotsCount += 1;
      existing.totalUnits += lot.totalQuantity;
      existing.unitsSold += lot.summary.totalSoldQuantity;
      existing.grossSales += lot.summary.grossSales;
      existing.totalExpenses += lot.summary.totalExpenses;
      existing.commission += lot.summary.arhtiProfitCommission;
      existing.netPayable += lot.summary.netPayableToVendor;
      existing.totalPaid += lotPaid;
      existing.pendingBalance = Math.max(0, existing.netPayable - existing.totalPaid);
      existing.lots.push(lot);

      vendorMap.set(lot.vendorName, existing);
    });

    return Array.from(vendorMap.values()).filter((v) =>
      v.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.vendorCity && v.vendorCity.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [filteredLotsByDate, selectedVendorFilter, searchTerm]);

  // 3. PRODUCT REPORT DATA
  const productReports = useMemo(() => {
    const prodMap = new Map<
      string,
      {
        productName: string;
        productUrdu: string;
        emoji: string;
        totalLots: number;
        totalUnits: number;
        totalSold: number;
        grossTurnover: number;
        commissionEarned: number;
        minRate: number;
        maxRate: number;
        rates: number[];
      }
    >();

    filteredLotsByDate.forEach((lot) => {
      if (selectedProductFilter !== 'all' && lot.productName !== selectedProductFilter) {
        return;
      }

      const existing = prodMap.get(lot.productName) || {
        productName: lot.productName,
        productUrdu: lot.productUrdu,
        emoji: lot.productEmoji,
        totalLots: 0,
        totalUnits: 0,
        totalSold: 0,
        grossTurnover: 0,
        commissionEarned: 0,
        minRate: Infinity,
        maxRate: 0,
        rates: [],
      };

      existing.totalLots += 1;
      existing.totalUnits += lot.totalQuantity;
      existing.totalSold += lot.summary.totalSoldQuantity;
      existing.grossTurnover += lot.summary.grossSales;
      existing.commissionEarned += lot.summary.arhtiProfitCommission;

      lot.sales.forEach((s) => {
        if (s.ratePerUnit > 0) {
          existing.rates.push(s.ratePerUnit);
          if (s.ratePerUnit < existing.minRate) existing.minRate = s.ratePerUnit;
          if (s.ratePerUnit > existing.maxRate) existing.maxRate = s.ratePerUnit;
        }
      });

      prodMap.set(lot.productName, existing);
    });

    return Array.from(prodMap.values()).map((p) => {
      const avgRate = p.rates.length > 0 ? Math.round(p.rates.reduce((a, b) => a + b, 0) / p.rates.length) : 0;
      return {
        ...p,
        minRate: p.minRate === Infinity ? 0 : p.minRate,
        avgRate,
      };
    }).filter((p) =>
      p.productUrdu.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredLotsByDate, selectedProductFilter, searchTerm]);

  // Get current date range string representation
  const getDateRangeDetails = () => {
    const dateFilterLabels: Record<DateFilter, string> = {
      all: isUrdu ? 'تمام تاریخیں' : 'All Time',
      today: isUrdu ? 'آج کی تاریخ' : "Today's Date",
      yesterday: isUrdu ? 'گزشتہ کل' : 'Yesterday',
      last7days: isUrdu ? 'گزشتہ 7 دن' : 'Last 7 Days',
      thismonth: isUrdu ? 'موجودہ مہینہ' : 'This Month',
      custom: `${customFromDate || 'From'} تا ${customToDate || 'To'}`,
    };

    let dateRangeStr = '';
    const now = new Date();
    if (dateFilter === 'custom') {
      dateRangeStr = `${customFromDate || 'Start'} to ${customToDate || 'End'}`;
    } else if (dateFilter === 'today') {
      dateRangeStr = now.toISOString().slice(0, 10);
    } else if (dateFilter === 'yesterday') {
      dateRangeStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    } else if (dateFilter === 'last7days') {
      const past7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      dateRangeStr = `${past7} to ${now.toISOString().slice(0, 10)}`;
    } else if (dateFilter === 'thismonth') {
      dateRangeStr = `${now.toISOString().slice(0, 7)} (Monthly)`;
    } else {
      dateRangeStr = isUrdu ? 'تمام دستیاب تاریخیں' : 'All Available Dates';
    }

    return {
      label: dateFilterLabels[dateFilter],
      rangeStr: dateRangeStr,
    };
  };

  // Preview PDF for Current Tab Report (Filtered by Selected Date Range)
  const handlePreviewPDF = () => {
    sound.playTick();

    const { label: dateFilterLabel, rangeStr: dateRangeStr } = getDateRangeDetails();

    let previewData: PDFPreviewData;

    if (activeReport === 'customer') {
      const customerRows = customerReports.map((c) => ({
        customerName: c.customerName,
        phone: c.phone || '',
        purchasesCount: c.totalPurchases,
        unitsBought: c.totalUnitsBought,
        totalAmount: c.totalAmount,
        cashPaid: c.cashPaid,
        creditPending: c.creditPending,
      }));

      previewData = buildReportPDF({
        reportType: 'customer',
        settings,
        dateFilterLabel,
        dateRangeStr,
        summary: {
          grossSales: customerReports.reduce((a, b) => a + b.totalAmount, 0),
          commission: dateReportStats.commission,
          cashReceived: customerReports.reduce((a, b) => a + b.cashPaid, 0),
          creditPending: customerReports.reduce((a, b) => a + b.creditPending, 0),
          unitsSold: customerReports.reduce((a, b) => a + b.totalUnitsBought, 0),
          vendorPayable: dateReportStats.vendorPending,
        },
        customerRows,
      });
    } else if (activeReport === 'product') {
      const productRows = productReports.map((p) => ({
        productName: p.productUrdu || p.productName,
        totalLots: p.totalLots,
        totalUnits: p.totalUnits,
        soldUnits: p.totalSold,
        grossTurnover: p.grossTurnover,
        avgRate: p.avgRate,
        minRate: p.minRate,
        maxRate: p.maxRate,
        commission: p.commissionEarned,
      }));

      previewData = buildReportPDF({
        reportType: 'product',
        settings,
        dateFilterLabel,
        dateRangeStr,
        summary: {
          grossSales: productReports.reduce((a, b) => a + b.grossTurnover, 0),
          commission: productReports.reduce((a, b) => a + b.commissionEarned, 0),
          cashReceived: dateReportStats.cashReceived,
          creditPending: dateReportStats.creditPending,
          unitsSold: productReports.reduce((a, b) => a + b.totalSold, 0),
          vendorPayable: dateReportStats.vendorPending,
        },
        productRows,
      });
    } else if (activeReport === 'vendor') {
      const vendorRows = vendorReports.map((v) => ({
        vendorName: v.vendorName,
        city: v.vendorCity || '',
        phone: v.vendorPhone || '',
        lotsCount: v.lotsCount,
        totalUnits: v.totalUnits,
        unitsSold: v.unitsSold,
        grossSales: v.grossSales,
        commission: v.commission,
        netPayable: v.netPayable,
      }));

      previewData = buildReportPDF({
        reportType: 'vendor',
        settings,
        dateFilterLabel,
        dateRangeStr,
        summary: {
          grossSales: vendorReports.reduce((a, b) => a + b.grossSales, 0),
          commission: vendorReports.reduce((a, b) => a + b.commission, 0),
          cashReceived: dateReportStats.cashReceived,
          creditPending: dateReportStats.creditPending,
          unitsSold: vendorReports.reduce((a, b) => a + b.unitsSold, 0),
          lotsCount: vendorReports.reduce((a, b) => a + b.lotsCount, 0),
          vendorPayable: dateReportStats.vendorPending,
        },
        vendorRows,
      });
    } else {
      // Date report
      const dateRows = filteredLotsByDate.map((l) => ({
        lotNumber: l.lotNumber,
        date: l.arrivalDate,
        vendor: l.vendorName,
        product: l.productUrdu,
        totalQty: l.totalQuantity,
        soldQty: l.summary.totalSoldQuantity,
        grossSales: l.summary.grossSales,
        commission: l.summary.arhtiProfitCommission,
        netPayable: l.summary.netPayableToVendor,
      }));

      previewData = buildReportPDF({
        reportType: 'date',
        settings,
        dateFilterLabel,
        dateRangeStr,
        summary: {
          grossSales: dateReportStats.grossSales,
          commission: dateReportStats.commission,
          cashReceived: dateReportStats.cashReceived,
          creditPending: dateReportStats.creditPending,
          unitsSold: dateReportStats.unitsSold,
          lotsCount: dateReportStats.lotsCount,
          vendorPayable: dateReportStats.vendorPending,
        },
        dateRows,
      });
    }

    setPdfPreview(previewData);
  };

  // Preview Complete Entire Record Master Report (All Details in One File)
  const handlePreviewEntireRecordPDF = () => {
    sound.playCashChime();

    const { label: dateFilterLabel, rangeStr: dateRangeStr } = getDateRangeDetails();

    const previewData = buildEntireRecordReportPDF({
      lots: filteredLotsByDate,
      settings,
      dateFilterLabel: `${dateFilterLabel} (تمام تفصیلات)`,
      dateRangeStr,
      customers,
    });

    setPdfPreview(previewData);
  };

  // Export CSV function
  const handleExportCSV = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    let csvContent = '\uFEFF'; // Add UTF-8 BOM for Urdu support in Excel

    if (activeReport === 'vendor') {
      csvContent += 'Vendor Name,City,Phone,Lots,Total Qty,Sold Qty,Gross Sales,Total Expenses,Commission,Net Payable,Pending Balance\n';
      vendorReports.forEach((v) => {
        csvContent += `"${v.vendorName}","${v.vendorCity || ''}","${v.vendorPhone || ''}",${v.lotsCount},${v.totalUnits},${v.unitsSold},${v.grossSales},${v.totalExpenses},${v.commission},${v.netPayable},${v.pendingBalance}\n`;
      });
    } else if (activeReport === 'customer') {
      csvContent += 'Customer Name,Phone,Purchases Count,Units Bought,Total Amount,Cash Paid,Credit Pending\n';
      customerReports.forEach((c) => {
        csvContent += `"${c.customerName}","${c.phone || ''}",${c.totalPurchases},${c.totalUnitsBought},${c.totalAmount},${c.cashPaid},${c.creditPending}\n`;
      });
    } else if (activeReport === 'product') {
      csvContent += 'Product,Total Lots,Total Units,Sold Units,Gross Turnover,Avg Rate,Min Rate,Max Rate,Commission\n';
      productReports.forEach((p) => {
        csvContent += `"${p.productUrdu}",${p.totalLots},${p.totalUnits},${p.totalSold},${p.grossTurnover},${p.avgRate},${p.minRate},${p.maxRate},${p.commissionEarned}\n`;
      });
    } else {
      csvContent += 'Lot #,Date,Vendor,Product,Total Qty,Sold Qty,Gross Sales,Expenses,Commission,Net Payable\n';
      filteredLotsByDate.forEach((l) => {
        csvContent += `"${l.lotNumber}","${l.arrivalDate}","${l.vendorName}","${l.productUrdu}",${l.totalQuantity},${l.summary.totalSoldQuantity},${l.summary.grossSales},${l.summary.totalExpenses},${l.summary.arhtiProfitCommission},${l.summary.netPayableToVendor}\n`;
      });
    }

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = `mandi_report_${activeReport}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.target = '_self';
      link.rel = 'noopener noreferrer';
      link.onclick = (ev) => ev.stopPropagation();
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          if (link.parentNode) link.parentNode.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }, 2000);
    } catch (err) {
      console.error('CSV export error:', err);
    }
  };

  // WhatsApp Share function
  const handleShareWhatsApp = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playCashChime();
    let text = `*📊 ${settings.shopNameUrdu}*\n`;
    text += `*${t.reportsTitle} (${dateFilter.toUpperCase()})*\n`;
    text += `📅 تاریخ: ${new Date().toLocaleDateString('en-PK')}\n`;
    text += `--------------------------\n`;
    text += `💰 *کل فروخت:* ${formatPKR(dateReportStats.grossSales, settings.currencySymbol, settings.language)}\n`;
    text += `💎 *خالص کمیشن منافع:* ${formatPKR(dateReportStats.commission, settings.currencySymbol, settings.language)}\n`;
    text += `📦 *کل مال فروخت:* ${dateReportStats.unitsSold} تعداد\n`;
    text += `💵 *نقد وصولی:* ${formatPKR(dateReportStats.cashReceived, settings.currencySymbol, settings.language)}\n`;
    text += `⏳ *بقایا کھاتہ ادھار:* ${formatPKR(dateReportStats.creditPending, settings.currencySymbol, settings.language)}\n`;
    text += `🤝 *زمینداروں کا واجب الادا:* ${formatPKR(dateReportStats.vendorPending, settings.currencySymbol, settings.language)}\n`;
    text += `--------------------------\n`;
    text += `👤 *آڑھتی:* ${settings.arhtiNameUrdu}\n`;
    text += `📞 *رابطہ:* ${settings.shopPhone}`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Handlers for Dedicated Vendor Payment Form
  const handleOpenVendorPayment = (vendorName: string, defaultAmount: number, targetLotId: string = 'all') => {
    sound.playTick();
    if (selectedVendorForPayment === vendorName && vendorPaymentTargetLotId === targetLotId) {
      setSelectedVendorForPayment(null);
    } else {
      setSelectedVendorForPayment(vendorName);
      setVendorPaymentAmount(defaultAmount > 0 ? defaultAmount : 0);
      setVendorPaymentNote('');
      setVendorPaymentMethod('cash');
      setVendorPaymentTargetLotId(targetLotId);
    }
  };

  const handleSaveVendorPayment = (vendorName: string) => {
    if (vendorPaymentAmount <= 0) return;
    if (onRecordVendorPayment) {
      onRecordVendorPayment(vendorName, {
        lotId: vendorPaymentTargetLotId === 'all' ? undefined : vendorPaymentTargetLotId,
        amount: vendorPaymentAmount,
        notes: vendorPaymentNote.trim() || undefined,
        paymentMethod: vendorPaymentMethod,
      });
    }
    sound.playCashChime();
    setSelectedVendorForPayment(null);
  };

  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    sound.playTick();
    window.print();
  };

  return (
    <div className="space-y-4 pb-16 sm:pb-6">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-xl shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-urdu-nastaliq">
              {t.reportsTitle}
            </h2>
            <p className="text-xs text-slate-500 font-urdu-sans">
              {t.reportsSubtitle}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Entire Record Master PDF Button (All Records in One File with Details) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePreviewEntireRecordPDF();
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans shadow-md border border-emerald-600/30"
            title="تمام ریکارڈز اور تفصیلی بولیوں کی مکمل مشترکہ پی ڈی ایف رپورٹ دیکھیں یا ڈاؤن لوڈ کریں"
          >
            <FileCheck className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span>{isUrdu ? '📑 مکمل ریکارڈ رپورٹ (تمام تفصیلات)' : '📑 Entire Record Report (All Details)'}</span>
          </button>

          {/* Current Tab Dynamic PDF Report Preview Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePreviewPDF();
            }}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans shadow-md border border-rose-500"
            title={`منتخب تاریخ برائے ${activeReport} رپورٹ دیکھیں`}
          >
            <Eye className="w-4 h-4" />
            <span>
              {activeReport === 'customer'
                ? isUrdu ? `👥 گاہک رپورٹ (${getDateRangeDetails().label})` : `👥 Customer Report (${getDateRangeDetails().label})`
                : activeReport === 'product'
                ? isUrdu ? `📦 جنس رپورٹ (${getDateRangeDetails().label})` : `📦 Product Report (${getDateRangeDetails().label})`
                : activeReport === 'vendor'
                ? isUrdu ? `🚜 زمیندار رپورٹ (${getDateRangeDetails().label})` : `🚜 Vendor Report (${getDateRangeDetails().label})`
                : isUrdu ? `📅 روزنامچہ رپورٹ (${getDateRangeDetails().label})` : `📅 Daily Report (${getDateRangeDetails().label})`}
            </span>
          </button>

          <button
            type="button"
            onClick={(e) => handleExportCSV(e)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans active:scale-95 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.exportCSV}</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleShareWhatsApp(e)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans active:scale-95 shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t.shareReportWA}</span>
          </button>
          <button
            type="button"
            onClick={(e) => handlePrint(e)}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 font-urdu-sans active:scale-95 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.printReport}</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards at the Top */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Gross Total */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold font-urdu-sans block">{t.grossTotal}</span>
          <span className="text-base sm:text-lg font-black text-slate-900 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.grossSales, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-slate-400 font-urdu-sans">
            {dateReportStats.lotsCount} {t.totalLotsCount} ({getDateRangeDetails().label})
          </span>
        </div>

        {/* 2. Arhti Commission */}
        <div className="bg-emerald-50 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[11px] text-emerald-800 font-bold font-urdu-sans block">{t.netArhtiCommission}</span>
          <span className="text-base sm:text-lg font-black text-emerald-950 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.commission, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-emerald-700 font-urdu-sans">
            {isUrdu ? 'آڑھت خالص منافع' : 'Arhti Net Profit'}
          </span>
        </div>

        {/* 3. Payable to Vendors (زمیندار واجب الادا) */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] text-slate-300 font-bold font-urdu-sans block">
              {isUrdu ? 'زمیندار واجب الادا' : 'Payable to Vendors'}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold font-urdu-sans ${
                dateReportStats.vendorPending > 0
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {dateReportStats.vendorPending > 0 ? (isUrdu ? 'بقایا' : 'Pending') : (isUrdu ? 'مکمل ادا' : 'Paid')}
            </span>
          </div>
          <span className="text-base sm:text-lg font-black text-white font-numbers block mt-0.5">
            {formatPKR(dateReportStats.vendorPending, settings.currencySymbol, settings.language)}
          </span>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-urdu-sans mt-0.5">
            <span>{isUrdu ? 'میزان:' : 'Net:'} {formatPKR(dateReportStats.vendorPayable, settings.currencySymbol, settings.language)}</span>
            <span>{isUrdu ? 'ادا:' : 'Paid:'} {formatPKR(dateReportStats.vendorPaid, settings.currencySymbol, settings.language)}</span>
          </div>
        </div>

        {/* 4. Cash Received */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold font-urdu-sans block">{t.cashCollected} (نقد)</span>
          <span className="text-base sm:text-lg font-black text-emerald-700 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.cashReceived, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-slate-400 font-urdu-sans">
            {dateReportStats.unitsSold} {t.totalUnitsSold}
          </span>
        </div>

        {/* 5. Customer Credit Outstanding */}
        <div className="bg-amber-50 p-3.5 sm:p-4 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[11px] text-amber-900 font-bold font-urdu-sans block">{t.creditOutstanding} (ادھار)</span>
          <span className="text-base sm:text-lg font-black text-amber-800 font-numbers block mt-0.5">
            {formatPKR(dateReportStats.creditPending, settings.currencySymbol, settings.language)}
          </span>
          <span className="text-[10px] text-amber-700 font-urdu-sans">
            {isUrdu ? 'خریداروں کا بقایا کھاتہ' : 'Pending from buyers'}
          </span>
        </div>
      </div>

      {/* Date Filter & Report Category Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Main Category Tabs */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar border-b border-slate-100 pb-3">
          {[
            { id: 'date' as ReportType, label: t.reportByDate, icon: Calendar },
            { id: 'vendor' as ReportType, label: t.reportByVendor, icon: User },
            { id: 'customer' as ReportType, label: t.reportByCustomer, icon: Users },
            { id: 'product' as ReportType, label: t.reportByProduct, icon: Package },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sound.playTick();
                  setActiveReport(tab.id);
                  setSearchTerm('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition whitespace-nowrap active:scale-95 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="font-urdu-sans">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Date Range Chips */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-bold font-urdu-sans mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.dateRange}:</span>
            </span>
            {[
              { id: 'all' as DateFilter, label: t.allTime },
              { id: 'today' as DateFilter, label: t.today },
              { id: 'yesterday' as DateFilter, label: t.yesterday },
              { id: 'last7days' as DateFilter, label: t.last7Days },
              { id: 'thismonth' as DateFilter, label: t.thisMonth },
              { id: 'custom' as DateFilter, label: t.customRange },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  sound.playTick();
                  setDateFilter(f.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-urdu-sans transition flex-shrink-0 ${
                  dateFilter === f.id
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isUrdu ? 'تلاش کریں (نام، شہر، جنس)...' : 'Search name, city, product...'}
              className="w-full pl-9 pr-3 rtl:pr-9 rtl:pl-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 rtl:right-3 rtl:left-auto top-2.5" />
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'custom' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 flex-wrap animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-urdu-sans">
              <span className="font-bold text-slate-700">{t.fromDate}:</span>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-numbers"
              />
            </div>
            <div className="flex items-center gap-2 text-xs font-urdu-sans">
              <span className="font-bold text-slate-700">{t.toDate}:</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-numbers"
              />
            </div>
          </div>
        )}
      </div>

      {/* REPORT CONTENT PER ACTIVE TAB */}

      {/* 1. DATE REPORT: LOT-BY-LOT DAILY STATEMENT */}
      {activeReport === 'date' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                <span>{t.dailySummary} ({filteredLotsByDate.length} {isUrdu ? 'لاٹس' : 'Lots'})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold font-urdu-sans">
                {getDateRangeDetails().label}
              </span>
            </div>

            <button
              onClick={handlePreviewPDF}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs active:scale-95"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isUrdu ? `روزنامچہ پی ڈی ایف (${getDateRangeDetails().label})` : `Roznamcha PDF (${getDateRangeDetails().label})`}</span>
            </button>
          </div>

          {filteredLotsByDate.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {t.noReportsFound}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLotsByDate.map((lot) => {
                return (
                  <div
                    key={lot.id}
                    className="p-3 sm:p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xl flex items-center justify-center flex-shrink-0">
                        {lot.productEmoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-nastaliq truncate">
                            {lot.vendorName}
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {lot.lotNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-numbers">
                            {lot.arrivalDate}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                          {lot.productUrdu} • {lot.totalQuantity} {unitLabels[lot.unitType][settings.language]} (
                          <strong className="text-blue-700">{lot.summary.totalSoldQuantity} فروخت</strong>,{' '}
                          <strong className="text-amber-700">{lot.summary.remainingQuantity} باقی</strong>)
                        </p>
                      </div>
                    </div>

                    {/* Financial Figures & Direct Buttons */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-start sm:text-end">
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-numbers block">
                          {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                        </span>
                        <span className="text-[11px] text-emerald-800 font-numbers font-semibold block">
                          کمیشن: {formatPKR(lot.summary.arhtiProfitCommission, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Preview & Download PDF button for this specific lot report by date */}
                        <button
                          onClick={() => {
                            sound.playTick();
                            const preview = buildSingleLotReportPDF(lot, settings, getDateRangeDetails().label);
                            setPdfPreview(preview);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs"
                          title="اس لاٹ کی پی ڈی ایف رپورٹ دیکھیں یا ڈاؤن لوڈ کریں"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>پی ڈی ایف</span>
                        </button>

                        {onOpenExpenseSlip && (
                          <button
                            onClick={() => onOpenExpenseSlip(lot.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold font-urdu-sans transition"
                          >
                            {t.tabExpenses}
                          </button>
                        )}
                        {onOpenReceipt && (
                          <button
                            onClick={() => onOpenReceipt(lot.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold font-urdu-sans transition"
                          >
                            {t.tabReceipt}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. VENDOR REPORT: SUMMARY PER VENDOR */}
      {activeReport === 'vendor' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <User className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                <span>{t.reportByVendor} ({vendorReports.length} {isUrdu ? 'زمیندار' : 'Vendors'})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold font-urdu-sans">
                {getDateRangeDetails().label}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Vendor Selector Filter */}
              <select
                value={selectedVendorFilter}
                onChange={(e) => setSelectedVendorFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">{isUrdu ? 'تمام زمیندار (All Vendors)' : 'All Vendors'}</option>
                {allVendors.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} {v.city ? `(${v.city})` : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePreviewPDF}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isUrdu ? `زمیندار رپورٹ پی ڈی ایف (${getDateRangeDetails().label})` : `Vendor PDF (${getDateRangeDetails().label})`}</span>
              </button>
            </div>
          </div>

          {vendorReports.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {t.noReportsFound}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {vendorReports.map((v) => (
                <div key={v.vendorName} className="p-3.5 sm:p-4 hover:bg-slate-50 transition space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq">
                          {v.vendorName}
                        </h4>
                        {v.vendorCity && (
                          <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-urdu-sans">
                            {v.vendorCity}
                          </span>
                        )}
                        {v.vendorPhone && (
                          <span className="text-[11px] text-slate-500 font-numbers">
                            📞 {v.vendorPhone}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                        {v.lotsCount} {t.totalLotsCount} • {v.totalUnits} کل یونٹس ({v.unitsSold} فروخت شدہ)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      {/* Gross Sales */}
                      <div className="text-start sm:text-end">
                        <span className="text-[10px] text-slate-500 font-urdu-sans block">{t.grossTotal}:</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-numbers block">
                          {formatPKR(v.grossSales, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      {/* Net Payable */}
                      <div className="text-start sm:text-end bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-700 font-bold font-urdu-sans block">{t.netVendorPayable}:</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-950 font-numbers block">
                          {formatPKR(v.netPayable, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      {/* Paid Amount */}
                      <div className="text-start sm:text-end bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 font-bold font-urdu-sans flex items-center gap-1 justify-end">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>{isUrdu ? 'ادا شدہ:' : 'Paid:'}</span>
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-950 font-numbers block">
                          {formatPKR(v.totalPaid, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      {/* Pending Balance */}
                      <div className={`text-start sm:text-end px-2.5 py-1 rounded-xl border ${
                        v.pendingBalance > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <span className={`text-[10px] font-bold font-urdu-sans flex items-center gap-1 justify-end ${
                          v.pendingBalance > 0 ? 'text-amber-800' : 'text-slate-500'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          <span>{isUrdu ? 'بقایا واجب الادا:' : 'Pending:'}</span>
                        </span>
                        <span className={`text-xs sm:text-sm font-bold font-numbers block ${
                          v.pendingBalance > 0 ? 'text-amber-950' : 'text-slate-500'
                        }`}>
                          {formatPKR(v.pendingBalance, settings.currencySymbol, settings.language)}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                        {/* Dedicated Payment Button */}
                        <button
                          onClick={() => handleOpenVendorPayment(v.vendorName, v.pendingBalance > 0 ? v.pendingBalance : v.netPayable)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                            selectedVendorForPayment === v.vendorName
                              ? 'bg-slate-800 text-white'
                              : v.pendingBalance > 0
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                          }`}
                          title="زمیندار کو رقم ادائیگی کا اندراج کریں"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>{selectedVendorForPayment === v.vendorName ? (isUrdu ? 'بند کریں' : 'Close') : (isUrdu ? 'ادائیگی درج کریں' : 'Pay Vendor')}</span>
                        </button>

                        <button
                          onClick={() => {
                            sound.playTick();
                            const preview = buildSingleVendorReportPDF(v, settings, getDateRangeDetails().label);
                            setPdfPreview(preview);
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs"
                          title="اس زمیندار کی سپلائی رپورٹ پی ڈی ایف دیکھیں"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>پی ڈی ایف</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* DEDICATED PAYMENT RECEIVE / PAYOUT FORM FOR VENDOR */}
                  {selectedVendorForPayment === v.vendorName && (
                    <div className="bg-emerald-50/90 p-3.5 sm:p-4 rounded-2xl border-2 border-emerald-300 space-y-3 animate-in fade-in duration-150 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 font-urdu-sans">
                          <Banknote className="w-4 h-4 text-emerald-700" />
                          <span>{isUrdu ? `زمیندار (${v.vendorName}) کو رقم ادائیگی کا اندراج:` : `Record Payment to ${v.vendorName}:`}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-urdu-sans flex-wrap">
                          <span className="text-slate-600">
                            {isUrdu ? 'کل واجب الادا:' : 'Net Payable:'}{' '}
                            <strong className="text-slate-900 font-numbers">{formatPKR(v.netPayable, settings.currencySymbol, settings.language)}</strong>
                          </span>
                          <span className="text-emerald-800">
                            {isUrdu ? 'ادا شدہ:' : 'Paid:'}{' '}
                            <strong className="text-emerald-700 font-numbers">{formatPKR(v.totalPaid, settings.currencySymbol, settings.language)}</strong>
                          </span>
                          <span className="text-amber-800 font-bold">
                            {isUrdu ? 'موجودہ بقایا:' : 'Pending:'}{' '}
                            <strong className="text-amber-900 font-numbers">{formatPKR(v.pendingBalance, settings.currencySymbol, settings.language)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        {/* Amount Input */}
                        <div className="sm:col-span-3">
                          <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                            {isUrdu ? 'ادائیگی رقم (روپے):' : 'Amount Paid (Rs.):'}
                          </label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={vendorPaymentAmount || ''}
                            onChange={(e) => setVendorPaymentAmount(parseNumber(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-numbers font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                            autoFocus
                          />
                        </div>

                        {/* Description / Notes */}
                        <div className="sm:col-span-4">
                          <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                            {isUrdu ? 'تفصیل و نوٹس (نوٹ / حوالہ):' : 'Description / Notes:'}
                          </label>
                          <input
                            type="text"
                            value={vendorPaymentNote}
                            onChange={(e) => setVendorPaymentNote(e.target.value)}
                            placeholder={isUrdu ? 'مثلاً: نقد بذریعہ منشی، آن لائن ٹرانسفر، وغیرہ' : 'e.g. Cash, Bank Transfer'}
                            className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                          />
                        </div>

                        {/* Payment Method */}
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                            {isUrdu ? 'طریقہ ادائیگی:' : 'Method:'}
                          </label>
                          <select
                            value={vendorPaymentMethod}
                            onChange={(e) => setVendorPaymentMethod(e.target.value as 'cash' | 'online' | 'cheque')}
                            className="w-full px-2.5 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                          >
                            <option value="cash">{isUrdu ? 'نقد (Cash)' : 'Cash'}</option>
                            <option value="online">{isUrdu ? 'آن لائن / بینک' : 'Online / Bank'}</option>
                            <option value="cheque">{isUrdu ? 'بینک چیک' : 'Cheque'}</option>
                          </select>
                        </div>

                        {/* Target Lot Selector */}
                        <div className="sm:col-span-3">
                          <label className="text-[11px] font-bold text-slate-700 font-urdu-sans block mb-1">
                            {isUrdu ? 'کھاتہ / لاٹ:' : 'Target Lot:'}
                          </label>
                          <select
                            value={vendorPaymentTargetLotId}
                            onChange={(e) => setVendorPaymentTargetLotId(e.target.value)}
                            className="w-full px-2.5 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                          >
                            <option value="all">{isUrdu ? 'تمام لاٹس (کل کھاتہ)' : 'All Lots (Consolidated)'}</option>
                            {v.lots.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.productEmoji} {l.productUrdu} ({l.lotNumber}) - {formatPKR(l.summary.netPayableToVendor, settings.currencySymbol, settings.language)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Quick helpers and action buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-emerald-200">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-urdu-sans">{isUrdu ? 'فوری رقم:' : 'Quick Pay:'}</span>
                          <button
                            type="button"
                            onClick={() => setVendorPaymentAmount(v.pendingBalance > 0 ? v.pendingBalance : v.netPayable)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-bold font-urdu-sans transition shadow-2xs"
                          >
                            {isUrdu ? 'پوری بقایا رقم' : 'Full Balance'} ({formatPKR(v.pendingBalance > 0 ? v.pendingBalance : v.netPayable, settings.currencySymbol, settings.language)})
                          </button>
                          {v.netPayable > 10000 && (
                            <button
                              type="button"
                              onClick={() => setVendorPaymentAmount((prev) => prev + 10000)}
                              className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-800 text-[10px] font-bold font-numbers hover:bg-emerald-50 transition"
                            >
                              +10,000
                            </button>
                          )}
                          {v.netPayable > 50000 && (
                            <button
                              type="button"
                              onClick={() => setVendorPaymentAmount((prev) => prev + 50000)}
                              className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-800 text-[10px] font-bold font-numbers hover:bg-emerald-50 transition"
                            >
                              +50,000
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedVendorForPayment(null)}
                            className="px-3 py-1.5 bg-white text-slate-700 rounded-xl text-xs font-urdu-sans border border-slate-300 hover:bg-slate-50 transition"
                          >
                            {t.cancel}
                          </button>
                          <button
                            type="button"
                            disabled={vendorPaymentAmount <= 0}
                            onClick={() => handleSaveVendorPayment(v.vendorName)}
                            className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-urdu-sans shadow-xs flex items-center gap-1.5 transition active:scale-95"
                          >
                            <Check className="w-4 h-4" />
                            <span>{isUrdu ? 'ادائیگی محفوظ کریں' : 'Save Payment'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Micro lots list for this vendor with 'See All Bill' option */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 font-urdu-sans flex items-center gap-1.5">
                        <span>اجناس و لاٹس تفصیل ({v.lots.length}):</span>
                      </span>

                      {/* "See All Products Bill" Button requested by user */}
                      <button
                        onClick={() => {
                          sound.playTick();
                          const dateLabel =
                            dateFilter === 'today'
                              ? isUrdu ? 'آج کی تاریخ' : "Today's Date"
                              : dateFilter === 'yesterday'
                              ? isUrdu ? 'گزشتہ کل' : 'Yesterday'
                              : v.lots[0]?.arrivalDate || '';

                          setConsolidatedBillVendor({
                            vendorName: v.vendorName,
                            vendorPhone: v.vendorPhone,
                            vendorCity: v.vendorCity,
                            lots: v.lots,
                            dateLabel,
                          });
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-urdu-sans flex items-center gap-1.5 shadow-xs transition active:scale-95"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>{isUrdu ? 'تمام اجناس کا بل دیکھیں (کل مشترکہ بل)' : 'See All Products Bill'}</span>
                      </button>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {v.lots.map((lot) => {
                        const lotNet = lot.summary.netPayableToVendor;
                        const lotPaid = lot.vendorPaymentAmount !== undefined ? lot.vendorPaymentAmount : (lot.vendorPaymentStatus === 'paid' ? lotNet : 0);
                        const isLotPaid = lot.vendorPaymentStatus === 'paid' || lotPaid >= lotNet;
                        const isPartial = lot.vendorPaymentStatus === 'partial' || (lotPaid > 0 && lotPaid < lotNet);

                        return (
                          <div
                            key={lot.id}
                            className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-2 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="truncate">
                                <span className="font-bold text-slate-800 font-urdu-sans">
                                  {lot.productEmoji} {lot.productUrdu}
                                </span>
                                <span className="text-[11px] text-slate-400 font-numbers block">
                                  {lot.lotNumber} • {lot.arrivalDate} ({lot.totalQuantity} {unitLabels[lot.unitType][settings.language]})
                                </span>
                              </div>

                              <div className="text-end flex-shrink-0">
                                <span className="font-bold text-slate-900 font-numbers block">
                                  {formatPKR(lot.summary.grossSales, settings.currencySymbol, settings.language)}
                                </span>
                                <span className="text-[10px] text-slate-500 font-numbers block">
                                  {isUrdu ? 'خالص:' : 'Net:'} {formatPKR(lotNet, settings.currencySymbol, settings.language)}
                                </span>
                              </div>
                            </div>

                            {/* Lot payment status and actions */}
                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isLotPaid ? (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold font-urdu-sans flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                    <span>{isUrdu ? 'ادا شدہ' : 'Paid'}</span>
                                    {lot.vendorPaymentDate && (
                                      <span className="text-[9px] text-emerald-700 font-numbers">({lot.vendorPaymentDate})</span>
                                    )}
                                  </span>
                                ) : isPartial ? (
                                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold font-urdu-sans flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-blue-700" />
                                    <span>{isUrdu ? 'جزوی ادا' : 'Partial'}</span>
                                    <span className="text-[9px] text-blue-700 font-numbers">({formatPKR(lotPaid, settings.currencySymbol, settings.language)})</span>
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold font-urdu-sans flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-700" />
                                    <span>{isUrdu ? 'ادائیگی بقایا' : 'Pending'}</span>
                                  </span>
                                )}

                                {lot.vendorPaymentNotes && (
                                  <span className="text-[10px] text-slate-500 font-urdu-sans truncate max-w-[120px]" title={lot.vendorPaymentNotes}>
                                    📝 {lot.vendorPaymentNotes}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenVendorPayment(v.vendorName, Math.max(0, lotNet - lotPaid), lot.id)}
                                  className="text-[10px] text-emerald-700 hover:text-emerald-900 hover:underline font-bold font-urdu-sans"
                                >
                                  {isUrdu ? 'ادائیگی' : 'Pay'}
                                </button>

                                {onOpenReceipt && (
                                  <button
                                    onClick={() => onOpenReceipt(lot.id)}
                                    className="text-[10px] text-slate-600 hover:text-slate-900 hover:underline font-bold font-urdu-sans"
                                  >
                                    {isUrdu ? 'رسید' : 'Receipt'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. CUSTOMER REPORT: SUMMARY & TRANSACTIONS PER BUYER */}
      {activeReport === 'customer' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                <span>{t.reportByCustomer} ({customerReports.length} {isUrdu ? 'خریدار' : 'Buyers'})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold font-urdu-sans">
                {getDateRangeDetails().label}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Customer Selector Filter */}
              <select
                value={selectedCustomerFilter}
                onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">{isUrdu ? 'تمام گاہک (All Customers)' : 'All Customers'}</option>
                {allCustomerNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePreviewPDF}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isUrdu ? `گاہک رپورٹ پی ڈی ایف (${getDateRangeDetails().label})` : `Customer PDF (${getDateRangeDetails().label})`}</span>
              </button>
            </div>
          </div>

          {customerReports.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {t.noReportsFound}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {customerReports.map((c) => (
                <div key={c.customerName} className="p-3.5 sm:p-4 hover:bg-slate-50 transition space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 font-urdu-nastaliq">
                          {c.customerName}
                        </h4>
                        {c.shopName && (
                          <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-urdu-sans">
                            {c.shopName}
                          </span>
                        )}
                        {c.phone && (
                          <span className="text-[11px] text-slate-500 font-numbers">
                            📞 {c.phone}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-urdu-sans mt-0.5">
                        {c.totalPurchases} {isUrdu ? 'بار خریداری' : 'purchases'} • {c.totalUnitsBought} کل تعداد
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="text-start sm:text-end">
                        <span className="text-xs text-slate-500 font-urdu-sans block">کل خریداری:</span>
                        <span className="text-sm font-bold text-slate-900 font-numbers block">
                          {formatPKR(c.totalAmount, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div className="text-start sm:text-end bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 font-bold font-urdu-sans block">نقد ادا:</span>
                        <span className="text-xs font-bold text-emerald-950 font-numbers block">
                          {formatPKR(c.cashPaid, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      <div className="text-start sm:text-end bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-amber-900 font-bold font-urdu-sans block">بقایا کھاتہ:</span>
                        <span className="text-xs font-bold text-amber-900 font-numbers block">
                          {formatPKR(c.creditPending, settings.currencySymbol, settings.language)}
                        </span>
                      </div>
                      {/* Individual Customer PDF Report Preview Button */}
                      <button
                        onClick={() => {
                          sound.playTick();
                          const preview = buildSingleCustomerReportPDF(c, settings, getDateRangeDetails().label);
                          setPdfPreview(preview);
                        }}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs"
                        title="اس خریدار کا کھاتہ پی ڈی ایف دیکھیں یا ڈاؤن لوڈ کریں"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>کھاتہ پی ڈی ایف</span>
                      </button>
                    </div>
                  </div>

                  {/* Transaction Mini Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-start font-urdu-sans">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-200 text-[11px]">
                          <th className="py-1 px-2 text-start font-medium">{t.date}</th>
                          <th className="py-1 px-2 text-start font-medium">{t.product}</th>
                          <th className="py-1 px-2 text-center font-medium">{t.qty}</th>
                          <th className="py-1 px-2 text-center font-medium">{t.rate}</th>
                          <th className="py-1 px-2 text-end font-medium">{t.totalAmount}</th>
                          <th className="py-1 px-2 text-center font-medium">{t.status}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {c.transactions.map((tx, idx) => (
                          <tr key={idx} className="hover:bg-white">
                            <td className="py-1 px-2 font-numbers text-slate-500">{tx.date}</td>
                            <td className="py-1 px-2 font-bold text-slate-800">{tx.productUrdu}</td>
                            <td className="py-1 px-2 text-center font-numbers">{tx.quantity}</td>
                            <td className="py-1 px-2 text-center font-numbers">
                              {formatPKR(tx.ratePerUnit, settings.currencySymbol, settings.language)}
                            </td>
                            <td className="py-1 px-2 text-end font-bold font-numbers text-slate-900">
                              {formatPKR(tx.totalAmount, settings.currencySymbol, settings.language)}
                            </td>
                            <td className="py-1 px-2 text-center">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                  tx.paymentStatus === 'cash'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {tx.paymentStatus === 'cash' ? t.paymentCash : t.paymentCredit}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. PRODUCT REPORT: COMMODITY ANALYSIS */}
      {activeReport === 'product' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 font-urdu-sans">
                <span>{t.reportByProduct} ({productReports.length} {isUrdu ? 'اجناس' : 'Products'})</span>
              </h3>
              <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold font-urdu-sans">
                {getDateRangeDetails().label}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Product Selector Filter */}
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">{isUrdu ? 'تمام اجناس (All Products)' : 'All Products'}</option>
                {allProducts.map((p) => (
                  <option key={p.en} value={p.en}>
                    {p.emoji} {p.urdu} ({p.en})
                  </option>
                ))}
              </select>

              <button
                onClick={handlePreviewPDF}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isUrdu ? `جنس رپورٹ پی ڈی ایف (${getDateRangeDetails().label})` : `Product PDF (${getDateRangeDetails().label})`}</span>
              </button>
            </div>
          </div>

          {productReports.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-urdu-sans text-xs">
              {t.noReportsFound}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 sm:p-4">
              {productReports.map((p) => (
                <div
                  key={p.productName}
                  className="bg-slate-50 hover:bg-slate-100/80 p-4 rounded-2xl border border-slate-200 transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{p.emoji}</span>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 font-urdu-sans">
                          {p.productUrdu}
                        </h4>
                        <span className="text-[11px] text-slate-500 font-urdu-sans">
                          {p.totalLots} {t.totalLotsCount} • {p.totalSold} فروخت شدہ
                        </span>
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="text-xs text-slate-500 font-urdu-sans block">{t.grossTotal}:</span>
                      <span className="text-sm sm:text-base font-black text-slate-900 font-numbers block">
                        {formatPKR(p.grossTurnover, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  </div>

                  {/* Rate statistics */}
                  <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-urdu-sans block">{t.avgRate}</span>
                      <span className="text-xs font-bold text-slate-800 font-numbers">
                        {formatPKR(p.avgRate, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-urdu-sans block">{t.minRate}</span>
                      <span className="text-xs font-bold text-blue-700 font-numbers">
                        {formatPKR(p.minRate, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-urdu-sans block">{t.maxRate}</span>
                      <span className="text-xs font-bold text-emerald-700 font-numbers">
                        {formatPKR(p.maxRate, settings.currencySymbol, settings.language)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500 font-urdu-sans">کمیشن منافع: </span>
                      <span className="font-bold text-emerald-800 font-numbers">
                        {formatPKR(p.commissionEarned, settings.currencySymbol, settings.language)}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        sound.playTick();
                        const preview = buildSingleProductReportPDF(p, settings, getDateRangeDetails().label);
                        setPdfPreview(preview);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold font-urdu-sans transition flex items-center gap-1 shadow-2xs"
                      title="اس جنس کی مکمل رپورٹ پی ڈی ایف دیکھیں یا ڈاؤن لوڈ کریں"
                    >
                      <Eye className="w-3 h-3" />
                      <span>پی ڈی ایف رپورٹ</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONSOLIDATED ALL-PRODUCTS BILL MODAL (تمام اجناس کا مشترکہ بل) */}
      {consolidatedBillVendor && (
        <VendorConsolidatedBillModal
          isOpen={!!consolidatedBillVendor}
          vendorName={consolidatedBillVendor.vendorName}
          vendorPhone={consolidatedBillVendor.vendorPhone}
          vendorCity={consolidatedBillVendor.vendorCity}
          lots={consolidatedBillVendor.lots}
          dateLabel={consolidatedBillVendor.dateLabel}
          settings={settings}
          onClose={() => setConsolidatedBillVendor(null)}
        />
      )}

      {/* PDF REPORT INTERACTIVE PREVIEW MODAL (دیکھیں یا ڈاؤن لوڈ کریں) */}
      {pdfPreview && (
        <ReportPDFPreviewModal
          previewData={pdfPreview}
          onClose={() => setPdfPreview(null)}
          isUrdu={isUrdu}
        />
      )}
    </div>
  );
};
