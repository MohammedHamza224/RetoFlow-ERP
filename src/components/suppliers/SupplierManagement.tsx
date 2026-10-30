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
  Trash2,
  Receipt,
  PackageCheck,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Printer,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Supplier, SupplierStatement } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { PrintPortal } from '@/components/print/PrintPortal';
import { PrintableSupplierStatement } from '@/components/print/PrintableSupplierStatement';

export function SupplierManagement() {
  const { t, i18n } = useTranslation();
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

  // Supplier Statement State
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementData, setStatementData] = useState<SupplierStatement | null>(null);
  const [isStatementLoading, setIsStatementLoading] = useState(false);
  const [statementTab, setStatementTab] = useState<'invoices' | 'purchases' | 'receipts'>('invoices');

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

  const openStatementModal = async (sup: Supplier) => {
    setStatementSupplier(sup);
    setIsStatementLoading(true);
    setStatementTab('invoices');
    try {
      const data = await DatabaseService.getSupplierStatement(sup.id);
      setStatementData(data);
    } catch (err: any) {
      console.error('Failed to load supplier statement:', err);
    } finally {
      setIsStatementLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;
    setIsSubmitting(true);
    try {
      await DatabaseService.deleteSupplier(user?.id, deletingSupplier.id);
      setSuppliers(prev => prev.filter(s => s.id !== deletingSupplier.id));
      setIsDeleteDialogOpen(false);
      setDeletingSupplier(null);
    } catch (err: any) {
      alert(err.message || t('suppliers.deleteFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError(t('suppliers.nameRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        const updated = await DatabaseService.updateSupplier(user?.id, editingSupplier.id, formData);
        setSuppliers(prev => prev.map(s => (s.id === editingSupplier.id ? updated : s)));
      } else {
        const created = await DatabaseService.createSupplier(user?.id, formData);
        setSuppliers(prev => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || t('suppliers.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return suppliers.filter(s => {
      return (
        !term ||
        s.name.toLowerCase().includes(term) ||
        (s.phone && s.phone.includes(term)) ||
        (s.tax_number && s.tax_number.includes(term))
      );
    });
  }, [suppliers, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-resto-terracotta-600" />
            {t('suppliers.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('suppliers.subtitle')} ({suppliers.length} {t('suppliers.supplierCount')})
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
            {t('suppliers.addSupplier')}
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder={t('suppliers.searchPlaceholder')}
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

      {/* Empty State */}
      {!isLoading && filteredSuppliers.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Truck className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            {t('suppliers.noSuppliers')}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('suppliers.noSuppliersDesc')}
          </p>
        </div>
      )}

      {/* Suppliers Grid */}
      {!isLoading && filteredSuppliers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map(sup => (
            <Card
              key={sup.id}
              className="relative overflow-hidden bg-card hover:shadow-card transition-all border flex flex-col justify-between"
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <CardTitle className="text-base font-bold truncate">{sup.name}</CardTitle>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                    <FileText className="w-3 h-3 text-resto-terracotta-600" />
                    <span>{t('suppliers.taxVat')} {sup.tax_number || t('suppliers.notAvailable')}</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />
                  <span className="font-mono">{sup.phone || t('suppliers.noPhone')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />
                  <span className="truncate">{sup.email || t('suppliers.noEmail')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-resto-terracotta-600 shrink-0" />
                  <span className="truncate">{sup.address || t('suppliers.defaultAddress')}</span>
                </div>
              </CardContent>

              <CardFooter className="pt-2.5 pb-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 text-xs">
                {/* Statement Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openStatementModal(sup)}
                  leftIcon={<ClipboardList className="w-3.5 h-3.5 text-resto-terracotta-600" />}
                  className="h-8 text-xs font-bold"
                >
                  {t('suppliers.viewStatement')}
                </Button>

                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(sup)}
                      className="h-8 text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteModal(sup)}
                      className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Supplier Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? t('suppliers.editModalTitle') : t('suppliers.createModalTitle')}
        description={t('suppliers.subtitle')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('suppliers.nameLabel')}</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('suppliers.namePlaceholder')}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('suppliers.phoneLabel')}</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+966501234567"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('suppliers.emailLabel')}</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="supplier@company.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('suppliers.taxLabel')}</label>
            <Input
              value={formData.tax_number}
              onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
              placeholder="310123456700003"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t('suppliers.addressLabel')}</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder={t('suppliers.addressPlaceholder')}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingSupplier && (
        <Modal
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          title={t('suppliers.deleteModalTitle')}
          description={t('suppliers.deleteConfirmMessage', { name: deletingSupplier.name })}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" size="md" onClick={() => setIsDeleteDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleDelete}
                isLoading={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Supplier Statement & Transaction History Modal */}
      {statementSupplier && (
        <Modal
          isOpen={!!statementSupplier}
          onClose={() => {
            setStatementSupplier(null);
            setStatementData(null);
          }}
          title={`${t('suppliers.statementTitle')} — ${statementSupplier.name}`}
          description={t('suppliers.statementDesc')}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            {isStatementLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            ) : statementData ? (
              <>
                {/* 4 Financial KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 block">{t('suppliers.statementTotalOrders')}</span>
                    <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
                      {statementData.total_orders}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 block">{t('suppliers.statementTotalOrderedAmount')}</span>
                    <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
                      {formatCurrency(statementData.total_order_amount)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 block">{t('suppliers.statementTotalInvoiced')}</span>
                    <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
                      {formatCurrency(statementData.total_invoiced)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 block">{t('suppliers.statementBalanceDue')}</span>
                    <span
                      className={`text-base font-black font-mono ${
                        statementData.outstanding_balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatCurrency(statementData.outstanding_balance)}
                    </span>
                  </div>
                </div>

                {/* Sub Tab Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full sm:w-fit max-w-full overflow-x-auto text-xs font-semibold">
                  <button
                    onClick={() => setStatementTab('invoices')}
                    className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap min-h-[36px] ${
                      statementTab === 'invoices'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t('suppliers.statementInvoicesTab')} ({statementData.invoices.length})
                  </button>
                  <button
                    onClick={() => setStatementTab('purchases')}
                    className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap min-h-[36px] ${
                      statementTab === 'purchases'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t('suppliers.statementOrdersTab')} ({statementData.purchases.length})
                  </button>
                  <button
                    onClick={() => setStatementTab('receipts')}
                    className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap min-h-[36px] ${
                      statementTab === 'receipts'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t('suppliers.statementReceiptsTab')} ({statementData.receipts.length})
                  </button>
                </div>

                {/* Tab Content: Invoices */}
                {statementTab === 'invoices' && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-60 overflow-y-auto">
                    {statementData.invoices.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">{t('purchaseInvoices.noInvoices')}</div>
                    ) : (
                      <table className="w-full min-w-[460px] text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-2 text-left">{t('purchaseInvoices.invoiceNum')}</th>
                            <th className="p-2 text-left">{t('purchaseInvoices.issueDate')}</th>
                            <th className="p-2 text-center">{t('common.status')}</th>
                            <th className="p-2 text-right font-mono">{t('purchaseInvoices.totalAmount')}</th>
                            <th className="p-2 text-right font-mono">{t('purchaseInvoices.paidAmount')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {statementData.invoices.map(inv => (
                            <tr key={inv.id}>
                              <td className="p-2 font-mono font-bold">{inv.invoice_number}</td>
                              <td className="p-2 font-mono text-slate-500">{inv.issue_date}</td>
                              <td className="p-2 text-center">
                                <Badge
                                  variant={
                                    inv.status === 'POSTED'
                                      ? 'success'
                                      : inv.status === 'DRAFT'
                                      ? 'warning'
                                      : 'destructive'
                                  }
                                  className="text-[9px]"
                                >
                                  {inv.status}
                                </Badge>
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                {formatCurrency(inv.total)}
                              </td>
                              <td className="p-2 text-right font-mono text-emerald-600">
                                {formatCurrency(inv.paid_amount || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Tab Content: Purchase Orders */}
                {statementTab === 'purchases' && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-60 overflow-y-auto">
                    {statementData.purchases.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">{t('purchases.noPurchases')}</div>
                    ) : (
                      <table className="w-full min-w-[420px] text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-2 text-left">{t('purchases.orderNumber')}</th>
                            <th className="p-2 text-left">{t('purchases.orderDate')}</th>
                            <th className="p-2 text-center">{t('common.status')}</th>
                            <th className="p-2 text-right font-mono">{t('purchases.totalCost')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {statementData.purchases.map(po => (
                            <tr key={po.id}>
                              <td className="p-2 font-mono font-bold">{po.invoice_number}</td>
                              <td className="p-2 font-mono text-slate-500">{po.purchase_date}</td>
                              <td className="p-2 text-center">
                                <Badge variant="outline" className="text-[9px]">
                                  {po.status}
                                </Badge>
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-resto-terracotta-600">
                                {formatCurrency(po.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Tab Content: Goods Receipts */}
                {statementTab === 'receipts' && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-60 overflow-y-auto">
                    {statementData.receipts.length === 0 ? (
                      <div className="p-6 text-center text-slate-400">{t('goodsReceipts.noReceipts')}</div>
                    ) : (
                      <table className="w-full min-w-[420px] text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="p-2 text-left">{t('goodsReceipts.receiptNumber')}</th>
                            <th className="p-2 text-left">{t('goodsReceipts.receivedDate')}</th>
                            <th className="p-2 text-center font-mono">{t('goodsReceipts.itemsCount')}</th>
                            <th className="p-2 text-left">{t('common.notes')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {statementData.receipts.map(rcpt => (
                            <tr key={rcpt.id}>
                              <td className="p-2 font-mono font-bold text-emerald-600">{rcpt.receipt_number}</td>
                              <td className="p-2 font-mono text-slate-500">
                                {new Date(rcpt.received_at).toLocaleDateString()}
                              </td>
                              <td className="p-2 text-center font-mono">{rcpt.items?.length || 0}</td>
                              <td className="p-2 italic text-slate-500 truncate max-w-xs">{rcpt.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => window.print()}
                    leftIcon={<Printer className="w-4 h-4" />}
                    className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 text-white font-bold"
                  >
                    {isRtl ? 'طباعة كشف الحساب / حفظ PDF' : 'Print Statement / Save PDF'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatementSupplier(null);
                      setStatementData(null);
                    }}
                  >
                    {t('common.close')}
                  </Button>
                </div>

                {/* Isolated Top-Level A4 Print Portal (Prints complete statement with all 3 tables) */}
                <PrintPortal pageSize="a4" dir={isRtl ? 'rtl' : 'ltr'}>
                  <PrintableSupplierStatement statement={statementData} />
                </PrintPortal>
              </>
            ) : null}
          </div>
        </Modal>
      )}
    </div>
  );
}
