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
  Zap,
  WifiOff,
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
  lotProductUrdu = 'Item',
  unitLabelUrdu = 'Units',
  onClose,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedBid, setParsedBid] = useState<ParsedVoiceBid | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastAddedBid, setLastAddedBid] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Fast-tap manual state for instant offline entry
  const [fastBuyer, setFastBuyer] = useState(existingBuyers[0] || 'Walk-in Buyer');
  const [fastQty, setFastQty] = useState(1);
  const [fastRate, setFastRate] = useState(1000);
  const [fastPayment, setFastPayment] = useState<PaymentStatus>('credit');

  const listenerRef = useRef<VoiceBolliListener | null>(null);

  // Initialize Speech Listener
  useEffect(() => {
    const listener = new VoiceBolliListener('ur-PK');
    listenerRef.current = listener;

    const handleOnlineStatus = () => {
      setIsOfflineMode(!navigator.onLine);
    };

    if (typeof window !== 'undefined') {
      setIsOfflineMode(!navigator.onLine);
      window.addEventListener('online', handleOnlineStatus);
      window.addEventListener('offline', handleOnlineStatus);
    }

    return () => {
      if (listenerRef.current) {
        listenerRef.current.stopListening();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnlineStatus);
        window.removeEventListener('offline', handleOnlineStatus);
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
          setIsOfflineMode(true);
        },
        (listeningState) => {
          setIsListening(listeningState);
        }
      );

      if (!started && !listenerRef.current.isSupported()) {
        setErrorMessage('Speech recognition is not supported on this browser. Use Chrome, Safari, or the Quick Tap pad below.');
        setIsOfflineMode(true);
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

  const executeCommitSale = (bidToCommit: ParsedVoiceBid) => {
    if (!bidToCommit.isValid) return;
    sound.playCashChime();

    onAddSale({
      buyerName: bidToCommit.buyerName,
      quantity: bidToCommit.quantity,
      ratePerUnit: bidToCommit.ratePerUnit,
      paymentStatus: bidToCommit.paymentStatus,
      notes: `Voice Bid: "${bidToCommit.rawText || ''}"`,
    });

    const statusLabel = bidToCommit.paymentStatus === 'cash' ? 'Cash' : 'Credit';
    const summaryText = `${bidToCommit.buyerName} • ${bidToCommit.quantity} ${unitLabelUrdu} @ Rs.${bidToCommit.ratePerUnit.toLocaleString()} (${statusLabel}) = Rs.${bidToCommit.totalAmount.toLocaleString()}`;
    setLastAddedBid(summaryText);
    setTranscript('');
    setParsedBid(null);
  };

  const handleQuickAddSale = () => {
    if (!fastBuyer.trim() || fastQty <= 0 || fastRate <= 0) return;
    sound.playCashChime();

    const total = fastQty * fastRate;
    onAddSale({
      buyerName: fastBuyer.trim(),
      quantity: fastQty,
      ratePerUnit: fastRate,
      paymentStatus: fastPayment,
      notes: 'Quick Tap Sale',
    });

    const statusLabel = fastPayment === 'cash' ? 'Cash' : 'Credit';
    setLastAddedBid(`${fastBuyer} • ${fastQty} ${unitLabelUrdu} @ Rs.${fastRate.toLocaleString()} (${statusLabel}) = Rs.${total.toLocaleString()}`);
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-slate-700 shadow-xl space-y-3">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-md transition-all ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-slate-950'
            }`}
          >
            {isListening ? <Radio className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-emerald-300">
                Voice Bolli & Quick-Bid Assistant
              </h4>
              {isOfflineMode && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline Fast Mode</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300">
              Speak: Buyer name, quantity, rate, cash or credit (e.g. "Aslam 5 2200 cash")
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Listening & Parsing Box */}
      <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Big Toggle Mic Button */}
          <button
            type="button"
            onClick={handleToggleListening}
            className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-95 ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Listening... (Click to Stop)</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Start Microphone</span>
              </>
            )}
          </button>

          {/* Live Transcript Display */}
          <div className="flex-1 min-w-0 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 block text-[10px]">
              {isListening ? '🎙️ Speech Detected:' : 'Voice Input:'}
            </span>
            <span className="text-amber-300 font-bold truncate block">
              {transcript || (isListening ? 'Listening for buyer, qty, rate, cash/credit...' : 'Microphone idle (Click Start Microphone to speak)')}
            </span>
          </div>
        </div>

        {/* Error / Offline Helper */}
        {errorMessage && (
          <div className="p-2.5 bg-amber-950/80 border border-amber-800/60 rounded-xl text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOfflineMode(true)}
              className="text-[11px] font-bold text-emerald-400 underline"
            >
              Use Quick-Tap Pad
            </button>
          </div>
        )}

        {/* Parsed Live Structure Pill Preview with Manual Save */}
        {parsedBid && (
          <div className="p-3 bg-emerald-950/70 border-2 border-emerald-500/60 rounded-xl space-y-2.5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Parsed Bid — Review & Confirm:</span>
              </span>

              {/* Payment Type Badges / Switcher */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => handleSetPaymentStatus('cash')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    parsedBid.paymentStatus === 'cash'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPaymentStatus('credit')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    parsedBid.paymentStatus === 'credit'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Credit</span>
                </button>
              </div>
            </div>

            {/* Grid of values */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex flex-col justify-center">
                <span className="text-[10px] text-slate-400 block mb-0.5">Buyer</span>
                <strong className="text-white text-sm truncate">{parsedBid.buyerName}</strong>
              </div>

              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block mb-0.5">Qty ({unitLabelUrdu})</span>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAdjustQuantity(-1)}
                    className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
                  >
                    -
                  </button>
                  <strong className="text-amber-300 text-base">{parsedBid.quantity}</strong>
                  <button
                    type="button"
                    onClick={() => handleAdjustQuantity(1)}
                    className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 block mb-0.5">Rate / Unit</span>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustRate(-50)}
                    className="px-1 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                  >
                    -50
                  </button>
                  <strong className="text-amber-300 text-sm">
                    Rs.{parsedBid.ratePerUnit.toLocaleString()}
                  </strong>
                  <button
                    type="button"
                    onClick={() => handleAdjustRate(50)}
                    className="px-1 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                  >
                    +50
                  </button>
                </div>
              </div>

              <div className="bg-emerald-900 p-2 rounded-xl border border-emerald-500/60 flex flex-col justify-center">
                <span className="text-[10px] text-emerald-200 block mb-0.5">Total Amount</span>
                <strong className="text-emerald-300 text-base font-black">
                  Rs.{parsedBid.totalAmount.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Confirm & Save Button */}
            {parsedBid.isValid ? (
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => executeCommitSale(parsedBid)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 rounded-xl font-extrabold text-sm sm:text-base transition flex items-center justify-center gap-2 shadow-lg cursor-pointer border border-emerald-400"
                >
                  <CheckCircle2 className="w-5 h-5 text-slate-950" />
                  <span>Confirm & Save Bid</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playTick();
                    setParsedBid(null);
                    setTranscript('');
                  }}
                  className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="text-xs text-amber-300 text-center p-1.5 bg-amber-950/60 rounded-lg border border-amber-800/60">
                ⚠️ {parsedBid.validationError || 'Please speak buyer name, quantity, and rate clearly'}
              </div>
            )}
          </div>
        )}

        {/* Offline 1-Tap Fast Pad */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold flex items-center gap-1.5 text-slate-200">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Offline Rapid Entry Pad (Works 100% with no Internet):</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {/* Buyer Selection */}
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Buyer Name</label>
              <input
                type="text"
                value={fastBuyer}
                onChange={(e) => setFastBuyer(e.target.value)}
                placeholder="Buyer Name"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              />
              {existingBuyers.length > 0 && (
                <div className="flex gap-1 overflow-x-auto pt-1 pb-0.5">
                  {existingBuyers.slice(0, 4).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setFastBuyer(b)}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] whitespace-nowrap"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Qty Selection with +1, +5, +10 */}
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Quantity</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max={remainingLotQuantity}
                  value={fastQty}
                  onChange={(e) => setFastQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-center text-white"
                />
              </div>
              <div className="flex gap-1 pt-1">
                {[1, 5, 10, 25].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setFastQty(q)}
                    className="flex-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Rate Selection */}
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Rate (Rs.)</label>
              <input
                type="number"
                min="10"
                step="50"
                value={fastRate}
                onChange={(e) => setFastRate(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-center text-white"
              />
              <div className="flex gap-1 pt-1">
                {[-100, -50, +50, +100].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => setFastRate((r) => Math.max(0, r + delta))}
                    className="flex-1 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment & Add Button */}
            <div className="flex flex-col justify-end gap-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setFastPayment('credit')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold ${
                    fastPayment === 'credit' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Credit
                </button>
                <button
                  type="button"
                  onClick={() => setFastPayment('cash')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold ${
                    fastPayment === 'cash' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Cash
                </button>
              </div>

              <button
                type="button"
                onClick={handleQuickAddSale}
                className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition"
              >
                + Add Sale (Rs.{(fastQty * fastRate).toLocaleString()})
              </button>
            </div>
          </div>
        </div>

        {/* Recently Added Confirmation */}
        {lastAddedBid && (
          <div className="p-2.5 bg-emerald-950 border border-emerald-600/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="truncate">Saved Sale: <strong>{lastAddedBid}</strong></span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold flex-shrink-0">
              Saved
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
