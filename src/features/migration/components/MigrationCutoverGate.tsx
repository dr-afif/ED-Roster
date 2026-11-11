import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  Database,
  Lock,
} from 'lucide-react';
import type { MigrationBatchDetails } from '../domain/migrationEngine';

interface MigrationCutoverGateProps {
  readonly details: MigrationBatchDetails;
  readonly onRunTransform: (dryRun: boolean) => Promise<void>;
  readonly onRevertBatch: () => Promise<void>;
  readonly isRunningTransform?: boolean;
  readonly isReverting?: boolean;
}

export function MigrationCutoverGate({
  details,
  onRunTransform,
  onRevertBatch,
  isRunningTransform = false,
  isReverting = false,
}: MigrationCutoverGateProps) {
  const { batch, tabs, id_maps, reconciliation } = details;
  const [confirmCommitOpen, setConfirmCommitOpen] = useState(false);
  const [confirmRevertOpen, setConfirmRevertOpen] = useState(false);

  // Verification criteria
  const hasTabs = tabs.length > 0;
  const unresolvedStaffCount = id_maps.filter(
    (m) => m.confidence === 'unresolved' || m.confidence === 'collision',
  ).length;
  const isStaffAllMapped = id_maps.length > 0 && unresolvedStaffCount === 0;
  const hasReconciliation = reconciliation.length > 0;
  const isChecksumMatched = hasReconciliation && reconciliation.every((r) => r.checksum_match);
  const isAllApproved =
    hasReconciliation && reconciliation.every((r) => r.reviewer_disposition === 'approved');

  const isReadyForCommit = hasTabs && isStaffAllMapped && hasReconciliation && isChecksumMatched;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-primary" />
            Cutover Readiness Gate & Execution (09_MIGRATION_CUTOVER.md)
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Acceptance gates must be verified before cutover. Dry-run rehearsals can be run
            repeatedly without mutating production.
          </p>
        </div>

        {/* Verification Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-3.5">
            {hasTabs ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold text-text-primary">
                1. 100% Source Tabs Ingested
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                {tabs.length} tabs classified and stored in legacy.raw_rows ({batch.raw_row_count}{' '}
                rows).
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-3.5">
            {isStaffAllMapped ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold text-text-primary">
                2. Staff Identities Reconciled
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                {unresolvedStaffCount === 0
                  ? 'All source doctor names mapped to canonical Staff Directory IDs.'
                  : `${unresolvedStaffCount} staff mappings unresolved. Review in Identity Mapping tab.`}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-3.5">
            {isChecksumMatched ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold text-text-primary">
                3. Historical Checksum Verification
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                {isChecksumMatched
                  ? 'Source row counts match canonical destination row counts exactly.'
                  : 'Reconciliation dry-run required to verify aggregate checksums.'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-secondary/30 p-3.5">
            {isAllApproved ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold text-text-primary">
                4. Owner Exception Disposition
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5">
                {isAllApproved
                  ? 'Zero unexplained exceptions. All categories marked approved.'
                  : 'Review discrepancy reports and document disposition.'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border-subtle">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRunningTransform || isReverting}
              onClick={() => onRunTransform(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-primary px-3.5 py-2 text-xs font-bold text-text-primary shadow-2xs hover:bg-surface-secondary disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 text-blue-600" />
              {isRunningTransform ? 'Simulating Dry Run...' : 'Execute Dry-Run Rehearsal'}
            </button>

            <button
              type="button"
              disabled={
                !isReadyForCommit ||
                isRunningTransform ||
                isReverting ||
                batch.status === 'committed'
              }
              onClick={() => setConfirmCommitOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
            >
              <Database className="h-3.5 w-3.5" />
              {batch.status === 'committed'
                ? 'Batch Committed to Database'
                : 'Commit Canonical Migration'}
            </button>
          </div>

          {batch.status === 'committed' && (
            <button
              type="button"
              disabled={isReverting || isRunningTransform}
              onClick={() => setConfirmRevertOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isReverting ? 'Reverting...' : 'Revert Batch (Preserve Evidence)'}
            </button>
          )}
        </div>
      </div>

      {/* Production Cutover Notice */}
      <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-5 dark:border-teal-500/30">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-text-primary">Cutover & Rollback Protocol (ADR-002)</h4>
            <p className="text-text-secondary leading-relaxed">
              Once rehearsal succeeds on Staging (<code>hgrutigkgnrcjhcjxabs</code>), production
              cutover involves freezing Google Sheets writes, running the same versioned import
              script against production, verifying January 2027 native roster readiness, and
              switching the GitHub Pages URL. If unexpected issues arise, reverting preserves all
              raw audit logs and allows instant switchback.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Commit */}
      {confirmCommitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-primary p-6 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-text-primary">Confirm Canonical Data Commit</h4>
            <p className="text-xs text-text-secondary">
              This will load historical roster periods (marked as{' '}
              <code>legacy_read_only = true</code>), planned assignments, and request records into
              the database. Existing draft rosters (such as January 2027) will remain untouched.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCommitOpen(false)}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmCommitOpen(false);
                  await onRunTransform(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Proceed with Commit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Revert */}
      {confirmRevertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-primary p-6 shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">
              Revert Migration Batch
            </h4>
            <p className="text-xs text-text-secondary">
              Are you sure you want to revert batch <code>{batch.batch_id}</code>? The canonical
              historical periods linked to this batch will be archived. All raw ingest rows and
              audit events in <code>legacy.raw_rows</code> remain strictly preserved.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRevertOpen(false)}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmRevertOpen(false);
                  await onRevertBatch();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-rose-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Confirm Revert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
