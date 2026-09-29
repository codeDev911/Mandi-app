import React from 'react';
import { VendorLot, AppSettings } from '../types';
import { unitLabels, formatFullRealDate } from '../utils/localization';
import { formatPKR } from '../utils/currency';

export interface InsafMandiBillViewProps {
  vendorName: string;
  vendorPhone?: string;
  vendorCity?: string;
  lots: VendorLot[];
  settings: AppSettings;
  dateLabel?: string;
  isAveraged?: boolean;
  billNumber?: string;
  scale?: number;
  className?: string;
}

export const InsafMandiBillView: React.FC<InsafMandiBillViewProps> = ({
  vendorName,
  vendorPhone,
  vendorCity,
  lots,
  settings,
  dateLabel,
  isAveraged = false,
  billNumber,
  className = '',
}) => {
  const isUrdu = settings.language === 'ur';
  const realDate = formatFullRealDate(dateLabel, lots[0]?.arrivalDate);
  const displayBillNo = billNumber || lots[0]?.lotNumber || '101';

  // Aggregate Deductions & Totals
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
    buyerName?: string;
  }> = [];

  if (!isAveraged) {
    lots.forEach((lot) => {
      const uLabel = unitLabels[lot.unitType]?.[settings.language] || unitLabels[lot.unitType]?.ur || 'نگ';
      if (lot.sales && lot.sales.length > 0) {
        lot.sales.forEach((s) => {
          allItems.push({
            lotNumber: lot.lotNumber,
            productUrdu: lot.productUrdu,
            quantity: s.quantity,
            unitLabel: uLabel,
            ratePerUnit: s.ratePerUnit,
            totalAmount: s.totalAmount,
            buyerName: '',
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
    // Averaged bill grouped by product
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
      const uLabel = unitLabels[lot.unitType]?.[settings.language] || unitLabels[lot.unitType]?.ur || 'نگ';

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
        buyerName: 'متعدد خریدار',
      });
    });
  }

  const isFullyPaid = (totalPaid >= totalNetPayable && totalNetPayable > 0) || (allLotsPaid && lots.length > 0);

  // Portrait half-A4 sizing: width 148.5mm and height 210mm
  const minRows = 11;
  const emptyRowsCount = Math.max(0, minRows - allItems.length);

  // Settings values directly from settings (no hardcoded static strings)
  const shopName = settings.shopNameUrdu || settings.shopNameEn || 'کمیشن شاپ';
  const shopAddress = settings.shopAddressUrdu || settings.shopAddressEn || '';
  const arhtiName = settings.arhtiNameUrdu || settings.arhtiNameEn || '';
  const phone1 = settings.shopPhone?.trim() || '';
  const phone2 = settings.shopPhone2?.trim() || '';
  const tarKaPata = settings.tarKaPataUrdu?.trim() || '';

  return (
    <div
      dir="rtl"
      className={`relative mx-auto bg-white text-slate-900 shadow-xl select-none print:shadow-none print:m-0 ${className}`}
      style={{
        width: '148.8mm',
        minWidth: '148.8mm',
        maxWidth: '148.8mm',
        minHeight: '210mm',
        maxHeight: '210mm',
        height: '210mm',
        aspectRatio: '148.8 / 210',
        boxSizing: 'border-box',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        fontFamily: "'Noto Sans Arabic', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Outer Produce Borders Frame in Half-A4 Portrait (148.8mm x 210mm) */}
      <div
        className="flex border border-slate-300 print:border-none box-border overflow-hidden"
        style={{
          width: '148.8mm',
          minWidth: '148.8mm',
          maxWidth: '148.8mm',
          height: '210mm',
          minHeight: '210mm',
          maxHeight: '210mm',
        }}
      >
        {/* Right Vertical Produce Border */}
        <div
          className="w-7 sm:w-8 flex-shrink-0 bg-repeat-y bg-cover bg-center border-l border-slate-200"
          style={{
            backgroundImage: "url('/bill_produce_border.jpg')",
            backgroundSize: '100% auto',
          }}
        />

        {/* Central Bill Content Body */}
        <div className="flex-1 flex flex-col justify-between bg-white px-2 sm:px-3 py-1.5 overflow-hidden box-border">
          {/* 1. TOP HEADER (CLEAN WHITE BACKGROUND - NO MOUNTAIN IMAGE) */}
          <div className="w-full rounded-t-lg border-2 border-red-700 bg-white p-1.5 sm:p-2 flex flex-col justify-between shadow-2xs">
            {/* Top Row: Shop Name Calligraphy in 3D Red */}
            <div className="text-center">
              <h1
                className="text-xl sm:text-2xl md:text-3xl font-black font-urdu-nastaliq tracking-wide leading-tight"
                style={{
                  color: '#dc2626',
                  textShadow:
                    '-1.5px -1.5px 0 #fff, 1.5px -1.5px 0 #fff, -1.5px 1.5px 0 #fff, 1.5px 1.5px 0 #fff, 0 2px 5px rgba(0,0,0,0.3)',
                }}
              >
                {shopName}
              </h1>
            </div>

            {/* Middle Row: Phone Numbers Badge from Settings + Mandi Address */}
            <div className="flex items-center justify-between gap-2 mt-0.5">
              {/* Yellow Phone Badge from Settings */}
              {phone1 ? (
                <div className="bg-[#fef08a] border border-black rounded-md px-1.5 py-0.5 shadow-2xs flex items-center gap-1 flex-shrink-0">
                  <span className="text-slate-900 text-[10px] sm:text-xs">📱</span>
                  <div className="text-[9px] sm:text-[10px] font-black font-numbers text-slate-950 leading-tight">
                    <div>{phone1}</div>
                    {phone2 && <div className="border-t border-slate-400 pt-0.5">{phone2}</div>}
                  </div>
                </div>
              ) : <div className="w-1" />}

              {/* Mandi Address from Settings */}
              {shopAddress ? (
                <div className="text-center flex-1 pr-1 truncate">
                  <span className="text-xs sm:text-sm font-black font-urdu-nastaliq text-slate-900">
                    {shopAddress}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Bottom Row: Proprietor Info & Tar Ka Pata from Settings */}
            {(arhtiName || tarKaPata) ? (
              <div className="text-center border-t border-slate-200 mt-0.5 pt-0.5">
                <span className="text-[10px] sm:text-xs font-bold font-urdu-nastaliq text-slate-800">
                  {arhtiName ? `پروپرائیٹر: ${arhtiName}` : ''}
                  {tarKaPata ? `${arhtiName ? ' • ' : ''}تار کا پتہ: ${tarKaPata}` : ''}
                </span>
              </div>
            ) : null}
          </div>

          {/* 2. SUBHEADER METADATA ROW */}
          <div className="my-1 border-y-2 border-red-700 py-0.5 px-2 flex items-center justify-between text-[11px] sm:text-xs font-bold text-slate-900 bg-white">
            <div className="flex items-center gap-1">
              <span className="text-red-700 font-urdu-nastaliq">نمبر:</span>
              <span className="font-numbers underline font-bold px-1 text-slate-950">
                {displayBillNo}
              </span>
            </div>

            <div className="flex items-center gap-1 flex-1 justify-center px-2 truncate">
              <span className="text-red-700 font-urdu-nastaliq">بل بنام:</span>
              <span className="underline font-bold text-slate-950 font-urdu-nastaliq text-xs sm:text-sm px-1 truncate">
                {vendorName} {vendorCity ? `(${vendorCity})` : ''}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-red-700 font-urdu-nastaliq">السلام علیکم تاریخ:</span>
              <span className="font-numbers underline font-bold px-1 text-slate-950">
                {realDate}
              </span>
            </div>
          </div>

          {/* 3. MAIN RED-RULED TABLE (Landscape Half-A4 Proportions) */}
          <div className="flex-1 flex border-2 border-red-700 bg-white min-h-0">
            {/* LEFT COLUMN: اخراجات (7 Pills + ICS Badge) */}
            <div className="w-[30%] sm:w-[28%] border-l-2 border-red-700 flex flex-col justify-between bg-white">
              <div>
                {/* Column Header */}
                <div className="h-6 sm:h-7 border-b-2 border-red-700 bg-red-50 flex items-center justify-center">
                  <h3 className="text-[11px] sm:text-xs font-black font-urdu-nastaliq text-red-800">
                    اخراجات
                  </h3>
                </div>

                {/* 7 Colorful Badges Stack */}
                <div className="p-1 space-y-1">
                  {/* 1. کمیشن */}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-5 sm:h-6 border border-red-700 rounded bg-white flex items-center justify-center px-1 text-[10px] sm:text-[11px] font-numbers font-bold text-slate-950">
                      {aggregatedExpenses.commission > 0 ? Math.round(aggregatedExpenses.commission).toLocaleString() : ''}
                    </div>
                    <div className="w-12 sm:w-14 h-5 sm:h-6 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-bold font-urdu-sans shadow-2xs flex-shrink-0">
                      کمیشن
                    </div>
                  </div>

                  {/* 2. کرایہ */}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-5 sm:h-6 border border-red-700 rounded bg-white flex items-center justify-center px-1 text-[10px] sm:text-[11px] font-numbers font-bold text-slate-950">
                      {aggregatedExpenses.kiraya > 0 ? Math.round(aggregatedExpenses.kiraya).toLocaleString() : ''}
                    </div>
                    <div className="w-12 sm:w-14 h-5 sm:h-6 rounded-full bg-gradient-to-r from-emerald-600 to-green-700 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-bold font-urdu-sans shadow-2xs flex-shrink-0">
                      کرایہ
                    </div>
                  </div>

                  {/* 3. مزدوری */}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-5 sm:h-6 border border-red-700 rounded bg-white flex items-center justify-center px-1 text-[10px] sm:text-[11px] font-numbers font-bold text-slate-950">
                      {aggregatedExpenses.mazdoori > 0 ? Math.round(aggregatedExpenses.mazdoori).toLocaleString() : ''}
                    </div>
                    <div className="w-12 sm:w-14 h-5 sm:h-6 rounded-full bg-gradient-to-r from-pink-600 to-rose-600 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-bold font-urdu-sans shadow-2xs flex-shrink-0">
                      مزدوری
                    </div>
                  </div>

                  {/* 4. منشیانہ */}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-5 sm:h-6 border border-red-700 rounded bg-white flex items-center justify-center px-1 text-[10px] sm:text-[11px] font-numbers font-bold text-slate-950">
                      {aggregatedExpenses.munshiana > 0 ? Math.round(aggregatedExpenses.munshiana).toLocaleString() : ''}
                    </div>
                    <div className="w-12 sm:w-14 h-5 sm:h-6 rounded-full bg-gradient-to-r from-sky-400 to-cyan-600 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-bold font-urdu-sans shadow-2xs flex-shrink-0">
                      منشیانہ
                    </div>
                  </div>

                  {/* 5. نقد */}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-5 sm:h-6 border border-red-700 rounded bg-white flex items-center justify-center px-1 text-[10px] sm:text-[11px] font-numbers font-bold text-slate-950">
                      {aggregatedExpenses.naqdAdvance > 0 ? Math.round(aggregatedExpenses.naqdAdvance).toLocaleString() : ''}
                    </div>
                    <div className="w-12 sm:w-14 h-5 sm:h-6 rounded-full bg-gradient-to-r from-red-500 to-rose-700 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-bold font-urdu-sans shadow-2xs flex-shrink-0">
                      نقد
                    </div>
                  </div>

                  {/* 6. مارکیٹ فیس */}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-5 sm:h-6 border border-red-700 rounded bg-white flex items-center justify-center px-1 text-[10px] sm:text-[11px] font-numbers font-bold text-slate-950">
                      {aggregatedExpenses.marketFee > 0 ? Math.round(aggregatedExpenses.marketFee).toLocaleString() : ''}
                    </div>
                    <div className="w-12 sm:w-14 h-5 sm:h-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-bold font-urdu-sans shadow-2xs flex-shrink-0">
                       فیس
                    </div>
                  </div>

                  {/* 7. میزان */}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-5 sm:h-6 border-2 border-purple-800 rounded bg-purple-50 flex items-center justify-center px-1 text-[10px] sm:text-[11px] font-numbers font-black text-purple-950">
                      {meezanExpenses > 0 ? Math.round(meezanExpenses).toLocaleString() : '0'}
                    </div>
                    <div className="w-12 sm:w-14 h-5 sm:h-6 rounded-full bg-gradient-to-r from-purple-600 to-purple-900 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-black font-urdu-sans shadow-2xs flex-shrink-0">
                      میزان
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom ICS Trust Badge */}
              <div className="p-1 border-t border-red-700/60 bg-red-50/50 mt-auto">
                <div className="bg-gradient-to-b from-rose-800 to-red-950 border border-amber-400 rounded-lg p-1 text-center shadow-xs">
                  <div className="text-[8px] font-bold font-urdu-nastaliq text-amber-200 leading-tight">
                    آپ کے اعتماد کا نام
                  </div>
                  <div
                    className="text-base sm:text-lg font-black font-mono tracking-wider leading-none"
                    style={{
                      color: '#facc15',
                      textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, 0 2px 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    ICS
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: تفصیل مال بکری & ٹوٹل */}
            <div className="flex-1 flex flex-col justify-between bg-white min-h-0">
              <div className="min-h-0 overflow-hidden">
                {/* Header Row */}
                <div className="h-6 sm:h-7 border-b-2 border-red-700 bg-red-50 flex items-center">
                  <div className="w-20 sm:w-24 h-full border-l-2 border-red-700 flex items-center justify-center">
                    <span className="text-[11px] sm:text-xs font-black font-urdu-nastaliq text-red-800">
                      ٹوٹل
                    </span>
                  </div>
                  <div className="flex-1 h-full flex items-center justify-center">
                    <span className="text-[11px] sm:text-xs font-black font-urdu-nastaliq text-red-800">
                      تفصیل مال بکری
                    </span>
                  </div>
                </div>

                {/* Itemized Sale Rows */}
                <div className="divide-y divide-red-700/60">
                  {allItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="h-6 sm:h-7 flex items-center text-[11px] sm:text-xs font-semibold text-slate-900"
                    >
                      {/* Amount Box */}
                      <div className="w-20 sm:w-24 h-full border-l-2 border-red-700/60 flex items-center justify-center px-1 font-numbers font-bold text-slate-950 text-[11px] sm:text-xs">
                        {Math.round(item.totalAmount).toLocaleString()}
                      </div>

                      {/* Detail Column */}
                      <div className="flex-1 h-full flex items-center justify-between px-2 text-right">
                        <span className="font-urdu-sans font-bold text-slate-900 truncate">
                          {item.productUrdu} {`  `} {item.quantity}  {`  `} {item.unitLabel} {` - `}{Math.round(item.ratePerUnit).toLocaleString()}
                        </span>
                    
                      </div>
                    </div>
                  ))}

                  {/* Empty Ruled Rows */}
                  {Array.from({ length: emptyRowsCount }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="h-6 sm:h-7 flex items-center"
                    >
                      <div className="w-20 sm:w-24 h-full border-l-2 border-red-700/60" />
                      <div className="flex-1 h-full" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom 3 Summary Rows */}
              <div className="border-t-2 border-red-700 font-urdu-sans mt-auto">
                {/* 1. خام بکری (Mauve) */}
                <div className="h-6 sm:h-7 flex items-center bg-[#831843] text-white font-bold border-b border-white/20">
                  <div className="w-20 sm:w-24 h-full border-l-2 border-white/40 flex items-center justify-center px-1 font-numbers text-[11px] sm:text-xs text-amber-200 font-black">
                    {Math.round(totalGross).toLocaleString()}
                  </div>
                  <div className="flex-1 h-full flex items-center justify-center px-2 text-[11px] sm:text-xs font-urdu-nastaliq font-bold">
                    خام بکری
                  </div>
                </div>

                {/* 2. جملہ اخراجات (Navy Blue) */}
                <div className="h-6 sm:h-7 flex items-center bg-[#1e3a8a] text-white font-bold border-b border-white/20">
                  <div className="w-20 sm:w-24 h-full border-l-2 border-white/40 flex items-center justify-center px-1 font-numbers text-[11px] sm:text-xs text-rose-200 font-black">
                    {Math.round(meezanExpenses).toLocaleString()}
                  </div>
                  <div className="flex-1 h-full flex items-center justify-center px-2 text-[11px] sm:text-xs font-urdu-nastaliq font-bold">
                    جملہ اخراجات
                  </div>
                </div>

                {/* 3. پختہ بکری (Bright Green) */}
                <div className="h-7 sm:h-8 flex items-center bg-[#15803d] text-white font-bold">
                  <div className="w-20 sm:w-24 h-full border-l-2 border-white/40 flex items-center justify-center px-1 font-numbers text-xs sm:text-sm text-yellow-300 font-black">
                    {Math.round(totalNetPayable).toLocaleString()}
                  </div>
                  <div className="flex-1 h-full flex items-center justify-center px-2 text-xs sm:text-sm font-urdu-nastaliq font-black">
                    پختہ بکری
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. FOOTER ROW */}
          <div className="mt-1 pt-1 border-t-2 border-red-700 flex items-center justify-between px-1 text-[10px] sm:text-xs text-slate-800">
            {/* Signature */}
            <div className="flex items-center gap-1">
              <span className="font-urdu-nastaliq text-[11px] sm:text-xs text-slate-700">دستخط:</span>
              <span className="inline-block w-20 sm:w-24 border-b-2 border-dotted border-slate-700" />
            </div>

            {/* Bhool Chook Lain Dain */}
            

            {/* Rubber Stamp */}
            <div className="px-1">
              {isFullyPaid ? (
                <div className="border border-red-600 text-red-600 rounded px-1.5 py-0.2 font-black text-xs tracking-wider font-mono transform -rotate-6 select-none">
                  PAID
                </div>
              ) : (
                <div className="border border-amber-600 text-amber-700 rounded px-1.5 py-0.2 font-bold text-[10px] font-urdu-sans transform -rotate-3 select-none">
                  باقی / نابلد
                </div>
              )}
            </div>

            {/* English Branding from Settings */}
            <div className="text-left font-sans leading-tight">
              <div className="text-[10px] sm:text-xs font-black text-blue-900 tracking-wider">
                {settings.shopNameEn ? settings.shopNameEn.slice(0, 14) : 'INSAF'}
              </div>
        
            </div>
          </div>
        </div>

        {/* Left Vertical Produce Border (Mirrored) */}
        <div
          className="w-7 sm:w-8 flex-shrink-0 bg-repeat-y bg-cover bg-center border-r border-slate-200"
          style={{
            backgroundImage: "url('/bill_produce_border.jpg')",
            backgroundSize: '100% auto',
            transform: 'scaleX(-1)',
          }}
        />
      </div>
    </div>
  );
};
