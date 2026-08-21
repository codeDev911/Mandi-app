import React, { useState, useEffect, useRef } from 'react';
import {
  VendorLot,
  AppSettings,
  ActiveTab,
  PaymentStatus,
  VendorPaymentStatus,
  CustomerBuyer,
  BuyerPaymentRecord,
  SavedVendor,
} from './types';
import { defaultSettings, getInitialLots, sampleCustomers, sampleVendors } from './utils/sampleData';
import { calculateLotSummary } from './utils/calculations';
import { sound } from './utils/sound';
import {
  loadInitialApplicationData,
  saveLotsAsync,
  saveCustomersAsync,
  saveVendorsAsync,
  saveSettingsAsync,
} from './utils/storageEngine';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { BolliRoomView } from './components/BolliRoomView';
import { ExpenseSlipView } from './components/ExpenseSlipView';
import { ReceiptPrintView } from './components/ReceiptPrintView';
import { BuyersKhataView } from './components/BuyersKhataView';
import { ReportsView } from './components/ReportsView';
import { DailyHistoryView } from './components/DailyHistoryView';
import { SettingsView } from './components/SettingsView';
import { NewLotModal } from './components/NewLotModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';

const STORAGE_KEY_LOTS = 'mandi_bolli_lots_v1';
const STORAGE_KEY_SETTINGS = 'mandi_bolli_settings_v1';
const STORAGE_KEY_CUSTOMERS = 'mandi_bolli_customers_v1';
const STORAGE_KEY_VENDORS = 'mandi_bolli_vendors_v1';

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

  // 5. Navigation and Modal States
  const [activeTab, setActiveTab] = useState<ActiveTab>('bolli');
  const [selectedLotId, setSelectedLotId] = useState<string>(() => lots[0]?.id || '');
  const [isNewLotOpen, setIsNewLotOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);

  // Initial High-Speed IndexedDB bootstrap
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
  }, [isNewLotOpen, isCloudSyncOpen, activeTab]);

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
        isLoadedFromDbRef.current = true;
      }
    });
  }, []);

  // Sync settings with storage engine and sound
  useEffect(() => {
    saveSettingsAsync(settings);
    sound.setEnabled(settings.soundEnabled);
    document.documentElement.dir = settings.language === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
  }, [settings]);

  // Sync lots with high-capacity IndexedDB storage engine
  useEffect(() => {
    saveLotsAsync(lots);
  }, [lots]);

  // Sync customers with storage engine
  useEffect(() => {
    saveCustomersAsync(customers);
  }, [customers]);

  // Sync vendors with storage engine
  useEffect(() => {
    saveVendorsAsync(vendors);
  }, [vendors]);

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

  const handleSaveCustomer = (cust: CustomerBuyer) => {
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
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  const handleSaveVendor = (vendor: SavedVendor) => {
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
    setVendors((prev) => prev.filter((v) => v.id !== vendorId));
  };

  const handleRecordCustomerPayment = (customerId: string, payment: BuyerPaymentRecord) => {
    sound.playCashChime();
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

  const handleApplyCloudData = (data: {
    settings?: AppSettings;
    lots: VendorLot[];
    customers: CustomerBuyer[];
    vendors: SavedVendor[];
  }) => {
    sound.playCashChime();
    if (data.lots && data.lots.length > 0) {
      setLots(data.lots);
      if (data.lots[0]) setSelectedLotId(data.lots[0].id);
    }
    if (data.customers) setCustomers(data.customers);
    if (data.vendors) setVendors(data.vendors);
    if (data.settings) setSettings(data.settings);
  };

  const handleSaveNewLot = (newLot: VendorLot) => {
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
    setLots((prev) => {
      const filtered = prev.filter((l) => l.id !== lotId);
      if (selectedLotId === lotId) {
        setSelectedLotId(filtered[0]?.id || '');
      }
      return filtered;
    });
  };

  const handleUpdateLotExpenses = (lotId: string, updatedExpenses: VendorLot['expenses']) => {
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
    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;

        const updatedSales = lot.sales.map((s) => {
          if (s.id !== saleId) return s;
          const nextStatus: PaymentStatus = s.paymentStatus === 'cash' ? 'credit' : 'cash';
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
    setLots((prev) =>
      prev.map((l) => (l.id === lotId ? { ...l, status: 'completed', updatedAt: new Date().toISOString() } : l))
    );
  };

  const handleReopenLot = (lotId: string) => {
    sound.playTick();
    setLots((prev) =>
      prev.map((l) => (l.id === lotId ? { ...l, status: 'active', updatedAt: new Date().toISOString() } : l))
    );
  };

  const handleToggleVendorPaymentStatus = (lotId: string, customStatus?: 'pending' | 'paid') => {
    sound.playCashChime();
    setLots((prev) =>
      prev.map((lot) => {
        if (lot.id !== lotId) return lot;
        const currentStatus = lot.vendorPaymentStatus || 'pending';
        const nextStatus: 'pending' | 'paid' = customStatus || (currentStatus === 'paid' ? 'pending' : 'paid');
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

    setLots((prev) => {
      // 1. If a specific lot is targeted:
      if (payment.lotId) {
        return prev.map((lot) => {
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
      }

      // 2. If recorded for the vendor across all lots incrementally:
      let remainingToDistribute = payment.amount;

      // Sort vendor lots by date ascending (oldest first) or unpaid lots first
      const vendorLotIds = prev
        .filter((l) => l.vendorName === vendorName)
        .map((l) => l.id);

      return prev.map((lot) => {
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
    });
  };

  const handleOpenExpenseSlip = (lotId: string) => {
    setSelectedLotId(lotId);
    setActiveTab('expenses');
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
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter lots that arrived today or have sales today
  const todayLots = lots.filter((l) => {
    if (l.arrivalDate === todayStr) return true;
    return l.sales.some((s) => s.timestamp.slice(0, 10) === todayStr);
  });

  // Calculate active lots for today and today's sales & profit
  const activeLotsCount = lots.filter((l) => l.status === 'active' && (l.arrivalDate === todayStr || l.createdAt?.slice(0, 10) === todayStr || !l.createdAt)).length || lots.filter((l) => l.status === 'active').length;
  
  // Calculate today's sales from sales that occurred today (or on today's lots)
  const todaySalesList = lots.flatMap((l) => 
    l.sales.filter((s) => s.timestamp.slice(0, 10) === todayStr || l.arrivalDate === todayStr)
  );
  
  const totalTodaySales = todayLots.length > 0 
    ? todayLots.reduce((acc, l) => acc + l.summary.grossSales, 0)
    : todaySalesList.reduce((acc, s) => acc + s.totalAmount, 0);

  const totalTodayProfit = todayLots.length > 0
    ? todayLots.reduce((acc, l) => acc + l.summary.arhtiProfitCommission, 0)
    : lots.reduce((acc, l) => acc + l.summary.arhtiProfitCommission, 0);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-urdu-sans text-slate-900 selection:bg-emerald-200">
      {/* Top Header */}
      <Header
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenNewLot={() => setIsNewLotOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        activeLotsCount={activeLotsCount}
        totalTodaySales={totalTodaySales}
        totalTodayProfit={totalTodayProfit}
      />

      {/* Navigation Bars (Desktop & Mobile) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        settings={settings}
        activeBolliCount={activeLotsCount}
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

        {activeTab === 'expenses' && currentSelectedLot && (
          <ExpenseSlipView
            lot={currentSelectedLot}
            onUpdateLotExpenses={handleUpdateLotExpenses}
            onOpenReceipt={handleOpenReceipt}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
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
            onToggleSalePaymentStatus={handleToggleSalePaymentStatus}
            onSaveVendor={handleSaveVendor}
            onDeleteVendor={handleDeleteVendor}
            onRecordVendorPayment={handleRecordVendorPayment}
            onToggleVendorPaymentStatus={handleToggleVendorPaymentStatus}
            onOpenReceipt={handleOpenReceipt}
            onOpenExpenseSlip={handleOpenExpenseSlip}
            settings={settings}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            lots={lots}
            customers={customers}
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
    </div>
  );
}
