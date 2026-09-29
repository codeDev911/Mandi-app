import React, { useState, useEffect, useCallback } from 'react';
import { Lock, KeyRound, AlertTriangle, X, Check } from 'lucide-react';
import { sound } from '../utils/sound';

interface PinPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin: string;
  isUrdu?: boolean;
  title?: string;
  itemDescription?: string;
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPin,
  isUrdu = true,
  title,
  itemDescription,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [error, setError] = useState(false);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setEnteredPin('');
      setError(false);
    }
  }, [isOpen]);

  const targetPin = (correctPin || '1234').trim();

  const handleVerify = useCallback((pinToTest?: string) => {
    const pin = (pinToTest !== undefined ? pinToTest : enteredPin).trim();
    if (pin === targetPin) {
      sound.playPop();
      onSuccess();
      setEnteredPin('');
      setError(false);
      onClose();
    } else {
      sound.playWarning();
      setError(true);
      setEnteredPin('');
    }
  }, [enteredPin, targetPin, onSuccess, onClose]);

  const handleDigitClick = useCallback((digit: string) => {
    sound.playTick();
    setError(false);
    setEnteredPin((prev) => {
      if (prev.length >= 8) return prev;
      const next = prev + digit;
      if (next === targetPin) {
        sound.playPop();
        setTimeout(() => {
          onSuccess();
          setEnteredPin('');
          setError(false);
          onClose();
        }, 100);
      }
      return next;
    });
  }, [targetPin, onSuccess, onClose]);

  const handleBackspace = useCallback(() => {
    sound.playTick();
    setError(false);
    setEnteredPin((prev) => prev.slice(0, -1));
  }, []);

  // Keyboard navigation support for desktop users
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleVerify();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigitClick, handleBackspace, handleVerify, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-rose-900 text-white p-4 flex items-center justify-between border-b border-rose-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/30 text-rose-200 border border-rose-400/40 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base font-urdu-nastaliq text-white">
                {title || (isUrdu ? 'حفاظتی پن کوڈ کی تصدیق' : 'Security PIN Required')}
              </h3>
              <p className="text-[11px] text-rose-200 font-urdu-sans">
                {isUrdu ? 'حذف کرنے کیلئے 4 ہندسوں کا پن درج کریں' : 'Enter PIN to confirm deletion'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-rose-300 hover:text-white hover:bg-rose-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {itemDescription && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-center text-xs font-bold text-rose-900 font-urdu-sans">
              ⚠️ {itemDescription}
            </div>
          )}

          {/* PIN Display Dots */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="flex items-center gap-3">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = enteredPin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      error
                        ? 'border-rose-600 bg-rose-500 animate-shake'
                        : isFilled
                        ? 'border-rose-700 bg-rose-700 scale-110 shadow-xs'
                        : 'border-slate-300 bg-slate-100'
                    }`}
                  />
                );
              })}
            </div>

            {error ? (
              <span className="text-xs text-rose-600 font-bold font-urdu-sans animate-in fade-in">
                {isUrdu ? '❌ غلط پن کوڈ! دوبارہ کوشش کریں' : 'Incorrect PIN! Try again.'}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-urdu-sans">
                {isUrdu ? '(ڈیفالٹ پن: 1234 - کی بورڈ سے بھی ٹائپ کر سکتے ہیں)' : '(Default PIN: 1234 - Keyboard supported)'}
              </span>
            )}
          </div>

          {/* Numeric Keypad for fast touch or desktop clicks */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                type="button"
                key={digit}
                onClick={() => handleDigitClick(digit)}
                className="py-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-900 border border-slate-200 rounded-2xl font-numbers font-bold text-lg text-slate-800 transition active:scale-95 shadow-2xs"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setEnteredPin('');
                setError(false);
              }}
              className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-urdu-sans transition active:scale-95"
            >
              {isUrdu ? 'صاف کریں' : 'Clear'}
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick('0')}
              className="py-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-900 border border-slate-200 rounded-2xl font-numbers font-bold text-lg text-slate-800 transition active:scale-95 shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-bold flex items-center justify-center transition active:scale-95"
            >
              ⌫
            </button>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs font-urdu-sans transition"
            >
              {isUrdu ? 'منسوخ کریں' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => handleVerify()}
              disabled={enteredPin.length === 0}
              className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs font-urdu-sans transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>{isUrdu ? 'تصدیق و حذف' : 'Verify & Delete'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
