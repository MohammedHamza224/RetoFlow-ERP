/**
 * RestoFlow Business Currency Management & ISO 4217 Currency Definitions
 * 
 * Provides centralized currency configuration, persistence, and reactive hook.
 * Defaults to 'SAR' (Saudi Riyal) for backwards compatibility.
 */

import { useState, useEffect } from 'react';
import { DEFAULT_CURRENCY } from '@/config/tax.config';

export interface CurrencyDefinition {
  code: string;
  nameEn: string;
  nameAr: string;
  symbolEn: string;
  symbolAr: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyDefinition[] = [
  { code: 'SAR', nameEn: 'Saudi Riyal', nameAr: 'ريال سعودي', symbolEn: 'SAR', symbolAr: 'ر.س', decimals: 2 },
  { code: 'USD', nameEn: 'US Dollar', nameAr: 'دولار أمريكي', symbolEn: '$', symbolAr: '$', decimals: 2 },
  { code: 'EUR', nameEn: 'Euro', nameAr: 'يورو', symbolEn: '€', symbolAr: '€', decimals: 2 },
  { code: 'GBP', nameEn: 'British Pound', nameAr: 'جنيه إسترليني', symbolEn: '£', symbolAr: '£', decimals: 2 },
  { code: 'AED', nameEn: 'UAE Dirham', nameAr: 'درهم إماراتي', symbolEn: 'AED', symbolAr: 'د.إ', decimals: 2 },
  { code: 'EGP', nameEn: 'Egyptian Pound', nameAr: 'جنيه مصري', symbolEn: 'EGP', symbolAr: 'ج.م', decimals: 2 },
  { code: 'KWD', nameEn: 'Kuwaiti Dinar', nameAr: 'دينار كويتي', symbolEn: 'KWD', symbolAr: 'د.ك', decimals: 3 },
  { code: 'QAR', nameEn: 'Qatari Riyal', nameAr: 'ريال قطري', symbolEn: 'QAR', symbolAr: 'ر.ق', decimals: 2 },
  { code: 'BHD', nameEn: 'Bahraini Dinar', nameAr: 'دينار بحريني', symbolEn: 'BHD', symbolAr: 'د.ب', decimals: 3 },
  { code: 'OMR', nameEn: 'Omani Rial', nameAr: 'ريال عماني', symbolEn: 'OMR', symbolAr: 'ر.ع', decimals: 3 },
  { code: 'JOD', nameEn: 'Jordanian Dinar', nameAr: 'دينار أردني', symbolEn: 'JOD', symbolAr: 'د.أ', decimals: 3 },
];

export const SETTINGS_STORAGE_KEY = 'restoflow_system_settings_v1';
export const CURRENCY_CHANGE_EVENT = 'restoflow_currency_changed';

let cachedCurrency: string | null = null;

/**
 * Returns the currently active operational business currency code (e.g. 'SAR', 'USD').
 * Safe fallback to DEFAULT_CURRENCY ('SAR').
 */
export function getActiveCurrency(): string {
  if (cachedCurrency) return cachedCurrency;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currency && typeof parsed.currency === 'string') {
          const match = SUPPORTED_CURRENCIES.find(c => c.code === parsed.currency.toUpperCase());
          if (match) {
            cachedCurrency = match.code;
            return cachedCurrency;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Currency] Fallback reading active currency:', e);
  }

  const fallback = String(DEFAULT_CURRENCY || 'SAR');
  cachedCurrency = fallback;
  return fallback;
}

/**
 * Updates and persists the active business currency in system settings.
 * Dispatches an event so all UI components update reactively.
 */
export function setActiveCurrency(currencyCode: string): void {
  const normalized = currencyCode.toUpperCase();
  const match = SUPPORTED_CURRENCIES.find(c => c.code === normalized);
  if (!match) {
    console.warn(`[Currency] Unsupported currency code: ${currencyCode}`);
    return;
  }

  cachedCurrency = normalized;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      let parsed: any = {};
      if (saved) {
        try { parsed = JSON.parse(saved); } catch (_) {}
      }
      parsed.currency = normalized;
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed));
      window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: normalized }));
    }
  } catch (e) {
    console.warn('[Currency] Failed to save currency setting to localStorage:', e);
  }
}

/**
 * Look up the full currency definition by ISO code.
 */
export function getCurrencyDefinition(code?: string): CurrencyDefinition {
  const targetCode = (code || getActiveCurrency()).toUpperCase();
  const found = SUPPORTED_CURRENCIES.find(c => c.code === targetCode);
  return found || SUPPORTED_CURRENCIES[0]; // defaults to SAR
}

/**
 * React hook to read and observe currency changes in components.
 */
export function useCurrency() {
  const [currency, setCurrencyState] = useState<string>(getActiveCurrency);

  useEffect(() => {
    const handleCurrencyChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCurrencyState(detail || getActiveCurrency());
    };
    window.addEventListener(CURRENCY_CHANGE_EVENT, handleCurrencyChange);
    window.addEventListener('storage', handleCurrencyChange);
    return () => {
      window.removeEventListener(CURRENCY_CHANGE_EVENT, handleCurrencyChange);
      window.removeEventListener('storage', handleCurrencyChange);
    };
  }, []);

  return {
    currency,
    setCurrency: (c: string) => {
      setActiveCurrency(c);
      setCurrencyState(c);
    },
    definition: getCurrencyDefinition(currency),
    supportedCurrencies: SUPPORTED_CURRENCIES,
  };
}
