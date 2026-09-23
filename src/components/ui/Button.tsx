import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-[var(--shadow-button)] disabled:bg-brand-300 disabled:shadow-none',
  secondary: 'bg-ink-100 text-ink-800 hover:bg-ink-200',
  outline: 'bg-white text-ink-700 border border-ink-200 hover:bg-ink-50',
  ghost: 'bg-transparent text-ink-600 hover:bg-ink-100',
  danger: 'bg-danger text-white hover:bg-red-700 disabled:opacity-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  iconRight,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
