import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={cn(
          'relative w-full bg-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-elevated overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200',
          maxWidthes[maxWidth]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0 pr-2">
            <h3 className="font-display text-base sm:text-lg font-bold text-resto-charcoal-900 dark:text-slate-100 truncate">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shrink-0 -mr-2"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 sm:gap-3 flex-wrap">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
