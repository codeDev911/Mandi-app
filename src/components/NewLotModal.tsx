import React, { useState } from 'react';
import { UnitType, AppSettings, VendorLot, SavedVendor } from '../types';
import { translations, commonMandiProducts, unitLabels, ProductPreset } from '../utils/localization';
import { generateLotNumber, calculateLotSummary } from '../utils/calculations';
import { parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { PlusCircle, X, Check, Truck, MapPin, Phone, User, Package, Hash, BookmarkCheck } from 'lucide-react';

interface NewLotModalProps {
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSaveLot: (lot: VendorLot) => void;
  existingLotsCount: number;
  savedVendors?: SavedVendor[];
  onSaveVendor?: (vendor: SavedVendor) => void;
}

export const NewLotModal: React.FC<NewLotModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSaveLot,
  existingLotsCount,
  savedVendors = [],
  onSaveVendor,
}) => {
  const t = translations[settings.language];
  const isUrdu = settings.language === 'ur';

  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorCity, setVendorCity] = useState('');
  const [saveVendorToDb, setSaveVendorToDb] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductPreset | 'other'>(commonMandiProducts[0]);
  const [isOtherProduct, setIsOtherProduct] = useState(false);
  const [customProductUrdu, setCustomProductUrdu] = useState('');
  const [customProductEn, setCustomProductEn] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🥬');
  const [unitType, setUnitType] = useState<UnitType>(commonMandiProducts[0].defaultUnit);
  const [totalQuantity, setTotalQuantity] = useState<number>(30);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(settings.defaultCommissionPercent);
  const [mazdooriRate, setMazdooriRate] = useState<number>(settings.defaultMazdooriPerUnit);
  const [kirayaAmount, setKirayaAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectProduct = (prod: ProductPreset) => {
    sound.playTick();
    setIsOtherProduct(false);
    setSelectedProduct(prod);
    setUnitType(prod.defaultUnit);
    setError(null);
  };

  const handleSelectOther = () => {
    sound.playTick();
    setIsOtherProduct(true);
    setSelectedProduct('other');
    setError(null);
  };

  const otherPresets = [
    { urdu: 'امرود (Guava)', en: 'Guava', emoji: '🍐', unit: 'peti' as UnitType },
    { urdu: 'مٹر (Peas)', en: 'Green Peas', emoji: '🫛', unit: 'theli' as UnitType },
    { urdu: 'شملہ مرچ (Capsicum)', en: 'Capsicum', emoji: '🫑', unit: 'theli' as UnitType },
    { urdu: 'گوبھی (Cauliflower)', en: 'Cauliflower', emoji: '🥦', unit: 'theli' as UnitType },
    { urdu: 'بھنڈی (Ladyfinger)', en: 'Ladyfinger', emoji: '🥬', unit: 'theli' as UnitType },
    { urdu: 'کینو (Kinnow)', en: 'Kinnow Orange', emoji: '🍊', unit: 'peti' as UnitType },
    { urdu: 'خربوزہ (Melon)', en: 'Melon', emoji: '🍈', unit: 'bori' as UnitType },
    { urdu: 'تربوز (Watermelon)', en: 'Watermelon', emoji: '🍉', unit: 'nag' as UnitType },
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

    if (totalQuantity <= 0) {
      setError(isUrdu ? 'براہ کرم صحیح تعداد درج کریں' : 'Please enter valid quantity');
      return;
    }

    const lotNumber = generateLotNumber(existingLotsCount);
    
    let prodName: string;
    let prodUrdu: string;
    let prodEmoji: string;

    if (isOtherProduct) {
      prodUrdu = customProductUrdu.trim();
      prodName = customProductEn.trim() || customProductUrdu.trim();
      prodEmoji = customEmoji;
    } else {
      const preset = selectedProduct as ProductPreset;
      prodName = preset.nameEn;
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
      unitType,
      totalQuantity,
      vehicleNumber: vehicleNumber.trim() || undefined,
      arrivalDate: new Date().toISOString().slice(0, 10),
      status: 'active',
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
          amount: mazdooriRate * totalQuantity,
          enabled: mazdooriRate > 0,
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
          amount: settings.defaultMarketFeePerUnit * totalQuantity,
          enabled: settings.defaultMarketFeePerUnit > 0,
        },
        customExpenses: [],
      },
      summary: {
        totalSoldQuantity: 0,
        remainingQuantity: totalQuantity,
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
    onClose();
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
      <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-5 duration-200">
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden"></div>

        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base font-urdu-nastaliq text-white">{t.newLot}</h3>
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
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-urdu-sans">
              {error}
            </div>
          )}

          {/* Vendor Details */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-urdu-sans">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.vendor} (زمیندار / بیوپاری کی تفصیلات)</span>
              </h4>
            </div>

            {/* Quick Pick Regular Saved Vendors */}
            {savedVendors.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 font-urdu-sans flex items-center gap-1">
                  <BookmarkCheck className="w-3 h-3 text-emerald-600" />
                  <span>{t.selectSavedVendor}</span>
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {savedVendors.map((v) => (
                    <button
                      type="button"
                      key={v.id || v.name}
                      onClick={() => handleSelectSavedVendor(v)}
                      className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-urdu-sans border transition flex-shrink-0 flex items-center gap-1 ${
                        vendorName === v.name
                          ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50'
                      }`}
                    >
                      <span>👤</span>
                      <span>{v.name}</span>
                      {v.city && <span className="text-[10px] opacity-75">({v.city})</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-urdu-sans">
                {t.vendorName} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => {
                  setVendorName(e.target.value);
                  setError(null);
                }}
                placeholder={isUrdu ? 'مثلاً: حاجی محمد اسلم زمیندار' : 'e.g. Haji Aslam Farmer'}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 font-urdu-sans"
                required
              />
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

            {/* Save Vendor to Directory Checkbox */}
            <label className="flex items-center gap-2 pt-1 text-xs text-slate-700 cursor-pointer font-urdu-sans select-none">
              <input
                type="checkbox"
                checked={saveVendorToDb}
                onChange={(e) => setSaveVendorToDb(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-800">{t.saveVendorToDb}</span>
            </label>
          </div>

          {/* Product & Packing Selection */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 space-y-2.5 sm:space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-urdu-sans">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.product} (پھل و سبزی انتخاب)</span>
            </h4>

            {/* Product Quick Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {commonMandiProducts.map((prod) => {
                const isSelected = !isOtherProduct && typeof selectedProduct === 'object' && selectedProduct.nameEn === prod.nameEn;
                return (
                  <button
                    type="button"
                    key={prod.nameEn}
                    onClick={() => handleSelectProduct(prod)}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-xl leading-none">{prod.emoji}</span>
                    <span className="text-[11px] truncate w-full font-urdu-sans">
                      {isUrdu ? prod.nameUrdu.split(' ')[0] : prod.nameEn}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      placeholder="مثلاً: امرود (Guava) یا سبز مٹر"
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-urdu-sans focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1 font-urdu-sans">
                      {t.productEnLabel}
                    </label>
                    <input
                      type="text"
                      value={customProductEn}
                      onChange={(e) => setCustomProductEn(e.target.value)}
                      placeholder="e.g. Guava or Green Peas"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-urdu-sans"
                    />
                  </div>
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
                        key={item.en}
                        onClick={() => {
                          setCustomProductUrdu(item.urdu);
                          setCustomProductEn(item.en);
                          setCustomEmoji(item.emoji);
                          setUnitType(item.unit);
                          setError(null);
                        }}
                        className="px-2 py-0.5 rounded-lg text-xs bg-white hover:bg-amber-100 border border-amber-200 text-slate-800 transition font-urdu-sans flex items-center gap-1 flex-shrink-0"
                      >
                        <span>{item.emoji}</span>
                        <span>{item.urdu.split(' ')[0]}</span>
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

            {/* Packaging Unit Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 font-urdu-sans">
                {t.unitType} (پیکنگ کی قسم)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {(['crates', 'bori', 'theli', 'peti', 'kg', 'nag'] as UnitType[]).map((u) => {
                  const isSelected = unitType === u;
                  return (
                    <button
                      type="button"
                      key={u}
                      onClick={() => setUnitType(u)}
                      className={`py-1.5 px-2 rounded-xl text-xs text-center border font-urdu-sans transition active:scale-95 ${
                        isSelected
                          ? 'bg-slate-900 text-white font-bold border-slate-900 shadow-xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {unitLabels[u][settings.language]}
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
                  <span>{t.totalQuantity} ({unitLabels[unitType][settings.language]})</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(Math.max(1, parseNumber(e.target.value)))}
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

          {/* Initial Deductions Presets (Editable later anytime) */}
          <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 font-urdu-sans">
                {t.expensesSection} (ابتدائی کٹوتیاں - بعد میں تبدیل ہو سکتے ہیں)
              </h4>
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
            <span>{t.startBolli} ({t.save})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
