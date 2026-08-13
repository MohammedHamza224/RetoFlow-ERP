import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthService } from '@/services/auth.service';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function ForgotPasswordModal({ isOpen, onClose, defaultEmail = '' }: ForgotPasswordModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [email, setEmail] = useState(defaultEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError(isRtl ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      await AuthService.sendPasswordResetEmail(trimmedEmail);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || (isRtl ? 'حدث خطأ، يرجى المحاولة مرة أخرى.' : 'An error occurred. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('auth.forgotPassword')}
      description={t('auth.forgotPasswordDesc')}
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
                {t('auth.checkYourEmail')}
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {isRtl
                  ? `أرسلنا رابط إعادة التعيين إلى ${email}. تحقق من صندوق الوارد الخاص بك.`
                  : `We sent a password reset link to ${email}. Please check your inbox.`}
              </p>
            </div>

            <Button
              variant="outline"
              size="md"
              onClick={handleClose}
              leftIcon={<ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />}
              className="w-full mt-4"
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
                {t('auth.emailLabel')}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-resto-terracotta-600" />}
                placeholder="staff@restoflow.sa"
                className="h-10 text-xs"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              disabled={isLoading || !email}
              rightIcon={<Send className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />}
              className="w-full bg-resto-terracotta-600 hover:bg-resto-terracotta-500 font-bold"
            >
              {isLoading ? (isRtl ? 'جاري الإرسال...' : 'Sending Link...') : t('auth.sendResetLink')}
            </Button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleClose}
                className="text-xs font-semibold text-slate-500 hover:text-resto-terracotta-600 flex items-center justify-center gap-1.5 mx-auto"
              >
                <ArrowLeft className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                {t('auth.backToLogin')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
