'use client';
import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-primary-400 hover:bg-primary-500 text-dark-950 font-bold shadow-[0_0_15px_rgba(251,146,60,0.25)] hover:shadow-[0_0_25px_rgba(251,146,60,0.4)]',
      gold: 'bg-accent-400 hover:bg-accent-500 text-dark-950 font-bold shadow-[0_0_15px_rgba(240,176,0,0.2)] hover:shadow-[0_0_25px_rgba(240,176,0,0.35)]',
      secondary: 'bg-dark-700 hover:bg-dark-600 text-dark-100 border border-dark-600 hover:border-primary-400/30',
      danger: 'bg-neon-red/90 hover:bg-neon-red text-white shadow-[0_0_10px_rgba(255,51,85,0.2)]',
      ghost: 'hover:bg-dark-700/50 text-dark-300 hover:text-white',
      outline: 'border border-dark-600 hover:border-primary-400/40 text-dark-200 hover:text-primary-400',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
