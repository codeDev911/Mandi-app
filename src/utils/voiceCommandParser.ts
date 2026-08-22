import { PaymentStatus } from '../types';

export interface ParsedVoiceBid {
  rawText: string;
  buyerName: string;
  quantity: number;
  ratePerUnit: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  notes?: string;
  confidence: number;
  isValid: boolean;
  validationError?: string;
}

// Urdu words to numbers mapping
const urduWordsMap: Record<string, number> = {
  // 1 to 20
  'ایک': 1,
  'دو': 2,
  'تین': 3,
  'چار': 4,
  'پانچ': 5,
  'چھ': 6,
  'سات': 7,
  'آٹھ': 8,
  'نو': 9,
  'دس': 10,
  'گیارہ': 11,
  'بارہ': 12,
  'تیرہ': 13,
  'چودہ': 14,
  'پندرہ': 15,
  'سولہ': 16,
  'سترہ': 17,
  'اٹھارہ': 18,
  'انیس': 19,
  'بیس': 20,
  // 21 to 30
  'اکیس': 21,
  'بائیس': 22,
  'تئیس': 23,
  'چوبیس': 24,
  'پچیس': 25,
  'چھبیس': 26,
  'ستائیس': 27,
  'اٹھائیس': 28,
  'انتیس': 29,
  'تیس': 30,
  // Tens
  'پینتیس': 35,
  'چالیس': 40,
  'پینتالیس': 45,
  'پچاس': 50,
  'پچپن': 55,
  'ساٹھ': 60,
  'پینسٹھ': 65,
  'ستر': 70,
  'پچھتر': 75,
  'اسی': 80,
  'پچاسی': 85,
  'نوے': 90,
  'پچانوے': 95,
  // Hundreds & Combined
  'سو': 100,
  'ایک سو': 100,
  'ڈیڑھ سو': 150,
  'دو سو': 200,
  'ڈھائی سو': 250,
  'تین سو': 300,
  'ساڑھے تین سو': 350,
  'چار سو': 400,
  'ساڑھے چار سو': 450,
  'پانچ سو': 500,
  'ساڑھے پانچ سو': 550,
  'چھ سو': 600,
  'سات سو': 700,
  'آٹھ سو': 800,
  'نو سو': 900,
  // Thousands & Combined common Mandi terms
  'ہزار': 1000,
  'ایک ہزار': 1000,
  'گیارہ سو': 1100,
  'بارہ سو': 1200,
  'تیرہ سو': 1300,
  'چودہ سو': 1400,
  'پندرہ سو': 1500,
  'ڈیڑھ ہزار': 1500,
  'سولہ سو': 1600,
  'سترہ سو': 1700,
  'اٹھارہ سو': 1800,
  'انیس سو': 1900,
  'دو ہزار': 2000,
  'اکیس سو': 2100,
  'بائیس سو': 2200,
  'تئیس سو': 2300,
  'چوبیس سو': 2400,
  'پچیس سو': 2500,
  'ڈھائی ہزار': 2500,
  'چھبیس سو': 2600,
  'ستائیس سو': 2700,
  'اٹھائیس سو': 2800,
  'انتیس سو': 2900,
  'تین ہزار': 3000,
  'بتیس سو': 3200,
  'پینتیس سو': 3500,
  'ساڑھے تین ہزار': 3500,
  'چار ہزار': 4000,
  'پینتالیس سو': 4500,
  'ساڑھے چار ہزار': 4500,
  'پانچ ہزار': 5000,
  'چھ ہزار': 6000,
  'سات ہزار': 7000,
  'آٹھ ہزار': 8000,
  'نو ہزار': 9000,
  'دس ہزار': 10000,
};

// Converts Eastern Arabic / Persian digits (۰۱۲۳۴۵۶۷۸۹) to standard ASCII numbers
export function normalizeEasternDigits(text: string): string {
  return text
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
}

/**
 * Parses spoken Urdu/English voice input into structured Bolli Sale bids.
 * Example inputs:
 *  - "اسلم 2 2300" -> Buyer: اسلم, Qty: 2, Rate: 2300
 *  - "طارق 5 پیٹی 1200 نقد" -> Buyer: طارق, Qty: 5, Rate: 1200, Status: paid
 *  - "rashid 10 450" -> Buyer: rashid, Qty: 10, Rate: 450, Status: pending
 *  - "بلال دو بوری پندرہ سو" -> Buyer: بلال, Qty: 2, Rate: 1500
 *  - "حاجی اصغر 20 crate at 1800 cash" -> Buyer: حاجی اصغر, Qty: 20, Rate: 1800, Status: paid
 */
export function parseUrduVoiceBid(
  rawTranscript: string,
  existingBuyers: string[] = []
): ParsedVoiceBid {
  if (!rawTranscript || !rawTranscript.trim()) {
    return {
      rawText: rawTranscript,
      buyerName: '',
      quantity: 0,
      ratePerUnit: 0,
      totalAmount: 0,
      paymentStatus: 'credit',
      confidence: 0,
      isValid: false,
      validationError: 'کوئی آواز موصول نہیں ہوئی',
    };
  }

  let text = normalizeEasternDigits(rawTranscript.trim());

  // 1. Detect Payment Status Keywords (Urdu + Roman Urdu + English)
  // Supports "nakaq", "naqad", "cash", "rokra", "نقد" for Cash
  // Supports "uddar", "udhar", "credit", "khata", "ادھار" for Credit
  let paymentStatus: PaymentStatus = 'credit'; // default

  const cashKeywords = [
    'نقد',
    'نقدی',
    'روکڑا',
    'روکڑہ',
    'کیش',
    'ادا شدہ',
    'ادا',
    'nakaq',
    'naqad',
    'nakad',
    'nakat',
    'naqd',
    'naqadh',
    'cash',
    'paid',
    'rokra',
    'rockra',
  ];

  const creditKeywords = [
    'ادھار',
    'ادہار',
    'ادھاری',
    'کھاتہ',
    'کھاتے',
    'بقایا',
    'قرض',
    'uddar',
    'udhar',
    'udaar',
    'udhaar',
    'udhaari',
    'udar',
    'credit',
    'khata',
    'pending',
    'baqaya',
    'karz',
  ];

  // Helper to match and strip keyword cleanly (works for Unicode Urdu & Roman words)
  const matchAndRemoveKeyword = (sourceText: string, words: string[]): { matched: boolean; newText: string } => {
    let current = sourceText;
    let found = false;
    for (const kw of words) {
      // Escape any special regex chars
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match keyword with start/end of string or whitespace / punctuation boundaries
      const pattern = new RegExp(`(?:^|\\s|[.,،؛!؟])(${escaped})(?:$|\\s|[.,،؛!؟])`, 'i');
      if (pattern.test(current)) {
        found = true;
        current = current.replace(pattern, ' ').trim();
      }
    }
    return { matched: found, newText: current };
  };

  const cashCheck = matchAndRemoveKeyword(text, cashKeywords);
  if (cashCheck.matched) {
    paymentStatus = 'cash';
    text = cashCheck.newText;
  } else {
    const creditCheck = matchAndRemoveKeyword(text, creditKeywords);
    if (creditCheck.matched) {
      paymentStatus = 'credit';
      text = creditCheck.newText;
    }
  }

  // 2. Remove filler packaging/unit words that don't contribute to values
  const fillerUnitWords = [
    'کریٹ', 'کریٹس', 'پیٹی', 'پیٹیاں', 'بوری', 'بوریاں', 'توڑا', 'توڑے', 'تورڑہ', 'تورڑے',
    'کینچی', 'کینچیاں', 'شاپر', 'شاپرز', 'ڈبہ', 'ڈبے', 'کاٹن', 'کلو', 'من', 'عدد', 'تھیلی', 'تھلیاں', 'نگ', 'نشان',
    'bori', 'tora', 'kainchi', 'shopper', 'theli', 'peti', 'crate', 'crates', 'box', 'boxes',
    'bag', 'bags', 'kg', 'qty', 'rate', 'price', 'rupees', 'rs', 'روپے',
    'والی', 'والا', 'میں', 'کا', 'کو', 'پر', 'والے', 'at', 'for', 'buy', 'bought'
  ];

  for (const filler of fillerUnitWords) {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s|[.,،؛!؟])(${escaped})(?:$|\\s|[.,،؛!؟])`, 'gi');
    text = text.replace(regex, ' ').trim();
  }

  // 3. Replace known Urdu number words with digits where appropriate
  // Sort Urdu keys by length descending to match multi-word numbers first (e.g., "پندرہ سو" before "سو")
  const sortedUrduKeys = Object.keys(urduWordsMap).sort((a, b) => b.length - a.length);
  for (const word of sortedUrduKeys) {
    if (text.includes(word)) {
      const numVal = urduWordsMap[word];
      // Replace only as distinct word
      text = text.replace(new RegExp(`(^|\\s)${word}(\\s|$)`, 'g'), `$1${numVal}$2`);
    }
  }

  // Normalize spaces
  text = text.replace(/\s+/g, ' ').trim();

  // 4. Tokenize and extract Buyer, Quantity, and Rate
  const tokens = text.split(' ').filter(Boolean);

  let buyerName = '';
  let quantity = 0;
  let ratePerUnit = 0;

  const numbersFound: number[] = [];
  const nameParts: string[] = [];

  for (const token of tokens) {
    const cleanNum = token.replace(/[^0-9.]/g, '');
    const isNum = cleanNum.length > 0 && !isNaN(Number(cleanNum));

    if (isNum) {
      numbersFound.push(Number(cleanNum));
    } else {
      nameParts.push(token);
    }
  }

  // Check if known buyer matches name parts
  buyerName = nameParts.join(' ').trim();

  // If no buyer name was extracted, try finding from existing buyers list
  if (!buyerName && existingBuyers.length > 0) {
    for (const buyer of existingBuyers) {
      if (rawTranscript.toLowerCase().includes(buyer.toLowerCase())) {
        buyerName = buyer;
        break;
      }
    }
  }

  // Extract Quantity and Rate
  if (numbersFound.length >= 2) {
    // In Mandi parlance: Quantity is usually smaller (e.g. 1-200), Rate is price per unit (e.g. 100-10000)
    // First number is typically quantity, second is rate (e.g. "اسلم 2 2300")
    quantity = numbersFound[0];
    ratePerUnit = numbersFound[1];

    // If order was inverted (e.g. "2300 ریٹ 2 بوری"), swap if first is abnormally large and second is small
    if (quantity > 1000 && ratePerUnit <= 50) {
      const temp = quantity;
      quantity = ratePerUnit;
      ratePerUnit = temp;
    }
  } else if (numbersFound.length === 1) {
    // Only one number was spoken: assume quantity = 1 and number is rate, or number is quantity
    if (numbersFound[0] > 100) {
      quantity = 1;
      ratePerUnit = numbersFound[0];
    } else {
      quantity = numbersFound[0];
      ratePerUnit = 0;
    }
  }

  // Clean buyer name
  if (!buyerName) {
    buyerName = 'عام گاہک (General Buyer)';
  }

  // Calculate total
  const totalAmount = Math.round(quantity * ratePerUnit);

  // Validation
  let isValid = true;
  let validationError = '';

  if (quantity <= 0) {
    isValid = false;
    validationError = 'تعداد (Quantity) سمجھ نہیں آئی';
  } else if (ratePerUnit <= 0) {
    isValid = false;
    validationError = 'ریٹ فی یونٹ (Rate) درج نہیں ہو سکا';
  } else if (!buyerName) {
    isValid = false;
    validationError = 'خریدار کا نام درج کریں';
  }

  return {
    rawText: rawTranscript,
    buyerName,
    quantity,
    ratePerUnit,
    totalAmount,
    paymentStatus,
    confidence: isValid ? 0.95 : 0.4,
    isValid,
    validationError,
  };
}

/**
 * Speech Recognition Wrapper for Web & Mobile Browsers
 */
export class VoiceBolliListener {
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onStateChangeCallback: ((isListening: boolean) => void) | null = null;
  private currentLanguage: string = 'ur-PK';

  constructor(language: 'ur-PK' | 'en-US' = 'ur-PK') {
    this.currentLanguage = language;
    this.initRecognition(language);
  }

  private initRecognition(lang: string) {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition();
          // continuous = false is much more compatible with offline on-device speech engines
          this.recognition.continuous = false;
          this.recognition.interimResults = true;
          this.recognition.lang = lang;
          this.recognition.maxAlternatives = 3;

          this.recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscript += transcript;
              } else {
                interimTranscript += transcript;
              }
            }

            const activeText = finalTranscript || interimTranscript;
            if (this.onResultCallback && activeText.trim()) {
              this.onResultCallback(activeText, !!finalTranscript);
            }
          };

          this.recognition.onerror = (event: any) => {
            console.warn('Speech recognition event error:', event.error);
            let userMsg = 'Voice recognition error';
            if (event.error === 'not-allowed' || event.error === 'permission-denied') {
              userMsg = 'Microphone permission required';
            } else if (event.error === 'network') {
              // Try fallback to device default language for offline model
              if (this.recognition && this.recognition.lang === 'ur-PK') {
                try {
                  console.log('Trying offline system speech language fallback...');
                  this.recognition.lang = navigator.language || 'en-US';
                  this.recognition.start();
                  return;
                } catch {
                  userMsg = 'Offline: Please enable on-device voice typing or use Quick Tap';
                }
              } else {
                userMsg = 'Offline voice typing: Use Gboard on-device voice or Quick Tap';
              }
            } else if (event.error === 'no-speech') {
              userMsg = 'No speech detected, please try again';
            }

            if (this.onErrorCallback) {
              this.onErrorCallback(userMsg);
            }
          };

          this.recognition.onend = () => {
            this.isListening = false;
            if (this.onStateChangeCallback) {
              this.onStateChangeCallback(false);
            }
          };
        } catch (e) {
          console.warn('Could not initialize SpeechRecognition:', e);
        }
      }
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public setLanguage(lang: 'ur-PK' | 'en-US'): void {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
    onStateChange?: (isListening: boolean) => void
  ): boolean {
    if (!this.recognition) {
      if (onError) onError('اس براؤزر میں وائس ریکگنیشن سپورٹڈ نہیں ہے');
      return false;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onStateChangeCallback = onStateChange || null;

    try {
      this.recognition.start();
      this.isListening = true;
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(true);
      }
      return true;
    } catch (err) {
      console.warn('Recognition start error:', err);
      try {
        this.recognition.stop();
        setTimeout(() => {
          try {
            this.recognition.start();
            this.isListening = true;
            if (this.onStateChangeCallback) {
              this.onStateChangeCallback(true);
            }
          } catch {
            // ignore
          }
        }, 100);
        return true;
      } catch {
        return false;
      }
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        // ignore
      }
      this.isListening = false;
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(false);
      }
    }
  }

  public getStatus(): boolean {
    return this.isListening;
  }
}
