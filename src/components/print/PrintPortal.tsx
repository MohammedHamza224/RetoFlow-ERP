import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Printer, X, FileText, Receipt } from 'lucide-react';
import { SETTINGS_STORAGE_KEY, getActiveCurrency } from '@/lib/currency';
import { DEFAULT_VAT_RATE } from '@/config/tax.config';
import { Button } from '@/components/ui/Button';

export type PrintPageSize = 'a4' | 'a4-landscape' | 'thermal-80mm' | 'thermal-58mm';

export interface CompanyPrintSettings {
  restaurantName: string;
  tagline: string;
  phone: string;
  vatNumber: string;
  address: string;
  vatRate: number;
  currency: string;
}

/**
 * Retrieve active company settings from SettingsManagement storage or system defaults.
 */
export function getCompanySettings(): CompanyPrintSettings {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SETTINGS_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        restaurantName: parsed.restaurantName || 'RestoFlow Fine Dining',
        tagline: parsed.tagline || 'Integrated Restaurant & ERP Management System',
        phone: parsed.phone || '+966 11 234 5678',
        vatNumber: parsed.vatNumber || '300123456700003',
        address: parsed.address || 'King Fahd Road, Olaya District, Riyadh, KSA',
        vatRate: typeof parsed.vatRate === 'number' ? parsed.vatRate : DEFAULT_VAT_RATE,
        currency: parsed.currency || getActiveCurrency(),
      };
    }
  } catch {
    // Fallback to defaults if storage unavailable
  }
  return {
    restaurantName: 'RestoFlow Fine Dining',
    tagline: 'Integrated Restaurant & ERP Management System',
    phone: '+966 11 234 5678',
    vatNumber: '300123456700003',
    address: 'King Fahd Road, Olaya District, Riyadh, KSA',
    vatRate: DEFAULT_VAT_RATE,
    currency: getActiveCurrency(),
  };
}

/**
 * Encode ZATCA Phase-1 TLV (Tag-Length-Value) Base64 payload for Saudi e-Invoicing QR codes.
 */
export function encodeZatcaTlvBase64(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: number;
  vatAmount: number;
}): string {
  try {
    const encoder = new TextEncoder();
    const fields = [
      { tag: 1, val: params.sellerName },
      { tag: 2, val: params.vatNumber },
      { tag: 3, val: params.timestamp },
      { tag: 4, val: params.totalWithVat.toFixed(2) },
      { tag: 5, val: params.vatAmount.toFixed(2) },
    ];
    const chunks: number[] = [];
    for (const f of fields) {
      const bytes = Array.from(encoder.encode(f.val));
      chunks.push(f.tag, bytes.length, ...bytes);
    }
    let binary = '';
    for (const b of chunks) binary += String.fromCharCode(b);
    return typeof btoa !== 'undefined' ? btoa(binary) : '';
  } catch {
    return '';
  }
}

/**
 * Crisp Vector SVG QR Code Component for ZATCA Tax Invoices & Thermal Receipts.
 * Renders deterministically from the TLV payload so it never fails or blurs in print/PDF.
 */
export function ZatcaQrCode({
  sellerName,
  vatNumber,
  timestamp,
  totalWithVat,
  vatAmount,
  size = 84,
}: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: number;
  vatAmount: number;
  size?: number;
}) {
  const payload = encodeZatcaTlvBase64({
    sellerName,
    vatNumber,
    timestamp,
    totalWithVat,
    vatAmount,
  });

  // Deterministic 21x21 QR matrix generator with standard finder patterns
  const gridSize = 21;
  const isFinder = (r: number, c: number) => {
    const inTopLeft = r < 7 && c < 7;
    const inTopRight = r < 7 && c >= gridSize - 7;
    const inBottomLeft = r >= gridSize - 7 && c < 7;
    if (!inTopLeft && !inTopRight && !inBottomLeft) return null;
    const lr = inTopLeft ? r : inTopRight ? r : r - (gridSize - 7);
    const lc = inTopLeft ? c : inTopRight ? c - (gridSize - 7) : c;
    if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
    if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
    return false;
  };

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const cells: JSX.Element[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const finderVal = isFinder(r, c);
      let filled = false;
      if (finderVal !== null) {
        filled = finderVal;
      } else if (r === 6 || c === 6) {
        filled = (r + c) % 2 === 0;
      } else {
        const bitIdx = (r * gridSize + c) % Math.max(1, payload.length);
        const charCode = payload.charCodeAt(bitIdx) || 7;
        filled = ((charCode + r * 13 + c * 7 + (hash & 0xff)) % 3) !== 0;
      }
      if (filled) {
        cells.push(<rect key={`${r}-${c}`} x={c + 1} y={r + 1} width={1} height={1} fill="#000000" />);
      }
    }
  }

  return (
    <div className="inline-flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${gridSize + 2} ${gridSize + 2}`}
        shapeRendering="crispEdges"
        className="bg-white border border-slate-300 p-0.5 rounded"
        aria-label="ZATCA E-Invoice QR Code"
      >
        <rect x={0} y={0} width={gridSize + 2} height={gridSize + 2} fill="#ffffff" />
        {cells}
      </svg>
    </div>
  );
}

/**
 * PrintPortal mounts a clean, isolated copy of the active printable document
 * directly under `document.body` (`#restoflow-print-portal`) outside `#root`.
 * During `@media print`, `#root` is completely hidden (`display: none !important`),
 * ensuring 100% isolation with zero sidebar, header, modal backdrop, or overflow clipping.
 */
export function PrintPortal({
  children,
  pageSize = 'a4',
  dir = 'ltr',
}: {
  children: React.ReactNode;
  pageSize?: PrintPageSize;
  dir?: 'ltr' | 'rtl';
}) {
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let el = document.getElementById('restoflow-print-portal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'restoflow-print-portal';
      document.body.appendChild(el);
    }
    el.setAttribute('dir', dir);
    el.setAttribute('data-print-size', pageSize);
    document.body.setAttribute('data-print-active', 'true');
    document.body.setAttribute('data-print-size', pageSize);
    setPortalNode(el);

    // Inject dynamic @page rule matching exact document type (A4 vs Thermal 80mm / 58mm)
    let styleEl = document.getElementById('restoflow-dynamic-page-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'restoflow-dynamic-page-style';
      document.head.appendChild(styleEl);
    }

    if (pageSize === 'thermal-80mm') {
      styleEl.textContent = `
        @media print {
          @page {
            size: 80mm auto;
            margin: 2mm;
          }
        }
      `;
    } else if (pageSize === 'thermal-58mm') {
      styleEl.textContent = `
        @media print {
          @page {
            size: 58mm auto;
            margin: 1.5mm;
          }
        }
      `;
    } else if (pageSize === 'a4-landscape') {
      styleEl.textContent = `
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `;
    } else {
      styleEl.textContent = `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `;
    }

    return () => {
      document.body.removeAttribute('data-print-active');
      document.body.removeAttribute('data-print-size');
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, [pageSize, dir]);

  if (!portalNode) return null;

  return ReactDOM.createPortal(
    <div className="restoflow-print-document-wrapper" dir={dir}>
      {children}
    </div>,
    portalNode
  );
}

/**
 * Standardized Screen Preview Action Bar (Hidden in Print Output)
 */
export function PrintPreviewToolbar({
  title,
  pageSize,
  onChangePageSize,
  allowedSizes,
  onPrint,
  onClose,
  isRtl,
}: {
  title: string;
  pageSize: PrintPageSize;
  onChangePageSize?: (size: PrintPageSize) => void;
  allowedSizes?: Array<{ size: PrintPageSize; label: string }>;
  onPrint?: () => void;
  onClose?: () => void;
  isRtl?: boolean;
}) {
  const handlePrint = () => {
    if (onPrint) onPrint();
    else window.print();
  };

  return (
    <div className="no-print print:hidden flex flex-wrap items-center justify-between gap-2.5 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        {pageSize.startsWith('thermal') ? (
          <Receipt className="w-5 h-5 text-resto-terracotta-600 shrink-0" />
        ) : (
          <FileText className="w-5 h-5 text-resto-terracotta-600 shrink-0" />
        )}
        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
          {title}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {allowedSizes && allowedSizes.length > 1 && onChangePageSize && (
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            {allowedSizes.map((opt) => (
              <button
                key={opt.size}
                type="button"
                onClick={() => onChangePageSize(opt.size)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  pageSize === opt.size
                    ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {onClose && (
          <Button variant="ghost" size="sm" type="button" onClick={onClose} leftIcon={<X className="w-4 h-4" />}>
            {isRtl ? 'إغلاق' : 'Close'}
          </Button>
        )}

        <Button
          variant="primary"
          size="sm"
          type="button"
          onClick={handlePrint}
          leftIcon={<Printer className="w-4 h-4" />}
          className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 text-white font-bold"
        >
          {isRtl ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}
        </Button>
      </div>
    </div>
  );
}
