/**
 * Pakistani Currency & Number Formatter
 */

export function formatPKR(
  amount: number | undefined | null,
  symbol: 'Rs.' | '₨' | 'روپے' = 'Rs.',
  language: 'ur' | 'en' = 'ur'
): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return `${symbol} 0`;
  }

  // Format with commas
  const formattedNumber = Math.round(amount).toLocaleString('en-PK');

  if (language === 'ur') {
    if (symbol === 'روپے') {
      return `${formattedNumber} روپے`;
    }
    return `${symbol} ${formattedNumber}`;
  }

  return `${symbol} ${formattedNumber}`;
}

export function toUrduNumerals(num: number | string): string {
  const urduDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return num
    .toString()
    .replace(/[0-9]/g, (w) => urduDigits[+w]);
}

export function parseNumber(value: string | number): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
