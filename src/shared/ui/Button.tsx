import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-primary text-text-inverse border-transparent hover:bg-brand-primary-hover',
  secondary: 'bg-surface-solid text-text-primary border-border-subtle hover:bg-surface-muted',
  danger: 'bg-danger text-text-inverse border-transparent hover:opacity-95',
};

/**
 * Accessible button enforcing minimum 44x44 CSS px touch target (min-h-11 min-w-11).
 */
export function Button({
  variant = 'secondary',
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_STYLES[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
