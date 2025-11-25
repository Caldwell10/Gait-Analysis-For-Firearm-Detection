import { forwardRef, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', loading = false, className = '', disabled, ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center rounded-2xl border font-semibold tracking-tight transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8b5cf6]/70 focus:ring-offset-[var(--tg-color-bg)] heading-font';

    const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'border-transparent bg-gradient-to-r from-[#8b5cf6] via-[#6366f1] to-[#0ea5e9] text-white shadow-[0_14px_35px_rgba(99,102,241,0.28)] hover:shadow-[0_18px_40px_rgba(99,102,241,0.32)] hover:brightness-110 active:brightness-95 disabled:opacity-50',
      secondary:
        'border-[var(--tg-color-border)] bg-[var(--tg-color-surface-subtle)] text-[var(--tg-color-text)] hover:border-[var(--tg-color-border-strong)] hover:bg-white/15 disabled:opacity-50',
      danger:
        'border-transparent bg-rose-500/90 text-white hover:bg-rose-400 disabled:bg-rose-500/40',
    };

    const sizeClasses = {
      sm: 'px-3 py-2 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const isDisabled = disabled || loading;

    const buttonClasses = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      isDisabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer',
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg
            className="-ml-1 mr-3 h-5 w-5 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
