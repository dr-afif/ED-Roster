import type { HTMLAttributes, ReactNode } from 'react';

type SurfaceVariant = 'glass' | 'solid';

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant;
  children: ReactNode;
};

/**
 * Enforces blueprint surface rules:
 * - 'glass': restrained frosted glass for summary cards, navigation, and dialogs
 * - 'solid': opaque white surface for forms, tables, and dense roster grids
 */
export function SurfaceCard({
  variant = 'solid',
  className = '',
  children,
  ...rest
}: SurfaceCardProps) {
  const surfaceClass =
    variant === 'glass'
      ? 'surface-frosted shadow-xs'
      : 'surface-opaque bg-surface-primary border border-border-default/80 shadow-2xs hover:shadow-xs transition-shadow duration-150';
  return (
    <div className={`${surfaceClass} rounded-2xl p-5 ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
