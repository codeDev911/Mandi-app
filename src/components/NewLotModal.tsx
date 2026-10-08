import React, { useState, useEffect, useMemo } from 'react';
import { UnitType, AppSettings, VendorLot, SavedVendor, MazdooriRateItem } from '../types';
import { translations, commonMandiProducts, unitLabels, ProductPreset, getAvailableProducts, getUnitDisplayLabel, resolveUnitType } from '../utils/localization';
import { generateLotNumber, getLotReceiptNumber, calculateLotSummary, getUnitMazdooriRate, getMazdooriItems } from '../utils/calculations';
import { parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import {
  X,
  Check,
  Truck,
  MapPin,
  Phone,
  User,
  Package,
  Hash,
  BookmarkCheck,
  PackageCheck,
  Search,
} from 'lucide-react';

const cleanUrduTitle = (title: string): string => {
  return title.replace(/\s*\([^)]*\)/g, '').trim() || title;
};

interface NewLotModalProps {
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSaveLot: (lot: VendorLot) => void;
  existingLotsCount: number;
  existingLots?: VendorLot[];
  savedVendors?: SavedVendor[];
  onSaveVendor?: (vendor: SavedVendor) => void;
  onUpdateSettings?: (settings: AppSettings) => void;
}

export const NewLotModal: React.FC<NewLotModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSaveLot,
  existingLotsCount,
  existingLots,
  savedVendors = [],
  onSaveVendor,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const availableProducts = useMemo(() => getAvailableProducts(settings), [settings.products]);
  const mazdooriItems = useMemo(() => getMazdooriItems(settings), [settings.mazdooriItems]);
  const defaultMazdoori = mazdooriItems[0];

  const upcomingLotNumber = useMemo(
    () => generateLotNumber(existingLots || existingLotsCount),
    [existingLots, existingLotsCount, isOpen]
  );

  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorCity, setVendorCity] = useState('');
  const [saveVendorToDb, setSaveVendorToDb] = useState(true);
  const [keepVendorAndStayOpen, setKeepVendorAndStayOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductPreset | 'other'>(() => availableProducts[0] || commonMandiProducts[0]);
  const [isOtherProduct, setIsOtherProduct] = useState(false);
  const [customProductUrdu, setCustomProductUrdu] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🥬');
  const [selectedMazdooriId, setSelectedMazdooriId] = useState<string | null>(() => defaultMazdoori?.id || null);
  const [selectedMazdooriTitle, setSelectedMazdooriTitle] = useState<string>(() => defaultMazdoori ? cleanUrduTitle(defaultMazdoori.title) : 'بوری');
  const [mazdooriRate, setMazdooriRate] = useState<number>(() => defaultMazdoori?.rate || 30);
  const [unitType, setUnitType] = useState<UnitType>(() => defaultMazdoori ? (cleanUrduTitle(defaultMazdoori.title) as UnitType) : 'بوری');
  const [totalQuantity, setTotalQuantity] = useState<number | ''>(30);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(settings.defaultCommissionPercent);

  const [kirayaAmount, setKirayaAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);

  // Sync / match mazdoori rate and title whenever unitType or settings change
  useEffect(() => {
    const items = getMazdooriItems(settings);
    let matched = selectedMazdooriId ? items.find((it) => it.id === selectedMazdooriId) : null;
    if (!matched && unitType) {
      matched = items.find(
        (it) =>
          cleanUrduTitle(it.title).toLowerCase() === String(unitType).toLowerCase() ||
          it.unitType === unitType ||
          it.title.toLowerCase().includes(String(unitType).toLowerCase())
      );
    }
    if (matched) {
      setSelectedMazdooriId(matched.id);
      setSelectedMazdooriTitle(cleanUrduTitle(matched.title));
      setMazdooriRate(matched.rate);
    } else {
      const uRate = getUnitMazdooriRate(unitType, settings);
      setMazdooriRate(uRate);
      setSelectedMazdooriTitle(getUnitDisplayLabel(unitType, settings.language));
      setSelectedMazdooriId(null);
    }
  }, [unitType, selectedMazdooriId, settings.mazdooriItems, settings.unitMazdooriRates]);

  const handleSelectMazdooriItem = (item: MazdooriRateItem) => {
    sound.playTick();
    const cleanTitle = cleanUrduTitle(item.title);
    setSelectedMazdooriId(item.id);
    setSelectedMazdooriTitle(cleanTitle);
    setMazdooriRate(item.rate);
    // Directly preserve the actual unit type title added by the user
    setUnitType(cleanTitle as UnitType);
  };

  if (!isOpen) return null;

  const handleSelectProduct = (prod: ProductPreset) => {
    sound.playTick();
    setIsOtherProduct(false);
    setSelectedProduct(prod);
    // Note: Do NOT overwrite unitType or mazdooriRate here!
    // The user's selected unit type (e.g. شاپر) remains active.
    setError(null);
  };

  const handleSelectOther = () => {
    sound.playTick();
    setIsOtherProduct(true);
    setSelectedProduct('other');
    setError(null);
  };

  const otherPresets = [
    { urdu: 'امرود', emoji: '🍐', unit: 'peti' as UnitType },
    { urdu: 'مٹر', emoji: '🫛', unit: 'theli' as UnitType },
    { urdu: 'شملہ مرچ', emoji: '🫑', unit: 'theli' as UnitType },
    { urdu: 'گوبھی', emoji: '🥦', unit: 'theli' as UnitType },
    { urdu: 'بھنڈی', emoji: '🥬', unit: 'theli' as UnitType },
    { urdu: 'کینو', emoji: '🍊', unit: 'peti' as UnitType },
    { urdu: 'خربوزہ', emoji: '🍈', unit: 'bori' as UnitType },
    { urdu: 'تربوز', emoji: '🍉', unit: 'nag' as UnitType },
  ];

  const emojiOptions = ['🥬', '🥦', '🫑', '🫛', '🌽', '🥕', '🥔', '🧄', '🧅', '🥜', '🍄', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🥝', '🥥', '📦'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      setError(isUrdu ? 'براہ کرم زمیندار کا نام درج کریں' : 'Please enter vendor name');
      return;
    }

    if (isOtherProduct && !customProductUrdu.trim()) {
      setError(isUrdu ? 'براہ کرم جنس / سبزی / پھل کا نام درج کریں' : 'Please enter custom product name');
      return;
    }

    const numTotalQty = typeof totalQuantity === 'number' ? totalQuantity : parseInt(String(totalQuantity), 10);
    if (!numTotalQty || numTotalQty <= 0) {
      setError(isUrdu ? 'براہ کرم صحیح تعداد درج کریں' : 'Please enter valid quantity');
      return;
    }

    const lotNumber = generateLotNumber(existingLots || existingLotsCount);
    
    let prodName: string;
    let prodUrdu: string;
    let prodEmoji: string;

    if (isOtherProduct) {
      prodUrdu = customProductUrdu.trim();
      prodName = customProductUrdu.trim();
      prodEmoji = customEmoji;
    } else {
      const preset = selectedProduct as ProductPreset;
      prodName = preset.nameUrdu;
      prodUrdu = preset.nameUrdu;
      prodEmoji = preset.emoji;
    }

    const newLot: VendorLot = {
      id: `lot-${Date.now()}`,
      lotNumber,
      vendorName: vendorName.trim(),
      vendorPhone: vendorPhone.trim() || undefined,
      vendorCity: vendorCity.trim() || undefined,
      productName: prodName,
      productUrdu: prodUrdu,
      productEmoji: prodEmoji || '📦',
      unitType: (selectedMazdooriTitle || unitType || 'بوری') as UnitType,
      totalQuantity: numTotalQty,
      vehicleNumber: vehicleNumber.trim() || undefined,
      arrivalDate: new Date().toISOString().slice(0, 10),
      status: 'active',
      vendorPaymentStatus: 'pending',
      sales: [],
      expenses: {
        commission: {
          type: 'percentage',
          rate: commissionRate,
          amount: 0,
          enabled: true,
        },
        kiraya: {
          amount: kirayaAmount,
          enabled: kirayaAmount > 0,
          note: kirayaAmount > 0 ? (isUrdu ? 'کرایہ گاڑی' : 'Freight') : undefined,
        },
        mazdoori: {
          ratePerUnit: mazdooriRate,
          amount: mazdooriRate * numTotalQty,
          enabled: mazdooriRate > 0,
          title: selectedMazdooriTitle || undefined,
        },
        munshiana: {
          amount: settings.defaultMunshiana,
          enabled: settings.defaultMunshiana > 0,
        },
        naqdAdvance: {
          amount: advanceAmount,
          enabled: advanceAmount > 0,
          note: advanceAmount > 0 ? (isUrdu ? 'پیشگی نقد' : 'Cash Advance') : undefined,
        },
        marketFee: {
          ratePerUnit: settings.defaultMarketFeePerUnit,
          amount: settings.defaultMarketFeePerUnit * numTotalQty,
          enabled: settings.defaultMarketFeePerUnit > 0,
        },
        customExpenses: [],
      },
      summary: {
        totalSoldQuantity: 0,
        remainingQuantity: numTotalQty,
        grossSales: 0,
        totalExpenses: 0,
        netPayableToVendor: 0,
        arhtiProfitCommission: 0,
        percentSold: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Calculate initial summary
    newLot.summary = calculateLotSummary(newLot.totalQuantity, newLot.sales, newLot.expenses);

    // Save vendor to directory if checkbox is checked
    if (saveVendorToDb && onSaveVendor && vendorName.trim()) {
      onSaveVendor({
        id: `vendor-${Date.now()}`,
        name: vendorName.trim(),
        phone: vendorPhone.trim() || undefined,
        city: vendorCity.trim() || undefined,
        createdAt: new Date().toISOString(),
      });
    }

    sound.playBidSound();
    onSaveLot(newLot);

    // If "keep vendor details & don't close" is checked:
    if (keepVendorAndStayOpen) {
      // Keep vendorName, vendorPhone, vendorCity, vehicleNumber intact!
      // Only reset product-specific fields for the next product:
      setTotalQuantity(30);
      setKirayaAmount(0);
      setAdvanceAmount(0);
      setIsOtherProduct(false);
      const firstProd = availableProducts[0] || commonMandiProducts[0];
      setSelectedProduct(firstProd);
      setCustomProductUrdu('');
      setError(null);
    } else {
      onClose();
    }
  };

  const cities = ['اوکاڑہ', 'سرگودھا', 'ساہیوال', 'شیخوپورہ', 'قصور', 'ملتان', 'رحیم یار خان', 'سوات', 'پشاور'];

  const handleSelectSavedVendor = (v: SavedVendor) => {
    sound.playTick();
    setVendorName(v.name);
    if (v.phone) setVendorPhone(v.phone);
    if (v.city) setVendorCity(v.city);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl lg:max-w-5xl xl:max-w-6xl rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-5 duration-200">
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden"></div>

        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base font-urdu-nastaliq text-white">{t.newLot}</h3>
                <span
                  className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-numbers text-xs font-bold"
                  title={`لاٹ ID: ${upcomingLotNumber}`}
                >
                  رسید #{getLotReceiptNumber(upcomingLotNumber)}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-urdu-sans">
                {t.arrivalDate}: {new Date().toLocaleDateString('en-PK')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-urdu-sans">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Column 1: Vendor Details & Deductions */}
            <div className="space-y-3.5">
              {/* Vendor Details */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-urdu-sans">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.vendor} (زمیندار / بیوپاری کی تفصیلات)</span>
              </h4>
            </div>

            {/* Dynamic Search & Input for Vendor Name */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1 font-urdu-sans flex items-center justify-between">
                <span>{t.vendorName} <span className="text-rose-500">*</span></span>
                {savedVendors.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    {isUrdu ? `(${savedVendors.length} محفوظ شدہ زمیندار)` : `(${savedVendors.length} saved)`}
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={vendorName}
                  onFocus={() => setIsVendorDropdownOpen(true)}
                  onChange={(e) => {
                    setVendorName(e.target.value);
                    setIsVendorDropdownOpen(true);
                    setError(null);
                  }}
                  placeholder={isUrdu ? 'زمیندار کا نام تلاش کریں یا نیا درج کریں...' : 'Search or enter vendor name...'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 font-urdu-sans pr-8 rtl:pl-8 rtl:pr-3"
                  required
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5 rtl:left-2.5 rtl:right-auto top-2.5 pointer-events-none" />
              </div>

              {/* Dynamic Name Search Results Dropdown */}
              {isVendorDropdownOpen && savedVendors.length > 0 && (() => {
                const term = vendorName.trim().toLowerCase();
                const matches = savedVendors.filter(
                  (v) =>
                    !term ||
                    v.name.toLowerCase().includes(term) ||
                    (v.city && v.city.toLowerCase().includes(term)) ||
                    (v.phone && v.phone.includes(term))
                ).slice(0, 8);

                if (matches.length === 0) return null;

                return (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    <div className="p-1.5 bg-slate-50 text-[10px] text-slate-500 font-urdu-sans flex items-center justify-between">
                      <span>{isUrdu ? 'محفوظ شدہ زمیندار (تلاش کے نتائج):' : 'Saved Vendors (search results):'}</span>
                      <button
                        type="button"
                        onClick={() => setIsVendorDropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-600 px-1 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    {matches.map((v) => (
                      <button
                        type="button"
                        key={v.id || v.name}
                        onClick={() => {
                          handleSelectSavedVendor(v);
                          setIsVendorDropdownOpen(false);
                        }}
                        className="w-full text-start p-2.5 hover:bg-emerald-50 flex items-center justify-between transition font-urdu-sans group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                            👤
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-900">
                              {v.name}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                              {v.city && <span>📍 {v.city}</span>}
                              {v.phone && <span className="font-numbers">📞 {v.phone}</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-bold opacity-0 group-hover:opacity-100 transition">
                          {isUrdu ? 'منتخب کریں' : 'Select'}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-urdu-sans flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{t.vendorPhone}</span>
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-numbers"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-urdu-sans flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{t.vendorCity}</span>
                </label>
                <input
                  type="text"
                  value={vendorCity}
                  onChange={(e) => setVendorCity(e.target.value)}
                  placeholder={isUrdu ? 'شہر مثلاً اوکاڑہ' : 'City e.g. Okara'}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-urdu-sans"
                />
              </div>
            </div>

            {/* City Preset Chips */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {cities.map((city) => (
                <button
                  type="button"
                  key={city}
                  onClick={() => setVendorCity(city)}
                  className={`px-2 py-0.5 rounded-lg text-xs transition font-urdu-sans flex-shrink-0 ${
                    vendorCity === city
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>

            {/* Vendor Checkbox Options */}
            <div className="pt-2 border-t border-slate-200/80 space-y-2">
              {/* Keep Vendor & Don't Close (Multi-product entry for same vendor) */}
              <label className="flex items-start gap-2.5 p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-slate-800 cursor-pointer font-urdu-sans select-none hover:bg-emerald-100/60 transition">
                <input
                  type="checkbox"
                  checked={keepVendorAndStayOpen}
                  onChange={(e) => {
                    sound.playTick();
                    setKeepVendorAndStayOpen(e.target.checked);
                  }}
                  className="w-4 h-4 mt-0.5 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500 flex-shrink-0"
                />
                <div>
                  <span className="font-bold text-emerald-950 block">
                    {isUrdu
                      ? 'اسی زمیندار کی دوسری جنس درج کریں (ونڈو بند نہ کریں اور نام محفوظ رکھیں)'
                      : 'Keep vendor details & don\'t close modal (for multiple products from same vendor)'}
                  </span>
                  <p className="text-[11px] text-emerald-800 font-urdu-sans mt-0.5 leading-tight">
                    {isUrdu
                      ? 'اگر ایک ہی زمیندار 2 یا 3 مختلف اجناس (مثلاً آلو اور ٹماٹر) لایا ہو، تو یہ آپشن چیک کریں تاکہ نام بار بار نہ لکھنا پڑے۔'
                      : 'Check this if a vendor brought multiple products (e.g. Potatoes & Tomatoes) to avoid re-typing vendor details.'}
                  </p>
                </div>
              </label>

              {/* Save Vendor to Directory Checkbox */}
              <label className="flex items-center gap-2 px-1 text-xs text-slate-700 cursor-pointer font-urdu-sans select-none">
                <input
                  type="checkbox"
                  checked={saveVendorToDb}
                  onChange={(e) => setSaveVendorToDb(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500"
                />
                <span className="font-medium text-slate-700">{t.saveVendorToDb}</span>
              </label>
            </div>
          </div>

          {/* Initial Deductions Presets (Editable later anytime) */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 font-urdu-sans">
                {t.expensesSection} (ابتدائی کٹوتیاں - بعد میں تبدیل ہو سکتے ہیں)
              </h4>
              <div className="text-[11px] text-emerald-800 font-urdu-sans font-bold bg-emerald-100/70 px-2 py-0.5 rounded-md">
                <span>
                  {t.mazdoori}: {totalQuantity || 0} {getUnitDisplayLabel(unitType, settings.language)} × ₨{mazdooriRate} ={' '}
                  <span className="font-numbers font-extrabold text-emerald-950">
                    ₨{(((Number(totalQuantity) || 0) * mazdooriRate)).toLocaleString('en-US')}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block font-urdu-sans">{t.commission} (%)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseNumber(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-numbers text-center font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block font-urdu-sans">{t.mazdoori} (فی یونٹ)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mazdooriRate}
                  onChange={(e) => setMazdooriRate(parseNumber(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-numbers text-center font-bold"
                />
                {selectedMazdooriTitle && (
                  <span className="block text-[10px] text-emerald-700 font-urdu-sans truncate mt-0.5 font-medium text-center">
                    {selectedMazdooriTitle}
                  </span>
                )}
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block font-urdu-sans">{t.kiraya} (روپے)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={kirayaAmount}
                  onChange={(e) => setKirayaAmount(parseNumber(e.target.value))}
                  placeholder="0"
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-numbers text-center font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block font-urdu-sans">{t.naqdAdvance} (روپے)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(parseNumber(e.target.value))}
                  placeholder="0"
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-numbers text-center font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Product & Packaging & Quantity */}
        <div className="space-y-3.5">
          {/* Product & Packing Selection */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 space-y-2.5 sm:space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-urdu-sans">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.product} (پھل و سبزی انتخاب)</span>
            </h4>

            {/* Product Quick Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {availableProducts.map((prod) => {
                const isSelected =
                  !isOtherProduct &&
                  typeof selectedProduct === 'object' &&
                  ((selectedProduct.id && prod.id && selectedProduct.id === prod.id) ||
                    selectedProduct.nameUrdu === prod.nameUrdu);
                return (
                  <button
                    type="button"
                    key={prod.id || prod.nameUrdu}
                    onClick={() => handleSelectProduct(prod)}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-xl leading-none">{prod.emoji}</span>
                    <span className="text-[11px] truncate w-full font-urdu-sans font-bold">
                      {prod.nameUrdu}
                    </span>
                  </button>
                );
              })}

              {/* "Other" Product Card */}
              <button
                type="button"
                onClick={handleSelectOther}
                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                  isOtherProduct
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold shadow-xs'
                    : 'bg-white border-dashed border-slate-300 hover:bg-amber-50/50 text-slate-700'
                }`}
              >
                <span className="text-xl leading-none">✨</span>
                <span className="text-[11px] font-bold truncate w-full font-urdu-sans text-amber-900">
                  {t.otherProduct}
                </span>
              </button>
            </div>

            {/* If "Other" is selected, render custom inputs */}
            {isOtherProduct && (
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 font-urdu-sans">
                    {t.enterCustomProduct}
                  </span>
                  <span className="text-[10px] text-amber-700 font-urdu-sans">
                    {isUrdu ? 'مثلاً: امرود، مٹر، شملہ مرچ، کینو وغیرہ' : 'e.g. Guava, Peas, Kinnow'}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 font-urdu-sans">
                    {t.productUrduLabel} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customProductUrdu}
                    onChange={(e) => {
                      setCustomProductUrdu(e.target.value);
                      setError(null);
                    }}
                    placeholder="مثلاً: امرود یا سبز مٹر"
                    className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                </div>

                {/* Popular Other Preset Chips */}
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 font-urdu-sans">
                    {isUrdu ? 'تیز رفتار انتخاب:' : 'Quick Presets:'}
                  </label>
                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                    {otherPresets.map((item) => (
                      <button
                        type="button"
                        key={item.urdu}
                        onClick={() => {
                          setCustomProductUrdu(item.urdu);
                          setCustomEmoji(item.emoji);
                          setUnitType(item.unit);
                          setError(null);
                        }}
                        className="px-2 py-0.5 rounded-lg text-xs bg-white hover:bg-amber-100 border border-amber-200 text-slate-800 transition font-urdu-sans flex items-center gap-1 flex-shrink-0"
                      >
                        <span>{item.emoji}</span>
                        <span>{item.urdu}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emoji Selector */}
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1 font-urdu-sans">
                    {t.selectIcon} ({customEmoji}):
                  </label>
                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none bg-white p-1.5 rounded-lg border border-amber-200">
                    {emojiOptions.map((em) => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => setCustomEmoji(em)}
                        className={`w-7 h-7 rounded-md text-base flex items-center justify-center transition flex-shrink-0 ${
                          customEmoji === em ? 'bg-amber-500 text-white shadow-xs' : 'hover:bg-slate-100'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Packaging Unit & Labor Rate Selector (پیکنگ کی قسم و فی یونٹ مزدوری ریٹ) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800 font-urdu-sans flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isUrdu ? 'پیکنگ کی قسم و فی یونٹ مزدوری' : 'Packaging Unit & Labor Rate'}</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-emerald-800 font-urdu-sans font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {selectedMazdooriTitle || getUnitDisplayLabel(unitType, settings.language)}: ₨{mazdooriRate}/یونٹ
                </span>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {getMazdooriItems(settings).map((item) => {
                  const isSelected =
                    selectedMazdooriId === item.id ||
                    (!selectedMazdooriId && mazdooriRate === item.rate && (unitType === item.unitType || selectedMazdooriTitle === cleanUrduTitle(item.title)));
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => handleSelectMazdooriItem(item)}
                      className={`p-2 rounded-xl text-center border font-urdu-sans transition active:scale-95 flex flex-col items-center justify-center gap-0.5 relative ${
                        isSelected
                          ? 'bg-emerald-900 text-white font-bold border-emerald-900 shadow-md ring-2 ring-emerald-500/30'
                          : 'bg-white border-slate-300 text-slate-800 hover:bg-emerald-50 hover:border-emerald-300'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold truncate w-full">{cleanUrduTitle(item.title)}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md font-numbers ${
                          isSelected ? 'bg-emerald-800 text-emerald-100 font-semibold' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        ₨{item.rate}/یونٹ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Total Quantity & Vehicle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-urdu-sans flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>{t.totalQuantity} ({selectedMazdooriTitle || getUnitDisplayLabel(unitType, settings.language)})</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={totalQuantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setTotalQuantity('');
                      } else {
                        const n = parseInt(val, 10);
                        setTotalQuantity(isNaN(n) ? '' : n);
                      }
                    }}
                    placeholder={isUrdu ? 'تعداد' : 'Qty'}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-lg text-slate-900 font-numbers focus:ring-2 focus:ring-emerald-500 text-center"
                    required
                  />
                </div>
                <div className="flex gap-1 mt-1.5">
                  {[10, 25, 50, 100].map((qty) => (
                    <button
                      type="button"
                      key={qty}
                      onClick={() => setTotalQuantity(qty)}
                      className="flex-1 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-100 font-numbers active:scale-95"
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-urdu-sans flex items-center gap-1">
                  <Truck className="w-3 h-3 text-slate-400" />
                  <span>{t.vehicleNumber} (گاڑی / شہزور)</span>
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder={isUrdu ? 'مثلاً: LES-4210 شہزور' : 'e.g. LES-4210 Truck'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-urdu-sans"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>

        {/* Footer Actions */}
        <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200 flex gap-2 sm:gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold text-xs sm:text-sm hover:bg-slate-100 transition font-urdu-sans"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 font-urdu-sans"
          >
            <Check className="w-4 h-4" />
            <span>
              {keepVendorAndStayOpen
                ? isUrdu
                  ? 'محفوظ کریں اور اگلی جنس درج کریں'
                  : 'Save & Enter Next Item'
                : `${t.startBolli} (${t.save})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
