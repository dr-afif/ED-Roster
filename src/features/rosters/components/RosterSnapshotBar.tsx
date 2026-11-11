import { useState } from 'react';
import { Archive, CheckCircle2, Eye, FileCheck2, Loader2, Send, X } from 'lucide-react';
import { SurfaceCard } from '@/shared/ui';
import type { ShiftDefinitionRow } from '../data/rosterQueries';
import {
  type RosterSnapshotRow,
  useArchiveRosterSnapshotMutation,
  useRosterSnapshotDeliveriesQuery,
  useRosterSnapshotsQuery,
  useSendToTelegramMutation,
} from '../data/snapshotQueries';
import { generateRosterPdf } from '../domain/pdfGenerator';
import type { Assignment, StaffRosterIdentity } from '../domain/types';

export interface RosterSnapshotBarProps {
  periodId: number;
  periodYear: string;
  periodMonth: string;
  periodStart: string;
  periodRevision: number;
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  shiftDefinitions: readonly ShiftDefinitionRow[];
  isOwner: boolean;
}

export function RosterSnapshotBar({
  periodId,
  periodYear,
  periodMonth,
  periodStart,
  periodRevision,
  staffList,
  assignments,
  shiftDefinitions,
  isOwner,
}: RosterSnapshotBarProps) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data: snapshots = [] } = useRosterSnapshotsQuery(periodId);
  const archiveMutation = useArchiveRosterSnapshotMutation(periodId);
  const telegramMutation = useSendToTelegramMutation();

  // Find snapshot corresponding to current revision
  const currentSnapshot = snapshots.find((s) => s.source_revision === periodRevision);
  const latestSnapshot = snapshots[0] as RosterSnapshotRow | undefined;

  const { data: deliveries = [] } = useRosterSnapshotDeliveriesQuery(latestSnapshot?.id);
  const isDeliveredToTelegram = deliveries.some((d) => d.status === 'sent');

  // 1. Preview PDF
  const handlePreviewPdf = async () => {
    try {
      setIsPreviewing(true);
      setActionMessage(null);

      const canonicalPayload = {
        period: {
          year: periodYear,
          month: periodMonth,
          periodStart,
          revision: periodRevision,
        },
        staffCount: staffList.length,
        assignmentCount: assignments.length,
      };

      const { pdfBytes, fileName } = await generateRosterPdf({
        period: {
          year: periodYear,
          month: periodMonth,
          periodStart,
          revision: periodRevision,
        },
        snapshotVersion: latestSnapshot ? latestSnapshot.snapshot_version + 1 : 1,
        snapshotType: periodRevision === 0 ? 'initial' : 'amendment',
        staffList,
        assignments,
        shiftDefinitions,
        generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        canonicalHash: JSON.stringify(canonicalPayload),
      });

      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Open in new tab or trigger download
      const win = window.open(url, '_blank');
      if (!win) {
        // Fallback for popup blocker: download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      }
      setActionMessage(`Generated PDF preview: ${fileName}`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to generate PDF.');
    } finally {
      setIsPreviewing(false);
    }
  };

  // 2. Archive to Drive
  const handleArchiveToDrive = async () => {
    try {
      setActionMessage(null);
      const res = await archiveMutation.mutateAsync({
        period: {
          year: periodYear,
          month: periodMonth,
          periodStart,
          revision: periodRevision,
        },
        staffList,
        assignments,
        shiftDefinitions,
      });

      setActionMessage(
        `Successfully archived snapshot v${res.snapshot.snapshot_version} (${res.snapshot.file_name}) to Google Drive catalog.`,
      );
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to archive snapshot.');
    }
  };

  // 3. Send to Telegram
  const handleConfirmSendTelegram = async () => {
    if (!latestSnapshot) return;
    try {
      await telegramMutation.mutateAsync({
        snapshotId: latestSnapshot.id,
      });
      setIsTelegramModalOpen(false);
      setActionMessage(`Snapshot v${latestSnapshot.snapshot_version} sent to owner Telegram chat.`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to send to Telegram.');
    }
  };

  const isArchivedForCurrentRevision = Boolean(currentSnapshot);

  return (
    <SurfaceCard
      variant="solid"
      className="p-4 space-y-3 border-brand-primary/20 bg-brand-primary/5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Snapshot Information */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-brand-primary" />
            <h3 className="text-xs font-bold text-text-primary">
              Roster Document Archive &amp; Telegram Workflow
            </h3>
            {isArchivedForCurrentRevision ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />v{currentSnapshot?.snapshot_version} Archived
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                Revision {periodRevision} (Unarchived Delta)
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-secondary">
            {latestSnapshot ? (
              <>
                Latest Snapshot:{' '}
                <span className="font-mono font-bold text-text-primary">
                  {latestSnapshot.file_name}
                </span>{' '}
                (SHA: <span className="font-mono">{latestSnapshot.pdf_sha256?.slice(0, 10)}…</span>)
              </>
            ) : (
              'Generate official landscape A4 PDF and archive immutable audit snapshot to Google Drive.'
            )}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action 1: Preview PDF */}
          <button
            type="button"
            onClick={handlePreviewPdf}
            disabled={isPreviewing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-surface-primary px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-secondary shadow-xs transition-colors disabled:opacity-50"
          >
            {isPreviewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-primary" />
            ) : (
              <Eye className="h-3.5 w-3.5 text-brand-primary" />
            )}
            <span>Preview PDF</span>
          </button>

          {/* Action 2: Archive Snapshot to Drive (Owner only) */}
          {isOwner && (
            <button
              type="button"
              onClick={handleArchiveToDrive}
              disabled={archiveMutation.isPending || isArchivedForCurrentRevision}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors ${
                isArchivedForCurrentRevision
                  ? 'border border-border-default bg-surface-secondary/70 text-text-muted cursor-default'
                  : 'bg-brand-primary text-text-inverse hover:bg-brand-primary-hover'
              }`}
            >
              {archiveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              <span>
                {isArchivedForCurrentRevision
                  ? `Revision ${periodRevision} Archived`
                  : `Archive Revision ${periodRevision} Snapshot`}
              </span>
            </button>
          )}

          {/* Action 3: Send to My Telegram (Owner only, enabled when archived) */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsTelegramModalOpen(true)}
              disabled={!latestSnapshot || telegramMutation.isPending}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors ${
                !latestSnapshot
                  ? 'border-border-default bg-surface-secondary/40 text-text-muted cursor-not-allowed opacity-50'
                  : isDeliveredToTelegram
                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300'
                    : 'border-indigo-500/40 bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isDeliveredToTelegram ? 'Resend to Telegram' : 'Send to My Telegram'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Status Banner */}
      {actionMessage && (
        <div className="flex items-center justify-between rounded-xl bg-surface-primary/80 px-3 py-2 text-xs border border-border-subtle animate-in fade-in">
          <div className="flex items-center gap-2 text-text-primary">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Confirmation Modal for Telegram Send */}
      {isTelegramModalOpen && latestSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border-default bg-surface-primary p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Send className="h-5 w-5" />
                <h3 className="font-bold text-base text-text-primary">Send Snapshot to Telegram</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTelegramModalOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              This will securely dispatch official snapshot{' '}
              <strong className="text-text-primary">
                v{latestSnapshot.snapshot_version} ({latestSnapshot.file_name})
              </strong>{' '}
              directly to your configured private Telegram chat for immediate mobile review or
              WhatsApp forwarding.
            </p>

            <div className="rounded-xl border border-border-subtle bg-surface-secondary/40 p-3 space-y-1 text-xs">
              <div className="text-text-muted">Target Recipient:</div>
              <div className="font-semibold text-text-primary">Department Owner Private Chat</div>
              <div className="text-[11px] font-mono text-text-muted">
                SHA-256: {latestSnapshot.pdf_sha256}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsTelegramModalOpen(false)}
                disabled={telegramMutation.isPending}
                className="rounded-xl border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendTelegram}
                disabled={telegramMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
              >
                {telegramMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Confirm &amp; Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SurfaceCard>
  );
}
