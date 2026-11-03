import { Archive, FileText, Send } from 'lucide-react';
import { SurfaceCard } from '@/shared/ui';

type RosterActionBarPlaceholderProps = {
  periodLabel: string;
};

export function RosterActionBarPlaceholder({ periodLabel }: RosterActionBarPlaceholderProps) {
  return (
    <SurfaceCard variant="glass" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Snapshot &amp; Delivery Boundary ({periodLabel})
          </h2>
          <p className="text-xs text-text-secondary">
            Per ADR-004, PDF preview, immutable Google Drive archive, and owner-only Telegram
            transfer remain separate explicit actions disabled during foundation scaffold.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2 text-xs font-medium text-text-secondary opacity-60"
          >
            <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span>Preview PDF</span>
          </button>
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2 text-xs font-medium text-text-secondary opacity-60"
          >
            <Archive className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span>Archive Snapshot to Drive</span>
          </button>
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-solid px-3.5 py-2 text-xs font-medium text-text-secondary opacity-60"
          >
            <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <span>Send to My Telegram</span>
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}
