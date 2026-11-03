import { CheckCircle2, CloudOff, Loader2, ShieldAlert } from 'lucide-react';

export type SaveStatusKind = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

type SaveStatusBarProps = {
  state: SaveStatusKind;
  label: string;
  revision?: number;
};

export function SaveStatusBar({ state, label, revision }: SaveStatusBarProps) {
  const Icon =
    state === 'saving'
      ? Loader2
      : state === 'conflict' || state === 'error'
        ? ShieldAlert
        : state === 'idle'
          ? CloudOff
          : CheckCircle2;

  const toneClass =
    state === 'conflict' || state === 'error'
      ? 'bg-danger-soft text-danger border-danger-border'
      : state === 'saved'
        ? 'bg-success-soft text-success border-success-border'
        : 'bg-surface-muted text-text-secondary border-border-subtle';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium ${toneClass}`}
    >
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${state === 'saving' ? 'animate-spin' : ''}`.trim()}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span>{label}</span>
      {typeof revision === 'number' ? (
        <span className="border-l border-current/25 pl-2 tabular-nums">Rev {revision}</span>
      ) : null}
    </div>
  );
}
