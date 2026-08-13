import React from 'react';
import { OrderManagement } from '@/components/orders/OrderManagement';

export function OrderView() {
  return (
    <div className="animate-in fade-in duration-200">
      <OrderManagement />
    </div>
  );
}
