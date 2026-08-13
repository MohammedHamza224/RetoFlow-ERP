import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit2,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Supplier } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';

export function SupplierManagement() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const canEdit = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => DatabaseService.getCachedSuppliersSync() || []);
  const [isLoading, setIsLoading] = useState(() => {
    const cached = DatabaseService.getCachedSuppliersSync();
    return !cached || cached.length === 0;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    tax_number: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSuppliers = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const data = await DatabaseService.getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      console.error('Failed to load suppliers:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = DatabaseService.getCachedSuppliersSync();
    loadSuppliers(!cached || cached.length === 0);
  }, [loadSuppliers]);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({ name: '', phone: '', email: '', address: '', tax_number: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name,
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      tax_number: sup.tax_number || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openDeleteModal = (sup: Supplier) => {
    setDeletingSupplier(sup);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;
    setIsSubmitting(true);
    try {
      await DatabaseService.deleteSupplier(user?.id, deletingSupplier.id);
      setIsDeleteDialogOpen(false);
      setDeletingSupplier(null);
      await loadSuppliers(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await DatabaseService.updateSupplier(user?.id, editingSupplier.id, formData);
      } else {
        await DatabaseService.createSupplier(user?.id, formData);
      }
      setIsModalOpen(false);
      await loadSuppliers(false);
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return suppliers.filter(s =>
      !term ||
      s.name.toLowerCase().includes(term) ||
      (s.tax_number && s.tax_number.includes(term)) ||
      (s.phone && s.phone.includes(term))
    );
  }, [suppliers, searchTerm]);

  return (
    <div className="space-y-6 select-none">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-resto-terracotta-600" />
            Supplier Directory & Procurement
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage ingredient & product suppliers, tax numbers, and contact directories ({suppliers.length} Registered Suppliers)
          </p>
        </div>

        {canEdit && (
          <Button
            variant="primary"
            size="md"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
          >
            Add New Supplier
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder="Search by supplier name, phone, or tax number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {/* Suppliers Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map(sup => (
            <Card key={sup.id} className="relative overflow-hidden bg-card hover:shadow-card transition-all border flex flex-col justify-between">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <CardTitle className="text-base font-bold truncate">{sup.name}</CardTitle>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                    <FileText className="w-3 h-3 text-resto-terracotta-600" />
                    <span>TAX VAT: {sup.tax_number || 'N/A'}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />
                  <span className="font-mono">{sup.phone || 'No phone recorded'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />
                  <span className="truncate">{sup.email || 'No email recorded'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />
                  <span className="truncate">{sup.address || 'Riyadh, Saudi Arabia'}</span>
                </div>
              </CardContent>

              {canEdit && (
                <CardFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(sup)}
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDeleteModal(sup)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Supplier Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier Record' : 'Register New Supplier'}
        description="Supplier contacts enable procurement purchase order tracking."
        maxWidth="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-2 select-none">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Supplier Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Almarai Food Distribution Ltd."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Phone Number</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+966 11 000 0000"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tax Number (VAT)</label>
              <Input
                value={formData.tax_number}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                placeholder="300000000000003"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="supplier@company.sa"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Commercial Address</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="King Fahd Road, Riyadh"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isSubmitting} className="bg-resto-terracotta-600">
              {editingSupplier ? 'Save Supplier' : 'Register Supplier'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Confirm Deletion"
        description="Are you sure you want to delete this supplier?"
        maxWidth="sm"
      >
        <div className="py-2 space-y-4 select-none">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Supplier: <span className="font-bold text-resto-charcoal-900 dark:text-white">{deletingSupplier?.name}</span>
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
            This action cannot be undone. If this supplier has existing purchase orders, deletion will be blocked to protect your financial records.
          </p>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" onClick={() => setIsDeleteDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              size="md" 
              onClick={handleDelete} 
              isLoading={isSubmitting} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
