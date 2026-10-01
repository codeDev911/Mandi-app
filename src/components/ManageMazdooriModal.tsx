import React, { useState, useEffect } from 'react';
import { MazdooriRateItem, UnitType, AppSettings } from '../types';
import { unitLabels, resolveUnitType, getUnitDisplayLabel } from '../utils/localization';
import { parseNumber } from '../utils/currency';
import { sound } from '../utils/sound';
import { DEFAULT_MAZDOORI_ITEMS } from '../utils/calculations';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  PackageCheck,
  Tag,
  Save,
  Info,
} from 'lucide-react';

interface ManageMazdooriModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MazdooriRateItem[];
  onSaveItems: (updatedItems: MazdooriRateItem[]) => void;
  settings: AppSettings;
  onSelectAndApply?: (item: MazdooriRateItem) => void;
}

export const ManageMazdooriModal: React.FC<ManageMazdooriModalProps> = ({
  isOpen,
  onClose,
  items: initialItems,
  onSaveItems,
  settings,
  onSelectAndApply,
}) => {
  const isUrdu = settings.language === 'ur';

  const [items, setItems] = useState<MazdooriRateItem[]>(() =>
    initialItems && initialItems.length > 0 ? [...initialItems] : [...DEFAULT_MAZDOORI_ITEMS]
  );

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setItems([...initialItems]);
    }
  }, [initialItems]);

  // New item form state
  const [newTitle, setNewTitle] = useState('');
  const [newRate, setNewRate] = useState<number>(25);
  const [newUnitType, setNewUnitType] = useState<UnitType | ''>('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editRate, setEditRate] = useState<number>(0);
  const [editUnitType, setEditUnitType] = useState<UnitType | ''>('');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast(isUrdu ? 'براہ کرم مزدوری کا عنوان درج کریں' : 'Please enter title');
      return;
    }
    if (newRate <= 0) {
      showToast(isUrdu ? 'براہ کرم صحیح ریٹ درج کریں' : 'Please enter a valid rate');
      return;
    }

    sound.playCashChime();
    const cleanTitle = newTitle.trim();
    const resolvedUnit = (newUnitType as UnitType) || (cleanTitle as UnitType);
    const newItem: MazdooriRateItem = {
      id: `mzd-${Date.now()}`,
      title: cleanTitle,
      rate: newRate,
      unitType: resolvedUnit,
    };

    const updated = [...items, newItem];
    setItems(updated);
    onSaveItems(updated);

    setNewTitle('');
    setNewRate(25);
    setNewUnitType('');
    showToast(isUrdu ? 'نیا مزدوری ریٹ شامل ہو گیا!' : 'New labor rate added!');
  };

  const handleStartEdit = (item: MazdooriRateItem) => {
    sound.playTick();
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditRate(item.rate);
    setEditUnitType(item.unitType || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editTitle.trim()) {
      showToast(isUrdu ? 'عنوان خالی نہیں ہو سکتا' : 'Title cannot be empty');
      return;
    }
    if (editRate <= 0) {
      showToast(isUrdu ? 'صحیح ریٹ درج کریں' : 'Enter valid rate');
      return;
    }

    sound.playPop();
    const cleanTitle = editTitle.trim();
    const resolvedUnit = (editUnitType as UnitType) || (cleanTitle as UnitType);
    const updated = items.map((it) =>
      it.id === id
        ? {
            ...it,
            title: cleanTitle,
            rate: editRate,
            unitType: resolvedUnit,
          }
        : it
    );
    setItems(updated);
    onSaveItems(updated);
    setEditingId(null);
    showToast(isUrdu ? 'مزدوری ریٹ اپ ڈیٹ ہو گیا!' : 'Labor rate updated!');
  };

  const handleDeleteItem = (id: string) => {
    sound.playTrash();
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    onSaveItems(updated);
    showToast(isUrdu ? 'ریٹ حذف کر دیا گیا' : 'Rate deleted');
  };

  const handleResetDefaults = () => {
    if (
      confirm(
        isUrdu
          ? 'کیا آپ مزدوری ریٹس کو ڈیفالٹ فہرست پر بحال کرنا چاہتے ہیں؟'
          : 'Reset all mazdoori rates to default list?'
      )
    ) {
      sound.playCashChime();
      const updated = [...DEFAULT_MAZDOORI_ITEMS];
      setItems(updated);
      onSaveItems(updated);
      showToast(isUrdu ? 'ڈیفالٹ ریٹس بحال ہو گئے!' : 'Reset to default rates!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-600">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <PackageCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base font-urdu-sans leading-tight">
                {isUrdu ? 'فی یونٹ مزدوری ریٹس و عنوانات کا انتظام' : 'Manage Mazdoori per Unit Rates'}
              </h3>
              <p className="text-[11px] text-emerald-200 font-urdu-sans">
                {isUrdu
                  ? 'نیا ریٹ شامل کریں، نام و رقم تبدیل کریں یا ختم کریں'
                  : 'Add, edit, or remove labor titles & unit rates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white text-xs font-bold font-urdu-sans py-2 px-4 text-center animate-in slide-in-from-top">
            {toastMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Add New Item Box */}
          <form
            onSubmit={handleAddItem}
            className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2.5 shadow-2xs"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 font-urdu-sans">
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>{isUrdu ? 'نیا مزدوری عنوان و ریٹ شامل کریں:' : 'Add New Mazdoori Title & Rate:'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold text-slate-700 block mb-1 font-urdu-sans">
                  {isUrdu ? 'عنوان / نام:' : 'Title / Name:'}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isUrdu ? 'مثلاً: بڑی بوری یا ٹرالی اترائی' : 'e.g. Large Bori'}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-urdu-sans font-bold focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-bold text-slate-700 block mb-1 font-urdu-sans">
                  {isUrdu ? 'ریٹ فی یونٹ (₨):' : 'Rate / Unit (Rs):'}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={newRate}
                  onChange={(e) => setNewRate(parseNumber(e.target.value))}
                  className="w-full px-2 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-numbers font-bold text-center text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="sm:col-span-4 flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 font-urdu-sans shadow-xs active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isUrdu ? 'شامل کریں (+)' : 'Add Rate'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* List of Existing Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-urdu-sans font-bold px-1">
              <span>
                {isUrdu ? `کل موجودہ مزدوری کی اقسام (${items.length}):` : `Configured Rates (${items.length}):`}
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-normal hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isUrdu ? 'ڈیفالٹ بحال کریں' : 'Reset Defaults'}</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs font-urdu-sans">
                {isUrdu ? 'کوئی مزدوری ریٹ موجود نہیں ہے۔ اوپر سے شامل کریں۔' : 'No rates found. Add one above.'}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
                {items.map((item, idx) => {
                  const isEditing = editingId === item.id;

                  if (isEditing) {
                    return (
                      <div
                        key={item.id}
                        className="bg-amber-50 p-2.5 rounded-xl border border-amber-300 flex flex-col sm:flex-row items-center gap-2 shadow-xs"
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-amber-400 rounded-lg text-xs font-bold font-urdu-sans"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-500 font-numbers">₨</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={editRate}
                            onChange={(e) => setEditRate(parseNumber(e.target.value))}
                            className="w-20 px-2 py-1.5 bg-white border border-amber-400 rounded-lg text-xs font-bold font-numbers text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-urdu-sans flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isUrdu ? 'محفوظ' : 'Save'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold font-urdu-sans"
                          >
                            {isUrdu ? 'منسوخ' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="bg-white hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 transition group shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 font-urdu-sans truncate">
                            {item.title}
                          </div>
                          {item.unitType && item.unitType !== item.title && (
                            <span className="text-[10px] text-slate-400 font-urdu-sans">
                              (بنیادی یونٹ: {getUnitDisplayLabel(item.unitType)})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-black font-numbers text-emerald-900">
                          ₨{item.rate}
                          <span className="text-[10px] text-slate-500 font-urdu-sans font-normal mr-1">/یونٹ</span>
                        </div>

                        {onSelectAndApply && (
                          <button
                            type="button"
                            onClick={() => {
                              sound.playTick();
                              onSelectAndApply(item);
                              onClose();
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold font-urdu-sans transition shadow-2xs"
                            title="یہ ریٹ منتخب کریں"
                          >
                            {isUrdu ? 'منتخب کریں' : 'Select'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition"
                          title="ترمیم کریں"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition"
                          title="حذف کریں"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs font-urdu-sans text-blue-950 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                {isUrdu ? 'رہنمائی برائے نئی لاٹ اندراج:' : 'New Lot Note:'}
              </span>
              <p className="text-[11px] text-blue-900 mt-0.5">
                {isUrdu
                  ? 'یہ تمام ریٹس نئی لاٹ کے اندراج (New Lot Modal) میں خودکار طور پر دستیاب ہوں گے۔ جب آپ کوئی جنس یا پیکنگ تبدیل کریں گے تو متعلقہ ریٹ خود بخود لگ جائے گا، یا آپ دستی طور پر کسی بھی ریٹ کا انتخاب کر سکیں گے۔'
                  : 'All these rates are instantly available in the New Lot Entry modal. Selecting a commodity or unit automatically loads its rate, or you can pick any rate manually.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-urdu-sans">
            {isUrdu ? 'تبدیلیاں خودکار طور پر محفوظ ہو جاتی ہیں' : 'Changes save automatically'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-urdu-sans transition active:scale-95"
          >
            {isUrdu ? 'مکمل / بند کریں' : 'Done / Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
