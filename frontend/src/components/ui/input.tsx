'use client';
import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-dark-300">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 bg-dark-800/80 border border-dark-600 rounded-lg text-white placeholder-dark-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400/50',
            'transition-all duration-300',
            error && 'border-neon-red focus:ring-neon-red/30',
            className,
          )}
          {...props}
        />
        {error && <p className="text-sm text-neon-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
