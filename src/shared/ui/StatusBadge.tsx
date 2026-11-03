import { AlertTriangle, CheckCircle2, Info, ShieldAlert, type LucideIcon } from 'lucide-react';

export type BadgeTone = 'neutral' | 'brand' | 'teal' | 'success' | 'warning' | 'danger';

type StatusBadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
};

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary border-border-subtle',
  brand: 'bg-brand-primary-soft text-brand-primary border-brand-primary/25',
  teal: 'bg-brand-secondary-soft text-brand-secondary border-brand-secondary/25',
  success: 'bg-success-soft text-success border-success-border',
  warning: 'bg-warning-soft text-warning border-warning-border',
  danger: 'bg-danger-soft text-danger border-danger-border',
};

const DEFAULT_ICONS: Record<BadgeTone, LucideIcon> = {
  neutral: Info,
  brand: Info,
  teal: CheckCircle2,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: ShieldAlert,
};

export function StatusBadge({ label, tone = 'neutral', icon }: StatusBadgeProps) {
  const Icon = icon ?? DEFAULT_ICONS[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none ${TONE_STYLES[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
