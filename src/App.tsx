import React, { useState, useEffect } from 'react';
import {
  VendorLot,
  AppSettings,
  ActiveTab,
  PaymentStatus,
  CustomerBuyer,
  BuyerPaymentRecord,
  SavedVendor,
} from './types';
import { defaultSettings, getInitialLots, sampleCustomers, sampleVendors } from './utils/sampleData';
import { calculateLotSummary } from './utils/calculations';
import { sound } from './utils/sound';
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

  // Sync settings with local storage and sound engine
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
    sound.setEnabled(settings.soundEnabled);
    document.documentElement.dir = settings.language === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
  }, [settings]);

  // Sync lots with local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOTS, JSON.stringify(lots));
    } catch {
      // ignore
    }
  }, [lots]);

  // Sync customers with local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(customers));
    } catch {
      // ignore
    }
  }, [customers]);

  // Sync vendors with local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VENDORS, JSON.stringify(vendors));
    } catch {
      // ignore
    }
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

  const handleRecordCustomerPayment = (customerId: string, payment: BuyerPaymentRecord) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== customerId) return c;
        const updatedPayments = [payment, ...(c.payments || [])];
        const newBalance = Math.max(0, c.balance - payment.amount);
        return {
          ...c,
          balance: newBalance,
          payments: updatedPayments,
          updatedAt: new Date().toISOString(),
        };
      })
    );
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

  const activeLotsCount = lots.filter((l) => l.status === 'active').length;
  const totalTodaySales = lots.reduce((acc, l) => acc + l.summary.grossSales, 0);
  const totalTodayProfit = lots.reduce((acc, l) => acc + l.summary.arhtiProfitCommission, 0);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-urdu-sans text-slate-900 selection:bg-emerald-200">
      {/* Top Header */}
      <Header
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenNewLot={() => setIsNewLotOpen(true)}
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
            onMarkLotCompleted={handleMarkLotCompleted}
            onReopenLot={handleReopenLot}
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
            onBackToBolli={() => setActiveTab('bolli')}
            settings={settings}
          />
        )}

        {activeTab === 'receipt' && currentSelectedLot && (
          <ReceiptPrintView
            lot={currentSelectedLot}
            lots={lots}
            onSelectLot={setSelectedLotId}
            onBackToBolli={() => setActiveTab('bolli')}
            onOpenExpenseSlip={handleOpenExpenseSlip}
            settings={settings}
          />
        )}

        {activeTab === 'khata' && (
          <BuyersKhataView
            lots={lots}
            customers={customers}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onRecordCustomerPayment={handleRecordCustomerPayment}
            onToggleSalePaymentStatus={handleToggleSalePaymentStatus}
            settings={settings}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            lots={lots}
            customers={customers}
            settings={settings}
            onOpenReceipt={handleOpenReceipt}
            onOpenExpenseSlip={handleOpenExpenseSlip}
          />
        )}

        {activeTab === 'history' && (
          <DailyHistoryView
            lots={lots}
            onOpenExpenseSlip={handleOpenExpenseSlip}
            onOpenReceipt={handleOpenReceipt}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetData={handleResetData}
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
    </div>
  );
}
