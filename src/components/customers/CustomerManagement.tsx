import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Users, ShieldAlert } from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Customer, CustomerType } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { CustomerCard } from './CustomerCard';

export function CustomerManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEditCustomers = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER' || user?.role_name === 'CASHIER';

  // Instant Synchronous Cache Initialization for 0ms Instant Render
  const [customers, setCustomers] = useState<Customer[]>(() => DatabaseService.getCachedCustomersSync() || []);
  const [isLoading, setIsLoading] = useState(() => {
    const cached = DatabaseService.getCachedCustomersSync();
    return !cached || cached.length === 0;
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [typeFilter, setTypeFilter] = useState<'ALL' | CustomerType>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    customer_type: 'REGULAR' as CustomerType,
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCustomers = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const data = await DatabaseService.getCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // If no cache was present, show skeleton, otherwise fetch silently in background
    const cached = DatabaseService.getCachedCustomersSync();
    loadCustomers(!cached || cached.length === 0);
  }, [loadCustomers]);

  const openCreateModal = useCallback(() => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', customer_type: 'REGULAR' });
    setFormError('');
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((cust: Customer) => {
    setEditingCustomer(cust);
    setFormData({
      name: cust.name,
      phone: cust.phone || '',
      email: cust.email || '',
      customer_type: cust.customer_type,
    });
    setFormError('');
    setIsModalOpen(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[CustomerCreate] Submit triggered');
    console.log('[CustomerCreate] Form data:', formData);
    
    setFormError('');

    if (!formData.name.trim()) {
      console.log('[CustomerCreate] Validation result: Failed (Name required)');
      setFormError('Customer name is required.');
      return;
    }
    
    console.log('[CustomerCreate] Validation result: Passed');

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        console.log('[CustomerUpdate] Updating customer...', editingCustomer.id);
        const updated = await DatabaseService.updateCustomer(user?.id, editingCustomer.id, formData);
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? updated : c));
      } else {
        console.log('[CustomerCreate] Creating customer...');
        console.log('[CustomerCreate] Payload:', formData);
        const created = await DatabaseService.createCustomer(user?.id, formData);
        console.log('[CustomerCreate] Customer created successfully:', created);
        console.log('[CustomerCreate] Updating customer state: adding to array');
        setCustomers(prev => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('[CustomerCreate] Exception caught:', err.message);
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    console.log('[CustomerDelete] START');
    console.log('[CustomerDelete] customer id:', customer.id);
    console.log('[CustomerDelete] customer name:', customer.name);

    if (!window.confirm(`Are you sure you want to permanently delete customer "${customer.name}"? This action cannot be undone.`)) {
      console.log('[CustomerDelete] User cancelled confirmation.');
      return;
    }
    
    try {
      console.log('[CustomerDelete] calling db.service.deleteCustomer()');
      await DatabaseService.deleteCustomer(user?.id, customer.id);
      
      console.log('[CustomerDelete] DELETE successful');
      console.log('[CustomerDelete] updating React state');
      setCustomers(prev => prev.filter(c => c.id !== customer.id));
      console.log('[CustomerDelete] END');
    } catch (err: any) {
      console.log('[CustomerDelete] Caught error in UI:', err.message);
      if (err.message?.includes('[HISTORICAL_DATA]')) {
        const confirmDeactivate = window.confirm(
          `This customer has historical transactions and cannot be permanently deleted. Would you like to deactivate them instead?`
        );
        if (confirmDeactivate) {
          try {
            await DatabaseService.deactivateCustomer(user?.id, customer.id);
            setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, is_active: false } : c));
          } catch (deactivateErr: any) {
            alert(deactivateErr.message || 'Deactivation failed.');
          }
        }
      } else {
        alert(err.message || 'Operation failed.');
      }
    }
  };

  const filteredCustomers = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    return customers.filter(c => {
      const matchesSearch = !term ||
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term));

      const matchesType = typeFilter === 'ALL' || c.customer_type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [customers, deferredSearchTerm, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-resto-terracotta-600" />
            Customer Registry
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage restaurant customers, phone contacts, VIP tier statuses ({customers.length} Registered)
          </p>
        </div>

        {canEditCustomers && (
          <Button
            variant="primary"
            size="md"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add New Customer
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500">Type:</span>
          {(['ALL', 'GUEST', 'REGULAR', 'VIP'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                typeFilter === t
                  ? 'bg-resto-charcoal-800 text-white dark:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
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
      {!isLoading && filteredCustomers.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            No Customers Found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No customer profiles match your current search query or classification filter.
          </p>
        </div>
      )}

      {/* Customer Grid */}
      {!isLoading && filteredCustomers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map(cust => (
            <CustomerCard
              key={cust.id}
              customer={cust}
              canEditCustomers={canEditCustomers}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer Profile' : 'Register New Customer'}
        description="Customer profiles allow phone contacts and VIP status tracking for POS orders."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Customer Full Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Prince Khalid Al-Saud"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Phone Number</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+966 50 000 0000"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@domain.sa"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Customer Type / Classification *</label>
            <select
              value={formData.customer_type}
              onChange={(e) => setFormData({ ...formData, customer_type: e.target.value as CustomerType })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
              required
            >
              <option value="GUEST">GUEST - Walk-in Guest</option>
              <option value="REGULAR">REGULAR - Registered Regular Patron</option>
              <option value="VIP">VIP - High Value VIP Customer</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>

            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
              {editingCustomer ? 'Save Profile' : 'Register Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
