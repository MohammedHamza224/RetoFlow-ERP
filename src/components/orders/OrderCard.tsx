import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, ArrowRight } from 'lucide-react';
import { Order, OrderStatus } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface OrderCardProps {
  order: Order;
  isRtl: boolean;
  onOpenDetails: (order: Order) => void;
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => void;
}

export const OrderCard = React.memo(function OrderCard({
  order,
  isRtl,
  onOpenDetails,
  onAdvanceStatus,
}: OrderCardProps) {
  const { t } = useTranslation();

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-slate-100 text-slate-700">{t('status.PENDING')}</Badge>;
      case 'CONFIRMED':
        return <Badge variant="warning" className="bg-amber-500 text-white">{t('status.CONFIRMED')}</Badge>;
      case 'PREPARING':
        return <Badge variant="warning" className="bg-orange-500 text-white">{t('status.PREPARING')}</Badge>;
      case 'READY':
        return <Badge variant="success" className="bg-emerald-500 text-white">{t('status.READY')}</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" className="bg-emerald-600 text-white">{t('status.COMPLETED')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive" className="bg-red-600 text-white">{t('status.CANCELLED')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getNextStatus = (status: OrderStatus): OrderStatus | null => {
    switch (status) {
      case 'PENDING': return 'CONFIRMED';
      case 'CONFIRMED': return 'PREPARING';
      case 'PREPARING': return 'READY';
      case 'READY': return 'COMPLETED';
      default: return null;
    }
  };

  const getNextStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING': return t('orders.nextStatusConfirm');
      case 'CONFIRMED': return t('orders.nextStatusPrepare');
      case 'PREPARING': return t('orders.nextStatusReady');
      case 'READY': return t('orders.nextStatusComplete');
      default: return null;
    }
  };

  const translateOrderType = (type: string) => {
    switch (type) {
      case 'DINE_IN': return t('orderType.DINE_IN');
      case 'TAKEAWAY': return t('orderType.TAKEAWAY');
      case 'DELIVERY': return t('orderType.DELIVERY');
      default: return type;
    }
  };

  const nextStatus = getNextStatus(order.status);
  const isRefunded = order.payments?.some(p => p.status === 'REFUNDED');

  return (
    <Card className="relative overflow-hidden bg-card hover:shadow-card transition-all border flex flex-col justify-between">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="font-mono text-base font-bold text-resto-charcoal-900 dark:text-slate-100">
              {order.order_number}
            </span>
            <span className="text-[11px] text-slate-400 block">
              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div>{getStatusBadge(order.status)}</div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1 space-y-2 text-xs">
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span className="text-slate-400">{t('orders.customer')}:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
            {order.customer?.name || t('pos.walkInGuest')}
          </span>
        </div>

        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span className="text-slate-400">{t('orders.typeAndTable')}:</span>
          <span className="font-semibold">
            {translateOrderType(order.order_type)} {order.table ? `(${order.table.table_number})` : ''}
          </span>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Badge variant={isRefunded ? 'destructive' : 'success'} className="text-[9px] px-1.5 py-0">
              {isRefunded ? t('status.REFUNDED') : t('status.PAID')}
            </Badge>
            <span className="text-[11px] font-semibold text-slate-500 font-mono">
              ({order.items?.length || 0} {t('orders.items')})
            </span>
          </div>

          <span className="text-base font-extrabold text-resto-terracotta-600 font-display">
            {formatCurrency(order.total)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenDetails(order)}
          leftIcon={<Eye className="w-3.5 h-3.5" />}
        >
          {t('orders.details')}
        </Button>

        {nextStatus && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onAdvanceStatus(order.id, nextStatus)}
            rightIcon={<ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />}
            className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 text-xs font-bold"
          >
            {getNextStatusLabel(order.status)}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
});
