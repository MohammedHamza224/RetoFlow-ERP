import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, CheckCircle2, Clock, CalendarCheck, Edit2 } from 'lucide-react';
import { RestaurantTable, TableStatus } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface TableCardProps {
  table: RestaurantTable;
  isManagerOrAdmin: boolean;
  onEdit: (table: RestaurantTable) => void;
  onStatusChange: (table: RestaurantTable, newStatus: TableStatus) => void;
}

export const TableCard = React.memo(function TableCard({
  table,
  isManagerOrAdmin,
  onEdit,
  onStatusChange,
}: TableCardProps) {
  const { t } = useTranslation();

  const getStatusBadge = () => {
    switch (table.status) {
      case 'AVAILABLE':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t('status.AVAILABLE')}</Badge>;
      case 'OCCUPIED':
        return <Badge variant="warning" className="flex items-center gap-1 bg-amber-500 text-white"><Clock className="w-3 h-3" /> {t('status.OCCUPIED')}</Badge>;
      case 'RESERVED':
        return <Badge variant="outline" className="flex items-center gap-1 border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"><CalendarCheck className="w-3 h-3" /> {t('status.RESERVED')}</Badge>;
      default:
        return <Badge variant="outline">{table.status}</Badge>;
    }
  };

  return (
    <Card
      className={`group relative overflow-hidden transition-all border flex flex-col justify-between ${
        table.status === 'OCCUPIED'
          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
          : table.status === 'RESERVED'
          ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
          : 'bg-card border-slate-200 dark:border-slate-800 hover:shadow-card'
      }`}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-resto-charcoal-800 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0 font-mono">
              {table.table_number}
            </div>
            <div>
              <CardTitle className="text-base font-bold font-display">{table.table_number}</CardTitle>
              <span className="text-[10px] font-semibold text-slate-400 block">{table.location}</span>
            </div>
          </div>
          <div>{getStatusBadge()}</div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80">
          <Users className="w-4 h-4 text-resto-terracotta-600 shrink-0" />
          <span className="font-semibold">{table.capacity} {t('tables.guestsCapacity')}</span>
        </div>
      </CardContent>

      {/* Quick Status Switcher Bar */}
      <CardFooter className="p-3 pt-2 flex items-center justify-between gap-1 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStatusChange(table, 'AVAILABLE')}
            className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
              table.status === 'AVAILABLE'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-100'
            }`}
          >
            {t('status.AVAILABLE')}
          </button>

          <button
            onClick={() => onStatusChange(table, 'OCCUPIED')}
            className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
              table.status === 'OCCUPIED'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-100'
            }`}
          >
            {t('status.OCCUPIED')}
          </button>

          <button
            onClick={() => onStatusChange(table, 'RESERVED')}
            className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
              table.status === 'RESERVED'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-blue-100'
            }`}
          >
            {t('status.RESERVED')}
          </button>
        </div>

        {isManagerOrAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(table)}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
            className="h-7 text-xs px-2"
          >
            {t('common.edit')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
});
