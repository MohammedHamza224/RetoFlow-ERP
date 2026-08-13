import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthService } from '@/services/auth.service';

export interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetPasswordModal({ isOpen, onClose, onSuccess }: ResetPasswordModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError(isRtl ? 'يجب أن تتكون كلمة المرور من 6 خانات على الأقل.' : 'Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);

    try {
      await AuthService.updatePassword(newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || t('auth.errorOccurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    setIsSuccess(false);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    onSuccess();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('auth.resetPassword')}
      description={isRtl ? 'أدخل كلمة المرور الجديدة لحسابك' : 'Enter your new password below'}
      maxWidth="sm"
    >
      <div className="space-y-5 py-2 select-none">
        {isSuccess ? (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                {t('auth.resetPasswordSuccess')}
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {isRtl ? 'يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.' : 'You can now sign in with your new password.'}
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleFinish}
              className="w-full mt-4 bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {t('auth.backToLogin')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('auth.newPassword')}
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-resto-terracotta-600" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                placeholder="••••••••"
                className="h-10 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('auth.confirmPassword')}
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<KeyRound className="w-4 h-4 text-resto-terracotta-600" />}
                placeholder="••••••••"
                className="h-10 text-xs"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              disabled={isLoading || !newPassword || !confirmPassword}
              className="w-full bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {isLoading ? (isRtl ? 'جاري الحفظ...' : 'Updating...') : t('auth.resetPassword')}
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
