import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Printer, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PrintableReceipt } from './PrintableReceipt';

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
    items: Array<{ name: string; quantity: number; unit_price: number; total: number }>;
    payments: Array<{ payment_method: string; amount: number }>;
    created_at: string;
  } | null;
}

export function OrderSuccessModal({ isOpen, onClose, orderData }: OrderSuccessModalProps) {
  const { t } = useTranslation();
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!orderData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('pos.orderSuccess')}
      description={`Database Order Reference: ${orderData.order_number}`}
      maxWidth="md"
    >
      <div className="space-y-5 print:space-y-0">
        {/* Success Banner */}
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center space-y-2 print:hidden">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="font-display text-xl font-extrabold text-emerald-950 dark:text-emerald-200">
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

        {/* Printable Receipt Preview */}
        <div className="max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 print:max-h-none print:overflow-visible print:border-none print:bg-transparent print:p-0">
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
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 print:hidden">
          <Button
            variant="outline"
            size="md"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            {t('pos.printReceipt')}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={onClose}
            leftIcon={<PlusCircle className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            {t('pos.newOrder')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
