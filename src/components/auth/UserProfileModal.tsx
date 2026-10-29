import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Shield, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { t, i18n } = useTranslation();
  const { user, updateUserProfile } = useAuth();
  const isRtl = i18n.language === 'ar';

  const [name, setName] = useState(user?.name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
    setSuccessMessage('');
    setErrorMessage('');
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(isRtl ? 'يرجى إدخال اسم مستخدم صحيح.' : 'Please enter a valid display name.');
      return;
    }

    if (trimmedName.length > 100) {
      setErrorMessage(isRtl ? 'لا يمكن أن يتجاوز الاسم 100 حرف.' : 'Name cannot exceed 100 characters.');
      return;
    }

    // Avoid unnecessary request if name hasn't changed
    if (user && trimmedName === user.name) {
      setSuccessMessage(isRtl ? 'تم تحديث الملف الشخصي بنجاح.' : 'Profile updated successfully.');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateUserProfile(trimmedName);
      setSuccessMessage(isRtl ? 'تم تحديث الملف الشخصي بنجاح.' : 'Profile updated successfully.');
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setErrorMessage(err.message || (isRtl ? 'فشل تحديث الملف الشخصي. يرجى المحاولة مرة أخرى.' : 'Failed to update profile. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSuccessMessage('');
    setErrorMessage('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isRtl ? 'الملف الشخصي' : 'User Profile Settings'}
      description={isRtl ? 'إدارة وتحديث بيانات الحساب الشخصي' : 'Manage your staff profile credentials and display preferences'}
      maxWidth="md"
    >
      <div className="space-y-5 py-2 select-none">
        {/* User Card Summary Banner */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-resto-charcoal-800 text-white font-bold text-xl flex items-center justify-center shadow-md shrink-0 border-2 border-resto-terracotta-500 font-mono">
            {user?.name?.charAt(0) || 'U'}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <h4 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {user?.name || 'Authenticated User'}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="truncate">{user?.email}</span>
              <span>&bull;</span>
              <Badge variant="warning" className="text-[10px] px-1.5 py-0 font-mono">
                {user?.role_name || 'STAFF'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Feedback Banners */}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isRtl ? 'الاسم الظاهر *' : 'Full Display Name *'}
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSuccessMessage('');
                setErrorMessage('');
              }}
              leftIcon={<User className="w-4 h-4 text-resto-terracotta-600" />}
              placeholder={isRtl ? 'الاسم الكامل' : 'Full Name'}
              className="h-10 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">
                {isRtl ? 'البريد الإلكتروني (غير قابل للتعديل)' : 'Email Address (Read-only)'}
              </label>
              <Input
                value={user?.email || ''}
                disabled
                leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
                className="h-10 text-xs opacity-60 bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">
                {isRtl ? 'الدور الوظيفي (غير قابل للتعديل)' : 'Assigned Role (Read-only)'}
              </label>
              <Input
                value={user?.role_name || 'STAFF'}
                disabled
                leftIcon={<Shield className="w-4 h-4 text-slate-400" />}
                className="h-10 text-xs opacity-60 bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={handleClose}
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>

            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !name.trim()}
              leftIcon={<Save className="w-4 h-4" />}
              className="bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {isSubmitting
                ? (isRtl ? 'جاري الحفظ...' : 'Saving Changes...')
                : (isRtl ? 'حفظ التغييرات' : 'Save Changes')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
