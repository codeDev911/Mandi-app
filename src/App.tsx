import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  VendorLot,
  AppSettings,
  ActiveTab,
  PaymentStatus,
  VendorPaymentStatus,
  CustomerBuyer,
  BuyerPaymentRecord,
  BuyerCreditRecord,
  SavedVendor,
  VendorPaymentRecord,
  ShopExpense,
  DrawerAdjustment,
} from './types';
import { defaultSettings, getInitialLots, sampleCustomers, sampleVendors, sampleExpenses } from './utils/sampleData';
import { calculateLotSummary, calculateCashDrawerSummary } from './utils/calculations';
import { sound } from './utils/sound';
import {
  loadInitialApplicationData,
  saveLotsAsync,
  saveCustomersAsync,
  saveVendorsAsync,
  saveExpensesAsync,
  saveDrawerAdjustmentsAsync,
  saveSettingsAsync,
  saveLotsToIndexedDB,
  saveCustomersToIndexedDB,
  saveVendorsToIndexedDB,
  saveSettingsToIndexedDB,
} from './utils/storageEngine';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { BolliRoomView } from './components/BolliRoomView';
import { ExpenseSlipView } from './components/ExpenseSlipView';
import { LotExpenseSlipView } from './components/LotExpenseSlipView';
import { ReceiptPrintView } from './components/ReceiptPrintView';
import { BuyersKhataView } from './components/BuyersKhataView';
import { ReportsView } from './components/ReportsView';
import { DailyHistoryView } from './components/DailyHistoryView';
import { SettingsView } from './components/SettingsView';
import { NewLotModal } from './components/NewLotModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { CashDrawerModal } from './components/CashDrawerModal';
import { addSystemLog, seedInitialLogsIfEmpty } from './utils/systemLogs';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';

const STORAGE_KEY_LOTS = 'mandi_bolli_lots_v1';
const STORAGE_KEY_SETTINGS = 'mandi_bolli_settings_v1';
const STORAGE_KEY_CUSTOMERS = 'mandi_bolli_customers_v1';
const STORAGE_KEY_VENDORS = 'mandi_bolli_vendors_v1';
const STORAGE_KEY_EXPENSES = 'mandi_bolli_expenses_v1';
const STORAGE_KEY_DRAWER = 'mandi_bolli_drawer_adjustments_v1';

export default function App() {
  // 1. App Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return defaultSettings;
  });

  // 2. Vendor Lots State
  const [lots, setLots] = useState<VendorLot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return getInitialLots();
  });

  // 3. Customers Directory State
  const [customers, setCustomers] = useState<CustomerBuyer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOMERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return sampleCustomers;
  });

  // 4. Vendors Directory State
  const [vendors, setVendors] = useState<SavedVendor[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VENDORS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return sampleVendors;
  });

  // 5. Shop Operating Expenses State
  const [expenses, setExpenses] = useState<ShopExpense[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXPENSES);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return sampleExpenses;
  });

  // 6. Cash Drawer Manual Adjustments State
  const [drawerAdjustments, setDrawerAdjustments] = useState<DrawerAdjustment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DRAWER);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  // 7. Navigation and Modal States
  const [activeTab, setActiveTab] = useState<ActiveTab>('bolli');
  const [selectedLotId, setSelectedLotId] = useState<string>(() => lots[0]?.id || '');
  const [isNewLotOpen, setIsNewLotOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false);

  // Initial High-Speed IndexedDB bootstrap state
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const isLoadedFromDbRef = useRef(false);

  // Native Android Capacitor Setup (StatusBar, Haptics, Hardware Back Button)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Ensure status bar does not overlay webview so header starts below system icons
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#047857' }).catch(() => {});

      // Handle Android hardware back button
      const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
        if (isNewLotOpen) {
          setIsNewLotOpen(false);
        } else if (isCashDrawerOpen) {
          setIsCashDrawerOpen(false);
        } else if (isCloudSyncOpen) {
          setIsCloudSyncOpen(false);
        } else if (activeTab !== 'bolli') {
          setActiveTab('bolli');
        } else if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      });

      return () => {
        backListener.then((l) => l.remove()).catch(() => {});
      };
    }
  }, [isNewLotOpen, isCashDrawerOpen, isCloudSyncOpen, activeTab]);

  useEffect(() => {
    loadInitialApplicationData().then((data) => {
      if (!isLoadedFromDbRef.current) {
        if (data.lots && data.lots.length > 0) {
          setLots(data.lots);
          if (data.lots[0]) setSelectedLotId(data.lots[0].id);
        }
        if (data.settings) setSettings(data.settings);
        if (data.customers && data.customers.length > 0) setCustomers(data.customers);
        if (data.vendors && data.vendors.length > 0) setVendors(data.vendors);
        if (data.expenses && data.expenses.length > 0) setExpenses(data.expenses);
        if (data.drawerAdjustments && data.drawerAdjustments.length > 0) {
          setDrawerAdjustments(data.drawerAdjustments);
        }
        seedInitialLogsIfEmpty(data.lots || [], data.expenses || [], data.drawerAdjustments || []);
        isLoadedFromDbRef.current = true;
        setIsDataLoaded(true);
      }
    });
  }, []);

  // Sync settings with storage engine and sound
  useEffect(() => {
    if (!isDataLoaded) return;
    saveSettingsAsync(settings);
    sound.setEnabled(settings.soundEnabled);
    document.documentElement.dir = settings.language === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
  }, [settings, isDataLoaded]);

  // Sync lots with high-capacity IndexedDB storage engine
  useEffect(() => {
    if (!isDataLoaded) return;
    saveLotsAsync(lots);
  }, [lots, isDataLoaded]);

  // Sync customers with storage engine
  useEffect(() => {
    if (!isDataLoaded) return;
    saveCustomersAsync(customers);
  }, [customers, isDataLoaded]);

  // Sync vendors with storage engine
  useEffect(() => {
    if (!isDataLoaded) return;
    saveVendorsAsync(vendors);
  }, [vendors, isDataLoaded]);

  // Sync shop expenses with storage engine
  useEffect(() => {
    if (!isDataLoaded) return;
    saveExpensesAsync(expenses);
  }, [expenses, isDataLoaded]);

  // Sync drawer adjustments with storage engine
  useEffect(() => {
    if (!isDataLoaded) return;
    saveDrawerAdjustmentsAsync(drawerAdjustments);
  }, [drawerAdjustments, isDataLoaded]);

  // Make sure selectedLotId is valid
  useEffect(() => {
    if (!lots.some((l) => l.id === selectedLotId) && lots.length > 0) {
      setSelectedLotId(lots[0].id);
    }
  }, [lots, selectedLotId]);

  // Handlers
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  const handleSaveExpense = (expense: ShopExpense) => {
    sound.playCashChime();
    const isEdit = expenses.some((e) => e.id === expense.id);
    addSystemLog({
      title: 'EX',
      status: isEdit ? 'updated' : 'created',
      description: `دکان خرچہ ${isEdit ? 'اپ ڈیٹ' : 'نیا اندراج'}: ${expense.title} - مد: ${expense.category} (رقم: Rs.${expense.amount.toLocaleString()})`,
      descriptionEn: `Shop expense ${isEdit ? 'updated' : 'created'}: ${expense.title} - Rs.${expense.amount}`,
      entityId: expense.id,
      meta: { title: expense.title, amount: expense.amount, category: expense.category },
    });

    setExpenses((prev) => {
      const index = prev.findIndex((e) => e.id === expense.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = { ...expense, updatedAt: new Date().toISOString() };
        return copy;
      }
      return [expense, ...prev];
    });
  };

  const handleDeleteExpense = (expenseId: string) => {
    sound.playTick();
    const exp = expenses.find((e) => e.id === expenseId);
    addSystemLog({
      title: 'EX',
      status: 'deleted',
      description: `دکان خرچہ حذف: ${exp?.title || expenseId} (رقم: Rs.${(exp?.amount || 0).toLocaleString()})`,
      descriptionEn: `Shop expense deleted: ${exp?.title || expenseId}`,
      entityId: expenseId,
    });
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
  };

  const handleAddDrawerAdjustment = (adj: Omit<DrawerAdjustment, 'id' | 'timestamp'>) => {
    sound.playCashChime();
    const newEntry: DrawerAdjustment = {
      ...adj,
      id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };
    addSystemLog({
      title: 'CD',
      status: 'created',
      description: `گلہ کیش ایڈجسٹمنٹ درج (${adj.type === 'in' ? '+ کیش جمع' : '- کیش نکالیں'}): رقم Rs.${adj.amount.toLocaleString()} - وجہ: ${adj.reason || 'کوئی تفصیل نہیں'}`,
      descriptionEn: `Cash drawer adjustment added: ${adj.type} Rs.${adj.amount}`,
      entityId: newEntry.id,
      meta: { type: adj.type, amount: adj.amount, reason: adj.reason },
    });
    setDrawerAdjustments((prev) => [newEntry, ...prev]);
  };

  const handleDeleteDrawerAdjustment = (id: string) => {
    sound.playTick();
    const adj = drawerAdjustments.find((a) => a.id === id);
    addSystemLog({
      title: 'CD',
      status: 'deleted',
      description: `گلہ کیش ایڈجسٹمنٹ انٹری حذف: رقم Rs.${(adj?.amount || 0).toLocaleString()} (${adj?.type === 'in' ? 'کیش جمع' : 'کیش نکالیں'})`,
      descriptionEn: `Cash drawer adjustment deleted: Rs.${adj?.amount || 0}`,
      entityId: id,
    });
    setDrawerAdjustments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleBatchUpdateLots = (updatedLots: VendorLot[]) => {
    sound.playCashChime();
    addSystemLog({
      title: 'LT',
      status: 'updated',
      description: `بیک وقت ${updatedLots.length} لاٹس اپ ڈیٹ کی گئیں`,
      descriptionEn: `Batch updated ${updatedLots.length} lots`,
    });
    const updateMap = new Map(updatedLots.map((l) => [l.id, l]));
    setLots((prev) =>
      prev.map((lot) => {
        const match = updateMap.get(lot.id);
        return match || lot;
      })
    );
  };

  const handleSaveCustomer = (cust: CustomerBuyer) => {
    const isEdit = customers.some((c) => c.id === cust.id);
    addSystemLog({
      title: 'BK',
      status: isEdit ? 'updated' : 'created',
      description: `خریدار کھاتہ پروفائل ${isEdit ? 'اپ ڈیٹ' : 'نیا اندراج'}: ${cust.name}${cust.phone ? ` (${cust.phone})` : ''}`,
      descriptionEn: `Customer ${isEdit ? 'updated' : 'created'}: ${cust.name}`,
      entityId: cust.id,
    });
    setCustomers((prev) => {
      const index = prev.findIndex((c) => c.id === cust.id || c.name.toLowerCase() === cust.name.toLowerCase());
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = { ...copy[index], ...cust, updatedAt: new Date().toISOString() };
        return copy;
      }
      return [cust, ...prev];
    });
  };

  const handleDeleteCustomer = (customerId: string) => {
    sound.playTick();
    const cust = customers.find((c) => c.id === customerId);
    addSystemLog({
      title: 'BK',
      status: 'deleted',
      description: `خریدار کھاتہ پروفائل حذف: ${cust?.name || customerId}`,
      descriptionEn: `Customer deleted: ${cust?.name || customerId}`,
      entityId: customerId,
    });
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  const handleSaveVendor = (vendor: SavedVendor) => {
    const isEdit = vendors.some((v) => v.id === vendor.id);
    addSystemLog({
      title: 'VP',
      status: isEdit ? 'updated' : 'created',
      description: `زمیندار پروفائل ${isEdit ? 'اپ ڈیٹ' : 'نیا اندراج'}: نام ${vendor.name}${vendor.city ? ` (${vendor.city})` : ''}`,
      descriptionEn: `Vendor ${isEdit ? 'updated' : 'created'}: ${vendor.name}`,
      entityId: vendor.id,
    });
    setVendors((prev) => {
      const index = prev.findIndex((v) => v.id === vendor.id || v.name.toLowerCase() === vendor.name.toLowerCase());
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = { ...copy[index], ...vendor };
        return copy;
      }
      return [vendor, ...prev];
    });
  };

  const handleDeleteVendor = (vendorId: string) => {
    sound.playTick();
    const v = vendors.find((vend) => vend.id === vendorId);
    addSystemLog({
      title: 'VP',
      status: 'deleted',
      description: `زمیندار پروفائل حذف: ${v?.name || vendorId}`,
      descriptionEn: `Vendor deleted: ${v?.name || vendorId}`,
      entityId: vendorId,
    });
    setVendors((prev) => prev.filter((v) => v.id !== vendorId));
  };

  const handleRecordCustomerPayment = (customerId: string, payment: BuyerPaymentRecord) => {
    sound.playCashChime();
    addSystemLog({
      title: 'BK',
      status: 'created',
      description: `خریدار کھاتہ وصولی درج: خریدار ${payment.buyerName || customerId} سے رقم Rs.${payment.amount.toLocaleString()} وصول بذریعہ ${payment.paymentMethod || 'کیش'}${payment.notes ? ` (${payment.notes})` : ''}`,
      descriptionEn: `Buyer payment recorded: ${payment.buyerName || customerId} - Rs.${payment.amount}`,
      entityId: payment.id,
      meta: { buyerName: payment.buyerName || customerId, amount: payment.amount },
    });
    setCustomers((prev) => {
      const existing = prev.find((c) => c.id === customerId);
      if (existing) {
        return prev.map((c) => {
          if (c.id !== customerId) return c;
          const updatedPayments = [payment, ...(c.payments || [])];
          return {
            ...c,
            payments: updatedPayments,
            updatedAt: new Date().toISOString(),
          };
        });
      } else {
        const newCust: CustomerBuyer = {
          id: customerId,
          name: payment.buyerName || customerId,
          balance: 0,
          payments: [payment],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return [newCust, ...prev];
      }
    });
  };

  const handleDeleteCustomerPayment = (customerIdOrName: string, paymentId: string) => {
    sound.playPop();
    addSystemLog({
      title: 'BK',
      status: 'deleted',
      description: `خریدار کھاتہ وصولی انٹری حذف کر دی گئی: خریدار ${customerIdOrName}`,
      descriptionEn: `Buyer payment entry deleted for ${customerIdOrName}`,
      entityId: paymentId,
    });
    setCustomers((prev) => {
      const updated = prev.map((c) => {
        if (c.id === customerIdOrName || c.name.trim().toLowerCase() === customerIdOrName.trim().toLowerCase()) {
          const newPayments = (c.payments || []).filter((p) => p.id !== paymentId);
          return {
            ...c,
            payments: newPayments,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      saveCustomersToIndexedDB(updated).catch(console.error);
      return updated;
    });
  };

  const handleRecordCustomerCredit = (customerId: string, credit: BuyerCreditRecord) => {
    sound.playCashChime();
    addSystemLog({
      title: 'BK',
      status: 'created',
      description: `خریدار کھاتہ میں دستی ادھار کا اندراج: خریدار ${credit.buyerName || customerId} کو رقم Rs.${credit.amount.toLocaleString()} کا ادھار شامل کیا گیا${credit.notes ? ` (${credit.notes})` : ''}`,
      descriptionEn: `Customer manual credit recorded: ${credit.buyerName || customerId} - Rs.${credit.amount}`,
      entityId: credit.id,
      meta: { buyerName: credit.buyerName || customerId, amount: credit.amount, type: 'credit_addition' },
    });
    setCustomers((prev) => {
      const existing = prev.find((c) => c.id === customerId || c.name === customerId);
      if (existing) {
        const updated = prev.map((c) => {
          if (c.id !== existing.id) return c;
          const updatedCredits = [credit, ...(c.manualCredits || [])];
          return {
            ...c,
            manualCredits: updatedCredits,
            updatedAt: new Date().toISOString(),
          };
        });
        saveCustomersToIndexedDB(updated).catch(console.error);
        return updated;
      } else {
        const newCust: CustomerBuyer = {
          id: customerId,
          name: credit.buyerName || customerId,
          balance: credit.amount,
          manualCredits: [credit],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updated = [newCust, ...prev];
        saveCustomersToIndexedDB(updated).catch(console.error);
        return updated;
      }
    });
  };

  const handleDeleteCustomerCredit = (customerIdOrName: string, creditId: string) => {
    sound.playPop();
    addSystemLog({
      title: 'BK',
      status: 'deleted',
      description: `خریدار کھاتہ سے دستی ادھار انٹری حذف کر دی گئی: خریدار ${customerIdOrName}`,
      descriptionEn: `Buyer manual credit entry deleted for ${customerIdOrName}`,
      entityId: creditId,
    });
    setCustomers((prev) => {
      const updated = prev.map((c) => {
        if (c.id === customerIdOrName || c.name.trim().toLowerCase() === customerIdOrName.trim().toLowerCase()) {
          const newCredits = (c.manualCredits || []).filter((cr) => cr.id !== creditId);
          return {
            ...c,
            manualCredits: newCredits,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      saveCustomersToIndexedDB(updated).catch(console.error);
      return updated;
    });
  };

  const handleApplyCloudData = (data: {
    settings?: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
  }) => {
    sound.playCashChime();
    setIsDataLoaded(true);

    if (data.lots && data.lots.length > 0) {
      saveLotsToIndexedDB(data.lots).catch(console.error);
      setLots(data.lots);
      if (data.lots[0]) setSelectedLotId(data.lots[0].id);
    }
    if (data.customers && data.customers.length > 0) {
      saveCustomersToIndexedDB(data.customers).catch(console.error);
      setCustomers(data.customers);
    }
    if (data.vendors && data.vendors.length > 0) {
      saveVendorsToIndexedDB(data.vendors).catch(console.error);
      setVendors(data.vendors);
    }
    if (data.settings) {
      saveSettingsToIndexedDB(data.settings).catch(console.error);
      setSettings(data.settings);
    }
  };

  const handleSaveNewLot = (newLot: VendorLot) => {
    addSystemLog({
      title: 'LT',
      status: 'created',
      description: `نئی لاٹ #${newLot.lotNumber} کا اندراج: ${newLot.productUrdu || newLot.productName} (${newLot.totalQuantity} تعداد) - زمیندار: ${newLot.vendorName}`,
      descriptionEn: `New lot #${newLot.lotNumber} created: ${newLot.productName} (${newLot.totalQuantity}) - Vendor: ${newLot.vendorName}`,
      entityId: newLot.id,
      meta: {
        lotNumber: newLot.lotNumber,
        vendorName: newLot.vendorName,
        productName: newLot.productUrdu || newLot.productName,
        quantity: newLot.totalQuantity,
      },
    });

    setLots((prev) => [newLot, ...prev]);
    setSelectedLotId(newLot.id);
    setActiveTab('bolli');
  };

  const handleAddSaleToLot = (
    lotId: string,
    saleData: {
      buyerName: string;
      buyerPhone?: string;
      quantity: number;
      ratePerUnit: number;
      paymentStatus: PaymentStatus;
      notes?: string;
    }
  ) => {
    const targetLot = lots.find((l) => l.id === lotId);
    const totalAmount = saleData.quantity * saleData.ratePerUnit;

    addSystemLog({
      title: 'BL',
      status: 'created',
      description: `بولی فروخت اندراج: لاٹ #${targetLot?.lotNumber || ''} - ${saleData.quantity} تعداد ${targetLot?.productUrdu || ''} بنام ${saleData.buyerName} @ ریٹ ${saleData.ratePerUnit} (کل: Rs.${totalAmount.toLocaleString()}) [${saleData.paymentStatus === 'cash' ? 'نقد' : 'ادھار'}]`,
      descriptionEn: `Sale recorded: Lot #${targetLot?.lotNumber} - ${saleData.quantity} to ${saleData.buyerName} @ ${saleData.ratePerUnit} (${saleData.paymentStatus})`,
      entityId: `sale-${Date.now()}`,
      meta: {
        lotNumber: targetLot?.lotNumber,
        buyerName: saleData.buyerName,
        quantity: saleData.quantity,
        rate: saleData.ratePerUnit,
        totalAmount,
        paymentStatus: saleData.paymentStatus,
      },
    });

    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;

        const newSale = {
          id: `sale-${Date.now()}`,
          buyerName: saleData.buyerName,
          buyerPhone: saleData.buyerPhone,
          quantity: saleData.quantity,
          ratePerUnit: saleData.ratePerUnit,
          totalAmount: saleData.quantity * saleData.ratePerUnit,
          paymentStatus: saleData.paymentStatus,
          paidAmount: saleData.paymentStatus === 'cash' ? saleData.quantity * saleData.ratePerUnit : 0,
          notes: saleData.notes,
          timestamp: new Date().toISOString(),
        };

        const updatedSales = [...lot.sales, newSale];
        const updatedExpenses = { ...lot.expenses };
        const summary = calculateLotSummary(lot.totalQuantity, updatedSales, updatedExpenses);

        const isFullySold = summary.remainingQuantity === 0;

        return {
          ...lot,
          sales: updatedSales,
          expenses: updatedExpenses,
          summary,
          status: isFullySold ? 'completed' : lot.status,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleDeleteSale = (lotId: string, saleId: string) => {
    sound.playTick();
    const targetLot = lots.find((l) => l.id === lotId);
    const targetSale = targetLot?.sales.find((s) => s.id === saleId);

    addSystemLog({
      title: 'BL',
      status: 'deleted',
      description: `بولی بکری فروخت حذف: لاٹ #${targetLot?.lotNumber || ''} سے خریدار ${targetSale?.buyerName || ''} کی فروخت (${targetSale?.quantity || 0} تعداد @ ریٹ ${targetSale?.ratePerUnit || 0}) حذف کر دی گئی`,
      descriptionEn: `Sale deleted from lot #${targetLot?.lotNumber || lotId}`,
      entityId: saleId,
    });

    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;

        const updatedSales = lot.sales.filter((s) => s.id !== saleId);
        const summary = calculateLotSummary(lot.totalQuantity, updatedSales, lot.expenses);

        return {
          ...lot,
          sales: updatedSales,
          summary,
          status: summary.remainingQuantity > 0 ? 'active' : lot.status,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleDeleteLot = (lotId: string) => {
    sound.playTick();
    const lotToDelete = lots.find((l) => l.id === lotId);

    addSystemLog({
      title: 'LT',
      status: 'deleted',
      description: `لاٹ #${lotToDelete?.lotNumber || lotId} حذف کر دی گئی: ${lotToDelete?.productUrdu || lotToDelete?.productName || ''} (زمیندار: ${lotToDelete?.vendorName || ''})`,
      descriptionEn: `Lot #${lotToDelete?.lotNumber || lotId} deleted`,
      entityId: lotId,
      meta: {
        lotNumber: lotToDelete?.lotNumber,
        vendorName: lotToDelete?.vendorName,
      },
    });

    setLots((prev) => {
      const filtered = prev.filter((l) => l.id !== lotId);
      if (selectedLotId === lotId) {
        setSelectedLotId(filtered[0]?.id || '');
      }
      return filtered;
    });
  };

  const handleUpdateLotExpenses = (lotId: string, updatedExpenses: VendorLot['expenses']) => {
    const lot = lots.find((l) => l.id === lotId);
    addSystemLog({
      title: 'LT',
      status: 'updated',
      description: `لاٹ #${lot?.lotNumber || lotId} کے اخراجات / کٹوتیاں اپ ڈیٹ کی گئیں (زمیندار: ${lot?.vendorName || ''})`,
      descriptionEn: `Lot #${lot?.lotNumber || lotId} expenses updated`,
      entityId: lotId,
    });

    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;

        const summary = calculateLotSummary(lot.totalQuantity, lot.sales, updatedExpenses);
        return {
          ...lot,
          expenses: updatedExpenses,
          summary,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleToggleSalePaymentStatus = (lotId: string, saleId: string) => {
    const targetLot = lots.find((l) => l.id === lotId);
    const targetSale = targetLot?.sales.find((s) => s.id === saleId);
    const nextStatus: PaymentStatus = targetSale?.paymentStatus === 'cash' ? 'credit' : 'cash';

    addSystemLog({
      title: 'BL',
      status: 'updated',
      description: `بولی ادائیگی اسٹیٹس تبدیل: لاٹ #${targetLot?.lotNumber || ''} (خریدار: ${targetSale?.buyerName || ''}) -> ${nextStatus === 'cash' ? 'نقد (Cash)' : 'ادھار (Credit)'}`,
      descriptionEn: `Sale payment status changed for lot #${targetLot?.lotNumber}`,
      entityId: saleId,
    });

    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;

        const updatedSales = lot.sales.map((s) => {
          if (s.id !== saleId) return s;
          return {
            ...s,
            paymentStatus: nextStatus,
            paidAmount: nextStatus === 'cash' ? s.totalAmount : 0,
          };
        });

        return {
          ...lot,
          sales: updatedSales,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleMarkLotCompleted = (lotId: string) => {
    sound.playCashChime();
    const lot = lots.find((l) => l.id === lotId);
    addSystemLog({
      title: 'LT',
      status: 'updated',
      description: `لاٹ #${lot?.lotNumber || lotId} مکمل مارک کر دی گئی (زمیندار: ${lot?.vendorName || ''})`,
      descriptionEn: `Lot #${lot?.lotNumber || lotId} marked completed`,
      entityId: lotId,
    });

    setLots((prev) =>
      prev.map((l) => (l.id === lotId ? { ...l, status: 'completed', updatedAt: new Date().toISOString() } : l))
    );
  };

  const handleReopenLot = (lotId: string) => {
    sound.playTick();
    const lot = lots.find((l) => l.id === lotId);
    addSystemLog({
      title: 'LT',
      status: 'updated',
      description: `لاٹ #${lot?.lotNumber || lotId} دوبارہ فعال کی گئی (Active)`,
      descriptionEn: `Lot #${lot?.lotNumber || lotId} reopened`,
      entityId: lotId,
    });

    setLots((prev) =>
      prev.map((l) => (l.id === lotId ? { ...l, status: 'active', updatedAt: new Date().toISOString() } : l))
    );
  };

  const handleToggleVendorPaymentStatus = (lotId: string, customStatus?: 'pending' | 'paid') => {
    sound.playCashChime();
    const targetLot = lots.find((l) => l.id === lotId);
    const currentStatus = targetLot?.vendorPaymentStatus || 'pending';
    const nextStatus: 'pending' | 'paid' = customStatus || (currentStatus === 'paid' ? 'pending' : 'paid');

    addSystemLog({
      title: 'VP',
      status: 'updated',
      description: `زمیندار ادائیگی اسٹیٹس تبدیل: لاٹ #${targetLot?.lotNumber || ''} بنام ${targetLot?.vendorName || ''} -> ${nextStatus === 'paid' ? 'ادائیگی مکمل (Paid)' : 'ادائیگی باقی (Pending)'}`,
      descriptionEn: `Vendor payment status toggled for lot #${targetLot?.lotNumber}`,
      entityId: lotId,
    });

    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;
        return {
          ...lot,
          vendorPaymentStatus: nextStatus,
          vendorPaymentAmount: nextStatus === 'paid' ? lot.summary.netPayableToVendor : 0,
          vendorPaymentDate: nextStatus === 'paid' ? (lot.vendorPaymentDate || new Date().toISOString().slice(0, 10)) : undefined,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleRecordVendorPayment = (
    vendorName: string,
    payment: {
      lotId?: string;
      amount: number;
      notes?: string;
      paymentDate?: string;
      paymentMethod?: 'cash' | 'online' | 'cheque';
      status?: VendorPaymentStatus;
    }
  ) => {
    sound.playCashChime();
    const paymentDate = payment.paymentDate || new Date().toISOString().slice(0, 10);

    addSystemLog({
      title: 'VP',
      status: 'created',
      description: `زمیندار ادائیگی درج: زمیندار ${vendorName} کو رقم Rs.${payment.amount.toLocaleString()} ادا کی گئی [${payment.paymentMethod || 'کیش'}]${payment.notes ? ` (${payment.notes})` : ''}`,
      descriptionEn: `Vendor payment recorded: ${vendorName} - Rs.${payment.amount}`,
      meta: { vendorName, amount: payment.amount, lotId: payment.lotId },
    });

    // 1. Create a persistent VendorPaymentRecord
    const newVendorPaymentRecord: VendorPaymentRecord = {
      id: `vpay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      vendorName,
      lotId: payment.lotId,
      amount: payment.amount,
      paymentDate,
      date: paymentDate,
      paymentMethod: payment.paymentMethod || 'cash',
      notes: payment.notes || (payment.lotId ? 'لاٹ کی ادائیگی' : 'مجموعی کھاتہ ادائیگی'),
      timestamp: new Date().toISOString(),
    };

    setVendors((prevVendors) => {
      const existing = prevVendors.find((v) => v.name.trim().toLowerCase() === vendorName.trim().toLowerCase());
      if (existing) {
        // Prevent duplicate record from rapid clicking (same amount, date, within 4 seconds)
        const isDuplicate = (existing.payments || []).some(
          (p) =>
            p.amount === payment.amount &&
            (p.paymentDate || p.date) === paymentDate &&
            Math.abs(new Date(p.timestamp || '').getTime() - Date.now()) < 4000
        );
        if (isDuplicate) return prevVendors;

        const updated = prevVendors.map((v) =>
          v.id === existing.id
            ? { ...v, payments: [newVendorPaymentRecord, ...(v.payments || [])], updatedAt: new Date().toISOString() }
            : v
        );
        saveVendorsToIndexedDB(updated).catch(console.error);
        return updated;
      } else {
        const newV: SavedVendor = {
          id: `vend-${Date.now()}`,
          name: vendorName.trim(),
          payments: [newVendorPaymentRecord],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updated = [newV, ...prevVendors];
        saveVendorsToIndexedDB(updated).catch(console.error);
        return updated;
      }
    });

    setLots((prev) => {
      // 2. If a specific lot is targeted:
      if (payment.lotId) {
        const updated = prev.map((lot) => {
          if (lot.id !== payment.lotId) return lot;
          const totalNet = lot.summary.netPayableToVendor;
          const currentAlreadyPaid =
            lot.vendorPaymentAmount !== undefined
              ? lot.vendorPaymentAmount
              : lot.vendorPaymentStatus === 'paid'
              ? totalNet
              : 0;

          const newTotalPaid = Math.min(totalNet, currentAlreadyPaid + payment.amount);
          const status: VendorPaymentStatus =
            payment.status || (newTotalPaid >= totalNet ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending');

          return {
            ...lot,
            vendorPaymentStatus: status,
            vendorPaymentAmount: newTotalPaid,
            vendorPaymentDate: paymentDate,
            vendorPaymentNotes: payment.notes || lot.vendorPaymentNotes,
            vendorPaymentMethod: payment.paymentMethod || lot.vendorPaymentMethod || 'cash',
            updatedAt: new Date().toISOString(),
          };
        });
        saveLotsToIndexedDB(updated).catch(console.error);
        return updated;
      }

      // 3. If recorded for the vendor across all lots incrementally:
      let remainingToDistribute = payment.amount;

      // Sort vendor lots by date ascending (oldest first) or unpaid lots first
      const vendorLotIds = prev
        .filter((l) => l.vendorName.trim().toLowerCase() === vendorName.trim().toLowerCase())
        .map((l) => l.id);

      const updated = prev.map((lot) => {
        if (!vendorLotIds.includes(lot.id)) return lot;

        const totalNet = lot.summary.netPayableToVendor;
        const currentAlreadyPaid =
          lot.vendorPaymentAmount !== undefined
            ? lot.vendorPaymentAmount
            : lot.vendorPaymentStatus === 'paid'
            ? totalNet
            : 0;

        const unPaidOnThisLot = Math.max(0, totalNet - currentAlreadyPaid);

        let additionalPaidForThisLot = 0;
        if (remainingToDistribute > 0 && unPaidOnThisLot > 0) {
          if (remainingToDistribute >= unPaidOnThisLot) {
            additionalPaidForThisLot = unPaidOnThisLot;
            remainingToDistribute -= unPaidOnThisLot;
          } else {
            additionalPaidForThisLot = remainingToDistribute;
            remainingToDistribute = 0;
          }
        }

        const newTotalPaid = currentAlreadyPaid + additionalPaidForThisLot;
        const status: VendorPaymentStatus =
          newTotalPaid >= totalNet ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending';

        return {
          ...lot,
          vendorPaymentStatus: status,
          vendorPaymentAmount: newTotalPaid,
          vendorPaymentDate: additionalPaidForThisLot > 0 ? paymentDate : lot.vendorPaymentDate,
          vendorPaymentNotes: additionalPaidForThisLot > 0 && payment.notes ? payment.notes : lot.vendorPaymentNotes,
          vendorPaymentMethod: additionalPaidForThisLot > 0 && payment.paymentMethod ? payment.paymentMethod : lot.vendorPaymentMethod || 'cash',
          updatedAt: new Date().toISOString(),
        };
      });
      saveLotsToIndexedDB(updated).catch(console.error);
      return updated;
    });
  };

  const handleDeleteVendorPayment = (
    vendorName: string,
    paymentId: string,
    lotId?: string,
    amount?: number
  ) => {
    sound.playPop();

    addSystemLog({
      title: 'VP',
      status: 'deleted',
      description: `زمیندار ادائیگی ریکارڈ حذف: زمیندار ${vendorName} کی ادائیگی رقم Rs.${(amount || 0).toLocaleString()} حذف کر دی گئی`,
      descriptionEn: `Vendor payment record deleted for ${vendorName}`,
      entityId: paymentId,
    });

    // 1. Remove payment from vendor in vendors state
    setVendors((prevVendors) => {
      const updated = prevVendors.map((v) => {
        if (v.name.trim().toLowerCase() === vendorName.trim().toLowerCase()) {
          return {
            ...v,
            payments: (v.payments || []).filter((p) => p.id !== paymentId),
            updatedAt: new Date().toISOString(),
          };
        }
        return v;
      });
      saveVendorsToIndexedDB(updated).catch(console.error);
      return updated;
    });

    // 2. Adjust lot payment amounts if applicable
    const resolvedLotId = lotId || (paymentId.startsWith('lot-pay-') ? paymentId.replace('lot-pay-', '') : undefined);
    if (resolvedLotId) {
      setLots((prevLots) => {
        const updated = prevLots.map((lot) => {
          if (lot.id !== resolvedLotId) return lot;
          const currentPaid =
            lot.vendorPaymentAmount !== undefined
              ? lot.vendorPaymentAmount
              : lot.vendorPaymentStatus === 'paid'
              ? lot.summary.netPayableToVendor
              : 0;
          const deduct = amount || 0;
          const newPaid = Math.max(0, currentPaid - deduct);
          const newStatus: VendorPaymentStatus =
            newPaid <= 0 ? 'pending' : newPaid < lot.summary.netPayableToVendor ? 'partial' : 'paid';
          return {
            ...lot,
            vendorPaymentAmount: newPaid,
            vendorPaymentStatus: newStatus,
            updatedAt: new Date().toISOString(),
          };
        });
        saveLotsToIndexedDB(updated).catch(console.error);
        return updated;
      });
    } else if (amount && amount > 0) {
      // Revert distributed payment from lots of this vendor
      setLots((prevLots) => {
        let remainingToDeduct = amount;
        const updated = prevLots.map((lot) => {
          if (lot.vendorName.trim().toLowerCase() !== vendorName.trim().toLowerCase() || remainingToDeduct <= 0) {
            return lot;
          }
          const currentPaid =
            lot.vendorPaymentAmount !== undefined
              ? lot.vendorPaymentAmount
              : lot.vendorPaymentStatus === 'paid'
              ? lot.summary.netPayableToVendor
              : 0;
          if (currentPaid <= 0) return lot;
          const deduct = Math.min(currentPaid, remainingToDeduct);
          remainingToDeduct -= deduct;
          const newPaid = Math.max(0, currentPaid - deduct);
          const newStatus: VendorPaymentStatus =
            newPaid <= 0 ? 'pending' : newPaid < lot.summary.netPayableToVendor ? 'partial' : 'paid';
          return {
            ...lot,
            vendorPaymentAmount: newPaid,
            vendorPaymentStatus: newStatus,
            updatedAt: new Date().toISOString(),
          };
        });
        saveLotsToIndexedDB(updated).catch(console.error);
        return updated;
      });
    }
  };

  const handleOpenExpenseSlip = (lotId: string) => {
    setSelectedLotId(lotId);
    setActiveTab('slip_expenses');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenReceipt = (lotId: string) => {
    setSelectedLotId(lotId);
    setActiveTab('receipt');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetData = () => {
    const fresh = getInitialLots();
    setLots(fresh);
    setCustomers(sampleCustomers);
    setVendors(sampleVendors);
    setSelectedLotId(fresh[0]?.id || '');
    localStorage.removeItem(STORAGE_KEY_LOTS);
    localStorage.removeItem(STORAGE_KEY_CUSTOMERS);
    localStorage.removeItem(STORAGE_KEY_VENDORS);
  };

  const currentSelectedLot = lots.find((l) => l.id === selectedLotId) || lots[0];

  // Today's date in YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filter lots that arrived today or have sales today
  const todayLots = useMemo(() => {
    return lots.filter((l) => {
      const arrDate = l.arrivalDate?.slice(0, 10);
      const createDate = l.createdAt?.slice(0, 10);
      if (arrDate === todayStr || createDate === todayStr) return true;
      return l.sales.some((s) => (s.date || s.timestamp?.slice(0, 10)) === todayStr);
    });
  }, [lots, todayStr]);

  // Today's lots count (strictly today's data)
  const todayLotsCount = todayLots.length;

  // Active bolli lots across all time (for the navigation tab badge)
  const activeBolliCount = useMemo(() => {
    return lots.filter((l) => l.status === 'active').length;
  }, [lots]);

  // Today's sales (فروخت): strictly sales recorded today
  const todaySales = useMemo(() => {
    return lots.flatMap((lot) => {
      const isLotToday = (lot.arrivalDate?.slice(0, 10) === todayStr) || (lot.createdAt?.slice(0, 10) === todayStr);
      return lot.sales.filter((sale) => {
        const sDate = sale.date || sale.timestamp?.slice(0, 10);
        if (sDate === todayStr) return true;
        if (isLotToday && (!sDate || sDate.length < 10)) return true;
        return false;
      });
    });
  }, [lots, todayStr]);

  const totalTodaySales = useMemo(() => {
    return todaySales.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);
  }, [todaySales]);

  // Today's profit (منافع / کمیشن منافع): strictly commission earned on today's sales
  const totalTodayProfit = useMemo(() => {
    let profit = 0;
    lots.forEach((lot) => {
      const isLotToday = (lot.arrivalDate?.slice(0, 10) === todayStr) || (lot.createdAt?.slice(0, 10) === todayStr);
      const lotSalesToday = lot.sales.filter((s) => {
        const sDate = s.date || s.timestamp?.slice(0, 10);
        if (sDate === todayStr) return true;
        if (isLotToday && (!sDate || sDate.length < 10)) return true;
        return false;
      });

      if (lotSalesToday.length > 0) {
        const todaySalesAmount = lotSalesToday.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
        
        // Commission from today's sales
        if (lot.expenses?.commission?.enabled) {
          if (lot.expenses.commission.type === 'percentage') {
            const rate = Number(lot.expenses.commission.rate) || 0;
            profit += Math.round((todaySalesAmount * rate) / 100);
          } else if (isLotToday) {
            profit += Number(lot.expenses.commission.amount) || 0;
          }
        }

        // Munshiana earned if lot arrived today
        if (isLotToday && lot.expenses?.munshiana?.enabled) {
          profit += Number(lot.expenses.munshiana.amount) || 0;
        }
      } else if (isLotToday && (lot.summary?.grossSales || 0) > 0 && lot.sales.length === 0) {
        profit += Number(lot.summary.arhtiProfitCommission) || 0;
      }
    });

    return profit;
  }, [lots, todayStr]);

  // Overall Cash in Drawer Summary
  const cashDrawerSummary = useMemo(() => {
    return calculateCashDrawerSummary(lots, customers, expenses, drawerAdjustments, vendors);
  }, [lots, customers, expenses, drawerAdjustments, vendors]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-urdu-sans text-slate-900 selection:bg-emerald-200">
      {/* Top Header */}
      <Header
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenNewLot={() => setIsNewLotOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        activeLotsCount={activeBolliCount}
        todayLotsCount={todayLotsCount}
        totalTodaySales={totalTodaySales}
        totalTodayProfit={totalTodayProfit}
        cashInDrawer={cashDrawerSummary.netCashInDrawer}
        onOpenCashDrawer={() => setIsCashDrawerOpen(true)}
      />

      {/* Navigation Bars (Desktop & Mobile) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        settings={settings}
        activeBolliCount={activeBolliCount}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 mx-auto w-full px-3 sm:px-4 pt-3 sm:pt-4 transition-all ${
          settings.viewMode === 'mobile' ? 'max-w-2xl' : 'max-w-6xl'
        }`}
      >
        {activeTab === 'bolli' && (
          <BolliRoomView
            lots={lots}
            selectedLotId={selectedLotId}
            onSelectLot={setSelectedLotId}
            onAddSaleToLot={handleAddSaleToLot}
            onDeleteSale={handleDeleteSale}
            onDeleteLot={handleDeleteLot}
            onMarkLotCompleted={handleMarkLotCompleted}
            onReopenLot={handleReopenLot}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
            onOpenExpenseSlip={handleOpenExpenseSlip}
            onOpenReceipt={handleOpenReceipt}
            onOpenNewLot={() => setIsNewLotOpen(true)}
            settings={settings}
            customers={customers}
            onSaveCustomer={handleSaveCustomer}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpenseSlipView
            lot={currentSelectedLot}
            lots={lots}
            expenses={expenses}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
            onUpdateLotExpenses={handleUpdateLotExpenses}
            onOpenReceipt={handleOpenReceipt}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
            onBackToBolli={() => setActiveTab('bolli')}
            onSelectLot={setSelectedLotId}
            settings={settings}
          />
        )}

        {activeTab === 'slip_expenses' && currentSelectedLot && (
          <LotExpenseSlipView
            lot={currentSelectedLot}
            lots={lots}
            onSelectLot={setSelectedLotId}
            onUpdateLotExpenses={handleUpdateLotExpenses}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
            onOpenReceipt={handleOpenReceipt}
            onBackToBolli={() => setActiveTab('bolli')}
            settings={settings}
          />
        )}

        {activeTab === 'receipt' && currentSelectedLot && (
          <ReceiptPrintView
            lot={currentSelectedLot}
            lots={lots}
            onSelectLot={setSelectedLotId}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
            onBackToBolli={() => setActiveTab('bolli')}
            onOpenExpenseSlip={handleOpenExpenseSlip}
            settings={settings}
          />
        )}

        {activeTab === 'khata' && (
          <BuyersKhataView
            lots={lots}
            customers={customers}
            vendors={vendors}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onRecordCustomerPayment={handleRecordCustomerPayment}
            onDeleteCustomerPayment={handleDeleteCustomerPayment}
            onRecordCustomerCredit={handleRecordCustomerCredit}
            onDeleteCustomerCredit={handleDeleteCustomerCredit}
            onToggleSalePaymentStatus={handleToggleSalePaymentStatus}
            onSaveVendor={handleSaveVendor}
            onDeleteVendor={handleDeleteVendor}
            onRecordVendorPayment={handleRecordVendorPayment}
            onDeleteVendorPayment={handleDeleteVendorPayment}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
            onOpenReceipt={handleOpenReceipt}
            onOpenExpenseSlip={handleOpenExpenseSlip}
            onDeleteSale={handleDeleteSale}
            onDeleteLot={handleDeleteLot}
            settings={settings}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            lots={lots}
            customers={customers}
            expenses={expenses}
            drawerAdjustments={drawerAdjustments}
            onAddDrawerAdjustment={handleAddDrawerAdjustment}
            onDeleteDrawerAdjustment={handleDeleteDrawerAdjustment}
            onBatchUpdateLots={handleBatchUpdateLots}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
            settings={settings}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
            onRecordVendorPayment={handleRecordVendorPayment}
            onOpenReceipt={handleOpenReceipt}
            onOpenExpenseSlip={handleOpenExpenseSlip}
          />
        )}

        {activeTab === 'history' && (
          <DailyHistoryView
            lots={lots}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
            onOpenExpenseSlip={handleOpenExpenseSlip}
            onOpenReceipt={handleOpenReceipt}
            onSelectLot={(id) => {
              setSelectedLotId(id);
              setActiveTab('bolli');
            }}
            onOpenNewLot={() => setIsNewLotOpen(true)}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            lots={lots}
            customers={customers}
            vendors={vendors}
            onUpdateSettings={handleUpdateSettings}
            onResetData={handleResetData}
            onOpenCloudSync={() => setIsCloudSyncOpen(true)}
            onRestoreBackup={handleApplyCloudData}
          />
        )}
      </main>

      {/* New Lot Modal */}
      <NewLotModal
        settings={settings}
        isOpen={isNewLotOpen}
        onClose={() => setIsNewLotOpen(false)}
        onSaveLot={handleSaveNewLot}
        existingLotsCount={lots.length}
        savedVendors={vendors}
        onSaveVendor={handleSaveVendor}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Cloud Sync & Multi-Device Backup Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        lots={lots}
        customers={customers}
        vendors={vendors}
        settings={settings}
        onApplyCloudData={handleApplyCloudData}
      />

      {/* Cash Drawer Modal */}
      <CashDrawerModal
        isOpen={isCashDrawerOpen}
        onClose={() => setIsCashDrawerOpen(false)}
        lots={lots}
        customers={customers}
        expenses={expenses}
        drawerAdjustments={drawerAdjustments}
        onAddAdjustment={handleAddDrawerAdjustment}
        onDeleteAdjustment={handleDeleteDrawerAdjustment}
        settings={settings}
      />
    </div>
  );
}
