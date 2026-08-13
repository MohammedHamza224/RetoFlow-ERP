/**
 * RestoFlow Centralized Tax Configuration & Tax Calculation Engine
 * 
 * Default VAT Rate: 15% (Configurable via VITE_DEFAULT_VAT_RATE env var)
 * Single Source of Truth for Tax Computations across POS, Orders, Invoices, and Analytics.
 */

export const DEFAULT_VAT_RATE = Number(typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEFAULT_VAT_RATE) || 15;
export const DEFAULT_CURRENCY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CURRENCY_SYMBOL) || 'SAR';

export interface TaxCalculationResult {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

/**
 * Calculates order financial breakdown strictly following business rules:
 * Taxable Amount = Subtotal - Discount
 * VAT Amount = Taxable Amount * (VAT_RATE / 100)
 * Total = Taxable Amount + VAT Amount
 */
export function calculateOrderTotals(
  subtotal: number,
  discount: number = 0,
  vatRate: number = DEFAULT_VAT_RATE
): TaxCalculationResult {
  const safeSubtotal = Math.max(0, subtotal);
  const safeDiscount = Math.max(0, Math.min(discount, safeSubtotal)); // Cannot discount more than subtotal
  const taxableAmount = Math.max(0, safeSubtotal - safeDiscount);
  const vatAmount = Math.round(taxableAmount * (vatRate / 100) * 100) / 100;
  const total = Math.round((taxableAmount + vatAmount) * 100) / 100;

  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    taxableAmount,
    vatRate,
    vatAmount,
    total,
  };
}
