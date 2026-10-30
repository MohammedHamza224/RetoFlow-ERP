import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Grid, CheckCircle2, Clock, CalendarCheck, ShieldAlert } from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { RestaurantTable, TableStatus } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { TableCard } from './TableCard';

export function TableManagement() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const isManagerOrAdmin = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  // Instant Synchronous Cache Initialization for 0ms Instant Render
  const cachedTables = DatabaseService.getCachedTablesSync();
  const [tables, setTables] = useState<RestaurantTable[]>(cachedTables || []);
  const [isLoading, setIsLoading] = useState(!cachedTables || cachedTables.length === 0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TableStatus>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [formData, setFormData] = useState({
    table_number: '',
    capacity: 4,
    location: 'Main Dining',
    status: 'AVAILABLE' as TableStatus,
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTables = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const data = await DatabaseService.getTables();
      setTables(data);
    } catch (err: any) {
      console.error('Failed to load tables:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = DatabaseService.getCachedTablesSync();
    loadTables(!cached || cached.length === 0);
  }, [loadTables]);

  const openCreateModal = useCallback(() => {
    setEditingTable(null);
    setFormData({
      table_number: `T-0${tables.length + 1}`,
      capacity: 4,
      location: isRtl ? 'الصالة الرئيسية' : 'Main Dining',
      status: 'AVAILABLE',
    });
    setFormError('');
    setIsModalOpen(true);
  }, [tables.length, isRtl]);

  const openEditModal = useCallback((tbl: RestaurantTable) => {
    setEditingTable(tbl);
    setFormData({
      table_number: tbl.table_number,
      capacity: tbl.capacity,
      location: tbl.location,
      status: tbl.status,
    });
    setFormError('');
    setIsModalOpen(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.table_number.trim()) {
      setFormError(t('tables.tableNumberRequired'));
      return;
    }
    if (formData.capacity < 1) {
      setFormError(t('tables.capacityMin'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTable) {
        const updated = await DatabaseService.updateTable(user?.id, editingTable.id, formData);
        setTables(prev => prev.map(t => t.id === editingTable.id ? updated : t));
      } else {
        const created = await DatabaseService.createTable(user?.id, formData);
        setTables(prev => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Optimistic Local Status Change (0ms UI latency, no full re-fetch)
  const handleStatusChange = useCallback(async (tbl: RestaurantTable, newStatus: TableStatus) => {
    if (tbl.status === newStatus) return;

    setTables(prev => prev.map(t => t.id === tbl.id ? { ...t, status: newStatus } : t));

    try {
      await DatabaseService.updateTableStatus(user?.id, tbl.id, newStatus);
    } catch (err: any) {
      setTables(prev => prev.map(t => t.id === tbl.id ? { ...t, status: tbl.status } : t));
      alert(err.message || 'Failed to update table status.');
    }
  }, [user]);

  const filteredTables = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    return tables.filter(t => {
      const matchesSearch = !term ||
        t.table_number.toLowerCase().includes(term) ||
        t.location.toLowerCase().includes(term);

      const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tables, deferredSearchTerm, statusFilter]);

  // Floor Stats Counters
  const availableCount = useMemo(() => tables.filter(t => t.status === 'AVAILABLE').length, [tables]);
  const occupiedCount = useMemo(() => tables.filter(t => t.status === 'OCCUPIED').length, [tables]);
  const reservedCount = useMemo(() => tables.filter(t => t.status === 'RESERVED').length, [tables]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Grid className="w-5 h-5 text-resto-terracotta-600" />
            {t('tables.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('tables.subtitle')} ({tables.length} {t('tables.title')})
          </p>
        </div>

        {isManagerOrAdmin && (
          <Button
            variant="primary"
            size="md"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('tables.createTable')}
          </Button>
        )}
      </div>

      {/* Floor Plan Status Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">{t('tables.available')}</span>
          </div>
          <span className="text-lg font-extrabold text-emerald-700 font-display">{availableCount}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">{t('tables.occupied')}</span>
          </div>
          <span className="text-lg font-extrabold text-amber-700 font-display">{occupiedCount}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-blue-900 dark:text-blue-200">{t('tables.reserved')}</span>
          </div>
          <span className="text-lg font-extrabold text-blue-700 font-display">{reservedCount}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder={t('tables.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto flex-wrap">
          <span className="text-xs font-semibold text-slate-500">{t('tables.status')}:</span>
          {(['ALL', 'AVAILABLE', 'OCCUPIED', 'RESERVED'] as const).map(s => {
            const label = s === 'ALL' ? t('tables.all') : t(`status.${s}`);
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredTables.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Grid className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            {t('tables.noTables')}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('tables.noTablesDesc')}
          </p>
        </div>
      )}

      {/* Table Grid */}
      {!isLoading && filteredTables.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTables.map(tbl => (
            <TableCard
              key={tbl.id}
              table={tbl}
              isManagerOrAdmin={isManagerOrAdmin}
              onEdit={openEditModal}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Table Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTable ? t('tables.editModalTitle') : t('tables.createModalTitle')}
        description={t('tables.modalDesc')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('tables.tableNumber')} *</label>
              <Input
                value={formData.table_number}
                onChange={(e) => setFormData({ ...formData, table_number: e.target.value.toUpperCase() })}
                placeholder="e.g. T-01"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('tables.capacity')} *</label>
              <Input
                type="number"
                min="1"
                step="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 1 })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('tables.location')}</label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder={isRtl ? 'مثال: الصالة الرئيسية، التراس، قسم كبار الشخصيات' : 'e.g. Main Dining, Patio, VIP Lounge'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('tables.status')} *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TableStatus })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
                required
              >
                <option value="AVAILABLE">{t('status.AVAILABLE')}</option>
                <option value="OCCUPIED">{t('status.OCCUPIED')}</option>
                <option value="RESERVED">{t('status.RESERVED')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>

            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              {t('tables.saveTable')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
