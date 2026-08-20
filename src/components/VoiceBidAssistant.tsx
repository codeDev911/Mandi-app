import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, PaymentStatus } from '../types';
import { parseUrduVoiceBid, VoiceBolliListener, ParsedVoiceBid } from '../utils/voiceCommandParser';
import { formatPKR } from '../utils/currency';
import { sound } from '../utils/sound';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Radio,
  Banknote,
  CreditCard,
  Plus,
  Minus,
  Check,
} from 'lucide-react';

interface VoiceBidAssistantProps {
  onAddSale: (saleData: {
    buyerName: string;
    buyerPhone?: string;
    quantity: number;
    ratePerUnit: number;
    paymentStatus: PaymentStatus;
    notes?: string;
  }) => void;
  existingBuyers?: string[];
  settings: AppSettings;
  remainingLotQuantity?: number;
  lotProductUrdu?: string;
  unitLabelUrdu?: string;
  onClose?: () => void;
}

export const VoiceBidAssistant: React.FC<VoiceBidAssistantProps> = ({
  onAddSale,
  existingBuyers = [],
  settings,
  remainingLotQuantity = 999,
  lotProductUrdu = 'مال',
  unitLabelUrdu = 'پیٹی / بوری',
  onClose,
}) => {
  const isUrdu = settings.language === 'ur';

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedBid, setParsedBid] = useState<ParsedVoiceBid | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAddedBid, setLastAddedBid] = useState<string | null>(null);

  const listenerRef = useRef<VoiceBolliListener | null>(null);

  // Initialize Speech Listener
  useEffect(() => {
    const listener = new VoiceBolliListener('ur-PK');
    listenerRef.current = listener;

    return () => {
      if (listenerRef.current) {
        listenerRef.current.stopListening();
      }
    };
  }, []);

  const handleToggleListening = () => {
    if (!listenerRef.current) return;

    if (isListening) {
      listenerRef.current.stopListening();
      setIsListening(false);
    } else {
      setErrorMessage(null);
      setTranscript('');
      sound.playPop();

      const started = listenerRef.current.startListening(
        (text, isFinal) => {
          setTranscript(text);
          const parsed = parseUrduVoiceBid(text, existingBuyers);
          setParsedBid(parsed);

          if (parsed.isValid) {
            sound.playKeyClick();
          }

          // When speech segment finishes, stop listening and let user review before hitting save
          if (isFinal) {
            if (listenerRef.current) {
              listenerRef.current.stopListening();
            }
            setIsListening(false);
          }
        },
        (err) => {
          setErrorMessage(err);
          setIsListening(false);
        },
        (listeningState) => {
          setIsListening(listeningState);
        }
      );

      if (!started && !listenerRef.current.isSupported()) {
        setErrorMessage(
          isUrdu
            ? 'آپ کے براؤزر میں وائس فیچر کی اجازت درکار ہے یا سپورٹڈ نہیں ہے'
            : 'Speech recognition is not supported in this browser. Use Chrome/Safari/Edge.'
        );
      }
    }
  };

  const handleSetPaymentStatus = (status: PaymentStatus) => {
    if (!parsedBid) return;
    sound.playTick();
    setParsedBid({
      ...parsedBid,
      paymentStatus: status,
    });
  };

  const handleAdjustQuantity = (delta: number) => {
    if (!parsedBid) return;
    sound.playTick();
    const newQty = Math.max(1, Math.min(remainingLotQuantity, parsedBid.quantity + delta));
    const newTotal = Math.round(newQty * parsedBid.ratePerUnit);
    setParsedBid({
      ...parsedBid,
      quantity: newQty,
      totalAmount: newTotal,
      isValid: newQty > 0 && parsedBid.ratePerUnit > 0 && !!parsedBid.buyerName,
    });
  };

  const handleAdjustRate = (delta: number) => {
    if (!parsedBid) return;
    sound.playTick();
    const newRate = Math.max(0, parsedBid.ratePerUnit + delta);
    const newTotal = Math.round(parsedBid.quantity * newRate);
    setParsedBid({
      ...parsedBid,
      ratePerUnit: newRate,
      totalAmount: newTotal,
      isValid: parsedBid.quantity > 0 && newRate > 0 && !!parsedBid.buyerName,
    });
  };

  // Explicit Save / Commit action triggered by user clicking the Save button
  const executeCommitSale = (bidToCommit: ParsedVoiceBid) => {
    if (!bidToCommit.isValid) return;

    sound.playCashChime();

    onAddSale({
      buyerName: bidToCommit.buyerName,
      quantity: bidToCommit.quantity,
      ratePerUnit: bidToCommit.ratePerUnit,
      paymentStatus: bidToCommit.paymentStatus,
      notes: `🎙️ وائس: "${bidToCommit.rawText}"`,
    });

    const statusLabel = bidToCommit.paymentStatus === 'cash' ? 'نقد' : 'ادھار';
    const summaryText = `${bidToCommit.buyerName} • ${bidToCommit.quantity} ${unitLabelUrdu} @ ${bidToCommit.ratePerUnit} (${statusLabel}) = ₨${bidToCommit.totalAmount.toLocaleString('en-US')}`;
    setLastAddedBid(summaryText);
    setTranscript('');
    setParsedBid(null);
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-emerald-500/40 shadow-xl space-y-3 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-md transition-all ${
            isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-slate-950'
          }`}>
            {isListening ? <Radio className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold font-urdu-nastaliq text-emerald-300">
                {isUrdu ? 'آواز سے بولی اندراج (بولیں اور محفوظ کریں)' : 'Voice Bolli Assistant (Speak & Save)'}
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                {isUrdu ? 'نقد (nakaq) یا ادھار (uddar)' : 'Cash / Credit'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-urdu-sans">
              {isUrdu
                ? 'مثال: "اسلم 2 2300 نقد (nakaq)" یا "طارق 5 1200 ادھار (uddar)"'
                : 'Say e.g.: "Aslam 2 2300 cash" or "Tariq 5 1200 credit"'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="بند کریں"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Listening & Parsing Box */}
      <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Big Toggle Mic Button */}
          <button
            type="button"
            onClick={handleToggleListening}
            className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm font-urdu-sans flex items-center justify-center gap-2 transition shadow-md active:scale-95 ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>سن رہا ہے... (روکنے کے لیے کلک کریں)</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>مائیک آن کریں (Start Voice)</span>
              </>
            )}
          </button>

          {/* Live Transcript Display */}
          <div className="flex-1 min-w-0 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 block text-[10px] font-urdu-sans">
              {isListening ? '🎙️ آواز سن رہا ہے:' : 'موصولہ آواز:'}
            </span>
            <span className="font-urdu-nastaliq text-amber-300 font-bold truncate block">
              {transcript || (isListening ? 'بولیں: نام، تعداد، ریٹ، نقد/ادھار...' : 'مائیک بند ہے (کلک کر کے بولیں)')}
            </span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-2 bg-red-950/80 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2 font-urdu-sans">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Parsed Live Structure Pill Preview with Manual Save */}
        {parsedBid && (
          <div className="p-3 bg-emerald-950/70 border-2 border-emerald-500/60 rounded-xl space-y-2.5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-emerald-300 font-bold font-urdu-sans flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>سمجھا گیا سودا — براہِ کرم جائزہ لیں اور محفوظ کریں:</span>
              </span>

              {/* Payment Type Badges / Switcher */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => handleSetPaymentStatus('cash')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1 ${
                    parsedBid.paymentStatus === 'cash'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="نقد (nakaq / cash)"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>نقد (Nakaq/Cash)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPaymentStatus('credit')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-urdu-sans transition flex items-center gap-1 ${
                    parsedBid.paymentStatus === 'credit'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="ادھار (uddar / credit)"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>ادھار (Uddar/Credit)</span>
                </button>
              </div>
            </div>

            {/* Grid of values */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-urdu-sans">
              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] text-slate-400 block mb-0.5">خریدار (Buyer)</span>
                <strong className="text-white font-urdu-nastaliq text-sm truncate">{parsedBid.buyerName}</strong>
              </div>

              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block mb-0.5">تعداد ({unitLabelUrdu})</span>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAdjustQuantity(-1)}
                    className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
                  >
                    -
                  </button>
                  <strong className="text-amber-300 font-numbers text-base">{parsedBid.quantity}</strong>
                  <button
                    type="button"
                    onClick={() => handleAdjustQuantity(1)}
                    className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block mb-0.5">ریٹ فی یونٹ</span>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustRate(-50)}
                    className="px-1 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-numbers"
                  >
                    -50
                  </button>
                  <strong className="text-amber-300 font-numbers text-sm">
                    {formatPKR(parsedBid.ratePerUnit, settings.currencySymbol, settings.language)}
                  </strong>
                  <button
                    type="button"
                    onClick={() => handleAdjustRate(50)}
                    className="px-1 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-numbers"
                  >
                    +50
                  </button>
                </div>
              </div>

              <div className="bg-emerald-900/90 p-2 rounded-xl border border-emerald-500/60 flex flex-col justify-center">
                <span className="text-[10px] text-emerald-200 block mb-0.5">کل رقم (Total)</span>
                <strong className="text-emerald-300 font-numbers text-base font-black">
                  {formatPKR(parsedBid.totalAmount, settings.currencySymbol, settings.language)}
                </strong>
              </div>
            </div>

            {/* Explicit User Action: Confirm & Save Button */}
            {parsedBid.isValid ? (
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => executeCommitSale(parsedBid)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 rounded-xl font-extrabold text-sm sm:text-base font-urdu-sans transition flex items-center justify-center gap-2 shadow-lg cursor-pointer border border-emerald-400"
                >
                  <CheckCircle2 className="w-5 h-5 text-slate-950" />
                  <span>سودا محفوظ کریں (Save & Add Bid)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setParsedBid(null);
                    setTranscript('');
                  }}
                  className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold font-urdu-sans transition"
                >
                  منسوخ (Cancel)
                </button>
              </div>
            ) : (
              <div className="text-xs text-amber-300 text-center font-urdu-sans p-1.5 bg-amber-950/60 rounded-lg border border-amber-800/60">
                ⚠️ {parsedBid.validationError || 'براہِ کرم نام، تعداد اور ریٹ واضح بولیں'}
              </div>
            )}
          </div>
        )}

        {/* Recently Added Confirmation Pill */}
        {lastAddedBid && (
          <div className="p-2.5 bg-emerald-900/40 border border-emerald-600/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between font-urdu-sans">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="truncate">کامیابی سے محفوظ ہو گیا: <strong>{lastAddedBid}</strong></span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold flex-shrink-0">
              محفوظ شد ✅
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

