import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Printer, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PrintableReceipt } from './PrintableReceipt';
import { PrintPortal } from '@/components/print/PrintPortal';

export interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    order_number: string;
    customer_name: string;
    order_type: string;
    table_name?: string;
    total: number;
    subtotal: number;
    discount: number;
    vat_amount: number;
    cashier_name: string;
    items: Array<{ name: string; sku?: string; quantity: number; unit_price: number; total: number }>;
    payments: Array<{ payment_method: string; amount: number }>;
    created_at: string;
  } | null;
}

export function OrderSuccessModal({ isOpen, onClose, orderData }: OrderSuccessModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const receiptRef = useRef<HTMLDivElement>(null);
  const [thermalSize, setThermalSize] = useState<'thermal-80mm' | 'thermal-58mm'>('thermal-80mm');

  if (!orderData || !isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('pos.orderSuccess')}
        description={`${isRtl ? 'مرجع الطلب:' : 'Order Reference:'} ${orderData.order_number}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Success Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-1.5">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-display text-lg font-extrabold text-emerald-950 dark:text-emerald-200">
              {orderData.order_number}
            </h3>
            <div className="flex items-center justify-center gap-2 text-xs flex-wrap">
              <Badge variant="success">{orderData.order_type}</Badge>
              {orderData.table_name && <Badge variant="outline">{orderData.table_name}</Badge>}
              <span className="text-emerald-800 dark:text-emerald-300 font-bold">
                {formatCurrency(orderData.total)}
              </span>
            </div>
          </div>

          {/* Thermal Paper Size Selector */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <span className="font-semibold text-slate-500">
              {isRtl ? 'مقاس ورق الطابعة الحرارية:' : 'Thermal Receipt Size:'}
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setThermalSize('thermal-80mm')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  thermalSize === 'thermal-80mm'
                    ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                80mm (Standard)
              </button>
              <button
                type="button"
                onClick={() => setThermalSize('thermal-58mm')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  thermalSize === 'thermal-58mm'
                    ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                58mm (Compact)
              </button>
            </div>
          </div>

          {/* Printable Receipt Screen Preview */}
          <div className="max-h-[340px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 p-3">
            <PrintableReceipt
              ref={receiptRef}
              orderNumber={orderData.order_number}
              createdAt={orderData.created_at}
              cashierName={orderData.cashier_name}
              customerName={orderData.customer_name}
              orderType={orderData.order_type}
              tableName={orderData.table_name}
              items={orderData.items}
              subtotal={orderData.subtotal}
              discount={orderData.discount}
              vatAmount={orderData.vat_amount}
              total={orderData.total}
              payments={orderData.payments}
              thermalSize={thermalSize}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="md"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold"
            >
              {t('pos.printReceipt')} ({thermalSize === 'thermal-58mm' ? '58mm' : '80mm'})
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={onClose}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold"
            >
              {t('pos.newOrder')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Isolated Top-Level Print Portal (Only this prints during window.print / Save PDF) */}
      <PrintPortal pageSize={thermalSize} dir={isRtl ? 'rtl' : 'ltr'}>
        <PrintableReceipt
          orderNumber={orderData.order_number}
          createdAt={orderData.created_at}
          cashierName={orderData.cashier_name}
          customerName={orderData.customer_name}
          orderType={orderData.order_type}
          tableName={orderData.table_name}
          items={orderData.items}
          subtotal={orderData.subtotal}
          discount={orderData.discount}
          vatAmount={orderData.vat_amount}
          total={orderData.total}
          payments={orderData.payments}
          thermalSize={thermalSize}
        />
      </PrintPortal>
    </>
  );
}
