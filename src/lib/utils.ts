import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getActiveCurrency, getCurrencyDefinition } from './currency';
import i18n from '@/i18n/i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency?: string,
  locale?: string
): string {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const activeCurrency = currency || getActiveCurrency();
  const def = getCurrencyDefinition(activeCurrency);
  const decimals = def ? def.decimals : 2;

  // Detect active language (Arabic vs English) if locale not explicitly provided
  const isArabic = i18n?.language === 'ar' || (typeof document !== 'undefined' && document.documentElement.lang === 'ar');
  const activeLocale = locale || (isArabic ? 'ar-SA-u-nu-latn' : 'en-US');

  try {
    return new Intl.NumberFormat(activeLocale, {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch (err) {
    return `${activeCurrency} ${num.toFixed(decimals)}`;
  }
}

export function formatDateTime(dateString: string | Date, locale: string = 'en-US'): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateShort(dateString: string | Date, locale: string = 'en-US'): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
