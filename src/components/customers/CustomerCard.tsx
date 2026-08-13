import React from 'react';
import { UserCheck, Crown, Phone, Mail, Edit2 } from 'lucide-react';
import { Customer, CustomerType } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface CustomerCardProps {
  customer: Customer;
  canEditCustomers: boolean;
  onEdit: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
}

export const CustomerCard = React.memo(function CustomerCard({
  customer,
  canEditCustomers,
  onEdit,
  onDelete,
}: CustomerCardProps) {
  const getCustomerBadge = (type: CustomerType) => {
    if (type === 'VIP') {
      return <Badge variant="warning" className="flex items-center gap-1 bg-amber-500 text-white"><Crown className="w-3 h-3" /> VIP Guest</Badge>;
    }
    if (type === 'REGULAR') {
      return <Badge variant="success" className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> Regular</Badge>;
    }
    return <Badge variant="outline" className="text-slate-500">Walk-in Guest</Badge>;
  };

  const isWalkInGuest = customer.id === 'c0000000-0000-0000-0000-000000000001';

  return (
    <Card className="relative overflow-hidden bg-card hover:shadow-card transition-all border flex flex-col justify-between">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <CardTitle className="text-base font-bold truncate">{customer.name}</CardTitle>
          <div className="pt-0.5">{getCustomerBadge(customer.customer_type)}</div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />
          <span className="font-mono">{customer.phone || 'No phone recorded'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />
          <span className="truncate">{customer.email || 'No email recorded'}</span>
        </div>
      </CardContent>

      {canEditCustomers && !isWalkInGuest && (
        <CardFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/20">
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(customer)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              Delete
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(customer)}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit Profile
          </Button>
        </CardFooter>
      )}
    </Card>
  );
});
