import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1">
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute ltr:left-3 rtl:right-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              'flex h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all',
              leftIcon && 'ltr:pl-10 rtl:pr-10',
              rightIcon && 'ltr:pr-10 rtl:pl-10',
              error && 'border-red-500 focus-visible:ring-red-500',
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute ltr:right-3 rtl:left-3 text-slate-400 dark:text-slate-500 flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <span className="text-xs text-red-500 font-medium px-0.5">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
