import React from 'react';
import { CustomerManagement } from '@/components/customers/CustomerManagement';

export function CustomerView() {
  return (
    <div className="animate-in fade-in duration-200">
      <CustomerManagement />
    </div>
  );
}
