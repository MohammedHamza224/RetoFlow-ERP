import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, ShieldAlert, Phone, Mail, MapPin } from 'lucide-react';
import { DatabaseService } from '@/services/db.service';
import { useAuth } from '@/context/AuthContext';
import { Customer, CustomerType } from '@/types/database.types';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCustomers: Customer[];
  onCustomerCreated: (customer: Customer) => void;
}

function normalizePhoneDigits(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Normalize Saudi numbers (+9665... or 9665... -> 05...) for reliable duplicate comparison
  if (digits.startsWith('966') && digits.length >= 11) {
    return '0' + digits.slice(3);
  }
  return digits;
}

export function QuickCustomerModal({
  isOpen,
  onClose,
  existingCustomers,
  onCustomerCreated,
}: QuickCustomerModalProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';

  const canCreateCustomers =
    user?.role_name === 'ADMIN' ||
    user?.role_name === 'MANAGER' ||
    user?.role_name === 'CASHIER';

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    customer_type: 'REGULAR' as CustomerType,
  });
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const submittingLockRef = useRef<boolean>(false);

  // Reset form state cleanly whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        customer_type: 'REGULAR',
      });
      setFormError('');
      setIsSubmitting(false);
      submittingLockRef.current = false;
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting || submittingLockRef.current) return;
    setFormError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingLockRef.current || isSubmitting) return;

    setFormError('');

    if (!canCreateCustomers) {
      setFormError(t('pos.quickCustomerPermissionDenied'));
      return;
    }

    const trimmedName = formData.name.trim();
    const trimmedPhone = formData.phone.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedAddress = formData.address.trim();

    if (!trimmedName) {
      setFormError(t('customers.nameRequired'));
      return;
    }

    if (trimmedPhone) {
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (digitsOnly.length < 7 || !/^[+\d\s()-]{7,30}$/.test(trimmedPhone)) {
        setFormError(t('pos.quickCustomerInvalidPhone'));
        return;
      }

      const normalizedInputPhone = normalizePhoneDigits(trimmedPhone);
      const duplicateCustomer = existingCustomers.find(
        (c) =>
          c.is_active !== false &&
          c.phone &&
          normalizePhoneDigits(c.phone) === normalizedInputPhone
      );

      if (duplicateCustomer) {
        setFormError(`${t('pos.quickCustomerDuplicatePhone')} (${duplicateCustomer.name})`);
        return;
      }
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError(t('pos.quickCustomerInvalidEmail'));
      return;
    }

    submittingLockRef.current = true;
    setIsSubmitting(true);

    try {
      const created = await DatabaseService.createCustomer(user?.id, {
        name: trimmedName,
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
        address: trimmedAddress || undefined,
        customer_type: formData.customer_type,
      });

      onCustomerCreated(created);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create customer.');
    } finally {
      submittingLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('pos.quickCustomerModalTitle')}
      description={t('pos.quickCustomerModalDesc')}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {!canCreateCustomers && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{t('pos.quickCustomerPermissionDenied')}</span>
          </div>
        )}

        {formError && (
          <div
            role="alert"
            data-testid="pos-quick-customer-error"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Customer Name (Required) */}
        <div className="space-y-1.5">
          <label
            htmlFor="pos-quick-customer-name"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
          >
            {t('customers.name')} <span className="text-red-500">*</span>
          </label>
          <Input
            id="pos-quick-customer-name"
            data-testid="pos-quick-customer-name"
            value={formData.name}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, name: e.target.value }));
              if (formError) setFormError('');
            }}
            placeholder={isRtl ? 'مثال: فيصل العتيبي' : 'e.g. Faisal Al-Otaibi'}
            disabled={isSubmitting || !canCreateCustomers}
            autoFocus
            className="min-h-[44px]"
            required
          />
        </div>

        {/* Phone & Customer Type Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="pos-quick-customer-phone"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
            >
              {t('customers.phone')}
            </label>
            <Input
              id="pos-quick-customer-phone"
              data-testid="pos-quick-customer-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, phone: e.target.value }));
                if (formError) setFormError('');
              }}
              placeholder="+966 50 000 0000"
              leftIcon={<Phone className="w-3.5 h-3.5" />}
              disabled={isSubmitting || !canCreateCustomers}
              className="min-h-[44px]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="pos-quick-customer-type"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
            >
              {t('customers.customerType')}
            </label>
            <select
              id="pos-quick-customer-type"
              data-testid="pos-quick-customer-type"
              value={formData.customer_type}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  customer_type: e.target.value as CustomerType,
                }))
              }
              disabled={isSubmitting || !canCreateCustomers}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
            >
              <option value="REGULAR">{t('customers.regular')}</option>
              <option value="VIP">{t('customers.vip')}</option>
              <option value="GUEST">{t('customers.guest')}</option>
            </select>
          </div>
        </div>

        {/* Email & Address (Optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="pos-quick-customer-email"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
            >
              {t('customers.email')}
            </label>
            <Input
              id="pos-quick-customer-email"
              data-testid="pos-quick-customer-email"
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, email: e.target.value }));
                if (formError) setFormError('');
              }}
              placeholder="customer@example.com"
              leftIcon={<Mail className="w-3.5 h-3.5" />}
              disabled={isSubmitting || !canCreateCustomers}
              className="min-h-[44px]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="pos-quick-customer-address"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
            >
              {t('customers.address')}
            </label>
            <Input
              id="pos-quick-customer-address"
              data-testid="pos-quick-customer-address"
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder={t('customers.addressPlaceholder')}
              leftIcon={<MapPin className="w-3.5 h-3.5" />}
              disabled={isSubmitting || !canCreateCustomers}
              className="min-h-[44px]"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            size="md"
            type="button"
            data-testid="pos-quick-customer-cancel"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px]"
          >
            {t('common.cancel')}
          </Button>

          <Button
            variant="primary"
            size="md"
            type="submit"
            data-testid="pos-quick-customer-submit"
            isLoading={isSubmitting}
            disabled={isSubmitting || !canCreateCustomers}
            leftIcon={<UserPlus className="w-4 h-4" />}
            className="min-h-[44px] bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold text-white"
          >
            {t('pos.saveAndAddToOrder')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
