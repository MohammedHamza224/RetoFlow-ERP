import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export interface ProtectedRouteProps {
  moduleId: string;
  children: React.ReactNode;
  onNavigateToAllowed?: (fallbackModule: string) => void;
}

export function ProtectedRoute({ moduleId, children, onNavigateToAllowed }: ProtectedRouteProps) {
  const { user, isAllowed } = useAuth();
  const { t } = useTranslation();

  if (!user) return null;

  const allowed = isAllowed(moduleId);

  if (!allowed) {
    const fallbackModule = user.role_name === 'STAFF' ? 'orders' : 'dashboard';

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6 animate-in fade-in duration-200">
        <Card className="max-w-md w-full border-red-200 dark:border-red-900/50 bg-card shadow-elevated">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <CardTitle className="text-xl font-bold text-red-950 dark:text-red-200">
              {t('protectedRoute.accessRestricted')}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">
              {t('protectedRoute.accessRestrictedDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">{t('protectedRoute.yourRole')}</span>
              <Badge variant="warning" className="font-bold">
                {user.role_name}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('protectedRoute.modulePrefix')} <span className="font-bold text-slate-800 dark:text-slate-200">"{moduleId.toUpperCase()}"</span> {t('protectedRoute.moduleRestricted')}
            </p>
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 pt-4">
            <Button
              variant="primary"
              size="md"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => onNavigateToAllowed && onNavigateToAllowed(fallbackModule)}
              className="w-full"
            >
              {t('protectedRoute.returnToAllowed')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
