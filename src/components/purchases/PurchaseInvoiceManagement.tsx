import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Plus,
  Search,
  Printer,
  Trash2,
  DollarSign,
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Ban,
  ArrowRightLeft,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { PurchaseInvoice, Purchase, Supplier, Product, InvoiceStatus, InvoicePaymentStatus } from '@/types/database.types';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { PrintablePurchaseInvoice } from './PrintablePurchaseInvoice';

interface PurchaseInvoiceManagementProps {
  initialPurchaseId?: string;
  onInvoiceCreated?: () => void;
}

export function PurchaseInvoiceManagement({ initialPurchaseId, onInvoiceCreated }: PurchaseInvoiceManagementProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';
  const canEdit = user?.role_name === 'ADMIN' || user?.role_name === 'MANAGER';

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>(() => DatabaseService.getCachedPurchaseInvoicesSync() || []);
  const [purchases, setPurchases] = useState<Purchase[]>(() => DatabaseService.getCachedPurchasesSync() || []);
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => DatabaseService.getCachedSuppliersSync() || []);
  const [isLoading, setIsLoading] = useState(() => !invoices || invoices.length === 0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | InvoicePaymentStatus>('ALL');

  // New Invoice Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<string>(initialPurchaseId || '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('POSTED');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Print Modal
  const [printingInvoice, setPrintingInvoice] = useState<PurchaseInvoice | null>(null);

  // Delete / Cancel Dialog
  const [deletingInvoice, setDeletingInvoice] = useState<PurchaseInvoice | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Payment Modal
  const [payingInvoice, setPayingInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const loadData = useCallback(async (showSkeleton: boolean = false) => {
    if (showSkeleton) setIsLoading(true);
    try {
      const [invData, purData, supData] = await Promise.all([
        DatabaseService.getPurchaseInvoices(),
        DatabaseService.getPurchases(),
        DatabaseService.getSuppliers(),
      ]);
      setInvoices(invData);
      setPurchases(purData);
      setSuppliers(supData);
    } catch (err: any) {
      console.error('Failed to load purchase invoices:', err);
    } finally {
      if (showSkeleton) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(invoices.length === 0);
  }, [loadData]);

  // Open modal automatically if initialPurchaseId passed
  useEffect(() => {
    if (initialPurchaseId && purchases.length > 0) {
      setSelectedPoId(initialPurchaseId);
      setIsModalOpen(true);
    }
  }, [initialPurchaseId, purchases]);

  const openCreateModal = () => {
    setSelectedPoId(purchases.length > 0 ? purchases[0].id : '');
    setSupplierInvoiceNumber('');
    setDueDate('');
    setNotes('');
    setInvoiceStatus('POSTED');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCreateInvoiceFromPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPoId) {
      setFormError(t('purchaseInvoices.selectPoRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await DatabaseService.createPurchaseInvoiceFromPO(
        user?.id,
        selectedPoId,
        supplierInvoiceNumber.trim() || undefined
      );

      setIsModalOpen(false);
      await loadData(false);
      if (onInvoiceCreated) onInvoiceCreated();
    } catch (err: any) {
      setFormError(err.message || t('purchaseInvoices.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrCancel = async () => {
    if (!deletingInvoice) return;
    setIsSubmitting(true);
    try {
      if (deletingInvoice.status === 'DRAFT') {
        // Safe delete draft
        await DatabaseService.deletePurchaseInvoice(user?.id, deletingInvoice.id);
      } else {
        // Cancel posted invoice for audit safety
        await DatabaseService.updatePurchaseInvoice(user?.id, deletingInvoice.id, {
          status: 'CANCELLED',
          notes: deletingInvoice.notes ? `${deletingInvoice.notes} | CANCELLED` : 'CANCELLED',
        });
      }
      setIsDeleteDialogOpen(false);
      setDeletingInvoice(null);
      await loadData(false);
    } catch (err: any) {
      alert(err.message || t('purchaseInvoices.actionFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;

    const currentPaid = payingInvoice.paid_amount || 0;
    const newTotalPaid = currentPaid + paymentAmount;
    const newPaymentStatus: InvoicePaymentStatus =
      newTotalPaid >= payingInvoice.total ? 'PAID' : newTotalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    setIsSubmitting(true);
    try {
      await DatabaseService.updatePurchaseInvoice(user?.id, payingInvoice.id, {
        paid_amount: newTotalPaid,
        payment_status: newPaymentStatus,
      });
      setPayingInvoice(null);
      await loadData(false);
    } catch (err: any) {
      alert(err.message || t('purchaseInvoices.paymentFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPO = useMemo(() => {
    return purchases.find(p => p.id === selectedPoId);
  }, [purchases, selectedPoId]);

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return invoices.filter(inv => {
      const matchesSearch =
        !term ||
        inv.invoice_number.toLowerCase().includes(term) ||
        (inv.supplier_invoice_number && inv.supplier_invoice_number.toLowerCase().includes(term)) ||
        (inv.supplier && inv.supplier.name.toLowerCase().includes(term)) ||
        (inv.purchase && inv.purchase.invoice_number.toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      const matchesPayment = paymentFilter === 'ALL' || inv.payment_status === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [invoices, searchTerm, statusFilter, paymentFilter]);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-resto-charcoal-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-resto-terracotta-600" />
            {t('purchaseInvoices.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('purchaseInvoices.subtitle')} ({invoices.length} {t('purchaseInvoices.invoiceCount')})
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
            {t('purchaseInvoices.createFromPO')}
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="w-full md:w-80">
          <Input
            placeholder={t('purchaseInvoices.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-resto-terracotta-500"
          >
            <option value="ALL">{t('common.allStatuses')}</option>
            <option value="POSTED">{t('purchaseInvoices.status.POSTED')}</option>
            <option value="DRAFT">{t('purchaseInvoices.status.DRAFT')}</option>
            <option value="CANCELLED">{t('purchaseInvoices.status.CANCELLED')}</option>
          </select>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-resto-terracotta-500"
          >
            <option value="ALL">{t('purchaseInvoices.allPaymentStatuses')}</option>
            <option value="UNPAID">{t('purchaseInvoices.paymentStatus.UNPAID')}</option>
            <option value="PARTIALLY_PAID">{t('purchaseInvoices.paymentStatus.PARTIALLY_PAID')}</option>
            <option value="PAID">{t('purchaseInvoices.paymentStatus.PAID')}</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredInvoices.length === 0 && (
        <div className="p-12 text-center bg-card rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="font-display text-base font-bold text-slate-800 dark:text-slate-200">
            {t('purchaseInvoices.noInvoices')}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('purchaseInvoices.noInvoicesDesc')}
          </p>
        </div>
      )}

      {/* Invoices Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInvoices.map(inv => {
            const balanceDue = Math.max(0, inv.total - (inv.paid_amount || 0));

            return (
              <Card
                key={inv.id}
                className="relative overflow-hidden bg-card hover:shadow-card transition-all border flex flex-col justify-between"
              >
                <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <CardTitle className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 truncate">
                      {inv.invoice_number}
                    </CardTitle>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block truncate">
                      {inv.supplier?.name || t('suppliers.name')}
                    </span>
                    {inv.supplier_invoice_number && (
                      <span className="text-[11px] font-mono text-slate-400 block truncate">
                        {t('purchaseInvoices.supplierInvRef')}: {inv.supplier_invoice_number}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant={
                        inv.status === 'POSTED'
                          ? 'success'
                          : inv.status === 'DRAFT'
                          ? 'warning'
                          : 'destructive'
                      }
                      className="text-[10px]"
                    >
                      {t(`purchaseInvoices.status.${inv.status}`)}
                    </Badge>
                    <Badge
                      variant={
                        inv.payment_status === 'PAID'
                          ? 'success'
                          : inv.payment_status === 'PARTIALLY_PAID'
                          ? 'warning'
                          : 'outline'
                      }
                      className="text-[10px]"
                    >
                      {t(`purchaseInvoices.paymentStatus.${inv.payment_status}`)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pb-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">{t('purchaseInvoices.issueDate')}</span>
                    <span className="font-mono">{inv.issue_date}</span>
                  </div>

                  {inv.purchase && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">{t('purchaseInvoices.poRef')}</span>
                      <span className="font-mono font-bold text-resto-terracotta-600">
                        {inv.purchase.invoice_number}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">{t('purchases.subtotal')}</span>
                    <span className="font-mono">{formatCurrency(inv.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">{t('purchases.tax')} (15%)</span>
                    <span className="font-mono">{formatCurrency(inv.tax)}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-black text-slate-900 dark:text-slate-100">
                    <span>{t('purchaseInvoices.totalAmount')}</span>
                    <span className="font-mono text-resto-terracotta-600">{formatCurrency(inv.total)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>{t('purchaseInvoices.paidAmount')}</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {formatCurrency(inv.paid_amount || 0)}
                    </span>
                  </div>

                  {balanceDue > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold text-rose-600 pt-1 border-t border-dashed border-rose-200">
                      <span>{t('purchaseInvoices.balanceDue')}</span>
                      <span className="font-mono">{formatCurrency(balanceDue)}</span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2.5 pb-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 text-xs gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPrintingInvoice(inv)}
                    leftIcon={<Printer className="w-3.5 h-3.5" />}
                    className="h-8 text-xs font-bold"
                  >
                    {t('common.print')}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {canEdit && balanceDue > 0 && inv.status !== 'CANCELLED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setPayingInvoice(inv);
                          setPaymentAmount(balanceDue);
                        }}
                        leftIcon={<DollarSign className="w-3.5 h-3.5" />}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                      >
                        {t('purchaseInvoices.pay')}
                      </Button>
                    )}

                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingInvoice(inv);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Purchase Invoice From PO Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('purchaseInvoices.modalTitle')}
        description={t('purchaseInvoices.modalDesc')}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateInvoiceFromPO} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Select Purchase Order */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('purchaseInvoices.selectPoLabel')}
            </label>
            <select
              value={selectedPoId}
              onChange={(e) => setSelectedPoId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
              required
            >
              <option value="">{t('purchaseInvoices.selectPoPlaceholder')}</option>
              {purchases.map(p => (
                <option key={p.id} value={p.id}>
                  {p.invoice_number} — {p.supplier?.name} ({formatCurrency(p.total)})
                </option>
              ))}
            </select>
          </div>

          {/* PO Items Preview (Guarantees 100% of items transferred) */}
          {selectedPO && selectedPO.items && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('purchaseInvoices.transferItemsHeader')} ({selectedPO.items.length}{' '}
                  {t('purchaseInvoices.itemsTransferred')})
                </span>
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('purchaseInvoices.fullTransferGuaranteed')}
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full min-w-[500px] text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">{t('purchases.product')}</th>
                      <th className="p-2 text-center font-mono w-16">{t('purchases.qty')}</th>
                      <th className="p-2 text-right font-mono w-24">{t('purchases.unitCost')}</th>
                      <th className="p-2 text-right font-mono w-24">{t('purchases.totalCost')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedPO.items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2 font-medium">{item.product?.name || item.product_id}</td>
                        <td className="p-2 text-center font-mono font-bold">{item.quantity}</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(item.unit_cost)}</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatCurrency(item.quantity * item.unit_cost * 1.15)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex justify-end gap-6 text-xs font-mono pt-1 text-slate-700 dark:text-slate-300">
                <span>{t('purchases.subtotal')}: {formatCurrency(selectedPO.subtotal)}</span>
                <span>{t('purchases.tax')}: {formatCurrency(selectedPO.tax)}</span>
                <span className="font-bold text-resto-terracotta-600">
                  {t('purchaseInvoices.totalAmount')}: {formatCurrency(selectedPO.total)}
                </span>
              </div>
            </div>
          )}

          {/* Supplier External Invoice Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('purchaseInvoices.externalInvNumLabel')}
              </label>
              <Input
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="e.g. SUP-2026-9988"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('purchaseInvoices.dueDateLabel')}
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('common.notes')}
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('purchaseInvoices.notesPlaceholder')}
              className="text-xs"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" size="md" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>

            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              disabled={!selectedPoId}
              className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {t('purchaseInvoices.generateInvoiceButton')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete / Cancel Confirmation Modal */}
      {deletingInvoice && (
        <Modal
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          title={
            deletingInvoice.status === 'DRAFT'
              ? t('purchaseInvoices.deleteDraftTitle')
              : t('purchaseInvoices.cancelInvoiceTitle')
          }
          description={
            deletingInvoice.status === 'DRAFT'
              ? t('purchaseInvoices.deleteDraftDesc')
              : t('purchaseInvoices.cancelInvoiceDesc')
          }
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs space-y-1">
              <p className="font-bold text-amber-900 dark:text-amber-200">
                {t('purchaseInvoices.invoiceNum')}: {deletingInvoice.invoice_number}
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                {t('suppliers.name')}: {deletingInvoice.supplier?.name}
              </p>
              <p className="font-mono font-bold text-amber-900 dark:text-amber-200">
                {t('purchaseInvoices.totalAmount')}: {formatCurrency(deletingInvoice.total)}
              </p>
            </div>

            {deletingInvoice.status === 'POSTED' && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t('purchaseInvoices.postedCancelNotice')}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDeleteOrCancel}
                isLoading={isSubmitting}
                className={
                  deletingInvoice.status === 'DRAFT'
                    ? 'bg-red-600 hover:bg-red-700 font-bold text-white'
                    : 'bg-amber-600 hover:bg-amber-700 font-bold text-white'
                }
              >
                {deletingInvoice.status === 'DRAFT'
                  ? t('common.confirmDelete')
                  : t('purchaseInvoices.confirmCancel')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Payment Modal */}
      {payingInvoice && (
        <Modal
          isOpen={!!payingInvoice}
          onClose={() => setPayingInvoice(null)}
          title={`${t('purchaseInvoices.recordPaymentTitle')} — ${payingInvoice.invoice_number}`}
          description={t('purchaseInvoices.recordPaymentDesc')}
          maxWidth="sm"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between">
                <span>{t('purchaseInvoices.totalAmount')}:</span>
                <span className="font-mono font-bold">{formatCurrency(payingInvoice.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('purchaseInvoices.paidAmount')}:</span>
                <span className="font-mono text-emerald-600">{formatCurrency(payingInvoice.paid_amount || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-rose-600 pt-1 border-t border-slate-200">
                <span>{t('purchaseInvoices.balanceDue')}:</span>
                <span className="font-mono">
                  {formatCurrency(Math.max(0, payingInvoice.total - (payingInvoice.paid_amount || 0)))}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('purchaseInvoices.paymentAmountLabel')}
              </label>
              <Input
                type="number"
                min="0.01"
                max={Math.max(0, payingInvoice.total - (payingInvoice.paid_amount || 0))}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="text-xs font-mono font-bold text-emerald-700"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" size="sm" type="button" onClick={() => setPayingInvoice(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white"
              >
                {t('purchaseInvoices.savePayment')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Printable Invoice Modal */}
      {printingInvoice && (
        <Modal
          isOpen={!!printingInvoice}
          onClose={() => setPrintingInvoice(null)}
          title=""
          maxWidth="2xl"
        >
          <PrintablePurchaseInvoice
            invoice={printingInvoice}
            onClose={() => setPrintingInvoice(null)}
          />
        </Modal>
      )}
    </div>
  );
}
