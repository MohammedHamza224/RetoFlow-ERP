import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat, Lock, Mail, Eye, EyeOff, ArrowRight, AlertCircle, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { setAppLanguage } from '@/i18n/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserRole } from '@/types/database.types';
import { supabase } from '@/lib/supabase';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { ResetPasswordModal } from './ResetPasswordModal';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const isRtl = i18n.language === 'ar';

  const [email, setEmail] = useState('admin@restoflow.sa');
  const [password, setPassword] = useState('demo123');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMIN');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Password Recovery Modals State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  useEffect(() => {
    // Listen for Supabase password recovery hash or auth state change
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetPasswordOpen(true);
      }
    });

    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsResetPasswordOpen(true);
    }

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const roleEmailMap: Record<UserRole, string> = {
    ADMIN: 'admin@restoflow.sa',
    MANAGER: 'manager@restoflow.sa',
    CASHIER: 'cashier@restoflow.sa',
    STAFF: 'staff@restoflow.sa',
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setEmail(roleEmailMap[role]);
    setError('');
  };

  const toggleLanguage = () => {
    const nextLang = isRtl ? 'en' : 'ar';
    setAppLanguage(nextLang);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError(isRtl ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || (isRtl ? 'فشل تسجيل الدخول. يرجى التحقق من البيانات.' : 'Authentication failed. Please check your credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-resto-charcoal-950 text-slate-100 overflow-hidden font-sans select-none">
      
      {/* ------------------------------------------------------------------ */}
      {/* LEFT COLUMN / FORM SIDE: Minimal, Clean & Professional Login      */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-full lg:w-5/12 xl:w-4/12 flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-resto-charcoal-950 border-r border-resto-charcoal-800/60 z-20">
        
        {/* Top Header Bar with Language Switcher */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-resto-terracotta-600 to-resto-terracotta-500 flex items-center justify-center text-white shadow-md shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <span className="font-display text-xl font-bold text-white tracking-wide">
              Resto<span className="text-resto-terracotta-500">Flow</span>
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            leftIcon={<Globe className="w-4 h-4 text-resto-terracotta-500" />}
            className="text-slate-400 hover:text-white text-xs font-semibold hover:bg-resto-charcoal-900"
          >
            {isRtl ? 'English (EN)' : 'العربية (AR)'}
          </Button>
        </div>

        {/* Form Body */}
        <div className="my-auto py-8 space-y-7">
          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isRtl ? 'مرحبا بكم 👋' : 'Welcome Back 👋'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-light">
              {isRtl ? 'أدخل بيانات حسابك للوصول إلى نظام المطعم' : 'Enter your staff credentials to access the restaurant workspace'}
            </p>
          </div>

          {/* Quick Demo Role Credentials Selection */}
          <div className="p-3.5 rounded-xl bg-resto-charcoal-900 border border-resto-charcoal-800 space-y-2.5">
            <span className="text-[11px] text-slate-400 font-medium block">
              {t('auth.selectAccount')}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {(['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'] as UserRole[]).map((r) => {
                const roleLabelMap: Record<UserRole, string> = {
                  ADMIN: isRtl ? 'مسؤول النظام' : 'ADMIN',
                  MANAGER: isRtl ? 'المدير' : 'MANAGER',
                  CASHIER: isRtl ? 'الكاشير' : 'CASHIER',
                  STAFF: isRtl ? 'الموظف' : 'STAFF',
                };
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleSelect(r)}
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                      selectedRole === r
                        ? 'bg-resto-terracotta-600 text-white border-resto-terracotta-500 shadow-sm'
                        : 'bg-resto-charcoal-800 text-slate-400 border-slate-700/60 hover:text-slate-200'
                    }`}
                  >
                    {roleLabelMap[r]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                className="bg-resto-charcoal-900 border-resto-charcoal-800 text-white focus-visible:ring-resto-terracotta-500"
                placeholder="staff@restoflow.sa"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                {isRtl ? 'كلمة المرور' : 'Password'}
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                className="bg-resto-charcoal-900 border-resto-charcoal-800 text-white focus-visible:ring-resto-terracotta-500"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Remember Me & Forgot Password Link */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-700 text-resto-terracotta-600 focus:ring-resto-terracotta-500 bg-resto-charcoal-900"
                />
                <span>{isRtl ? 'تذكرني' : 'Remember me'}</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-resto-terracotta-500 hover:text-resto-terracotta-400 font-semibold hover:underline transition-colors"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              size="lg"
              className="w-full bg-resto-terracotta-600 hover:bg-resto-terracotta-500 text-white font-bold"
              rightIcon={<ArrowRight className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />}
            >
              {isLoading ? (isRtl ? 'جاري التحقق...' : 'Signing In...') : (isRtl ? 'تسجيل الدخول' : 'Sign In')}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500">
          &copy; {new Date().getFullYear()} RestoFlow Restaurant System
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT COLUMN / BRAND SIDE: Lighter, Warmer Dining Showcase         */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden lg:flex lg:w-7/12 xl:w-8/12 relative bg-resto-charcoal-950 overflow-hidden flex-col items-center justify-center text-center p-12 select-none">
        
        {/* Background Atmosphere Dining Image (High Brightness & Warm Clarity) */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('/assets/resto_brand_cover.jpg')`,
          }}
        />

        {/* Softer, Warmer Ambient Overlays (Lighter for Eye Comfort) */}
        <div className="absolute inset-0 bg-gradient-to-t from-resto-charcoal-950/70 via-resto-charcoal-950/30 to-resto-charcoal-950/15 z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-resto-charcoal-950/60 via-transparent to-resto-charcoal-950/40 z-10" />

        {/* Pure Restaurant Brand Identity Content */}
        <div className="relative z-20 max-w-xl space-y-6 flex flex-col items-center drop-shadow-md">
          
          {/* Prominent Restaurant Brand Mark Icon */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-resto-terracotta-600 to-resto-terracotta-500 flex items-center justify-center text-white shadow-2xl ring-4 ring-resto-terracotta-500/30 mb-2 transform hover:scale-105 transition-transform duration-300">
            <ChefHat className="w-11 h-11" />
          </div>

          {/* Restaurant Brand Name */}
          <h1 className="font-display text-5xl sm:text-6xl font-black text-white tracking-wide drop-shadow-lg">
            Resto<span className="text-resto-terracotta-500">Flow</span>
          </h1>

          {/* Short Hospitality-Oriented Tagline */}
          <p className="font-display text-xl sm:text-2xl font-semibold text-amber-100 tracking-widest uppercase drop-shadow">
            {isRtl ? 'تذوّق · استمتع · تميّز' : 'Taste . Serve . Grow'}
          </p>

          {/* Decorative Warm Divider */}
          <div className="w-20 h-1.5 rounded-full bg-gradient-to-r from-transparent via-resto-terracotta-500 to-transparent my-2 shadow-sm" />

          {/* Short Atmosphere Sub-heading */}
          <p className="text-sm text-slate-100 font-medium max-w-md leading-relaxed drop-shadow">
            {isRtl
              ? 'ضيافة متميزة وتجربة طعام استثنائية'
              : 'Crafted dining experiences, memorable hospitality, and culinary excellence'}
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        defaultEmail={email}
      />

      {/* Reset Password Modal (Triggered by Recovery Email Link) */}
      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        onSuccess={() => {
          setIsResetPasswordOpen(false);
          setError('');
        }}
      />
    </div>
  );
}
