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
import { Modal } from '@/shared/ui';
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

  const hasTabs = tabs.length > 0;
  const unresolvedStaffCount = id_maps.filter(
    (m) => m.confidence === 'unresolved' || m.confidence === 'collision',
  ).length;
  const isStaffAllMapped = id_maps.length > 0 && unresolvedStaffCount === 0;
  const hasReconciliation = reconciliation.length > 0;
  const isChecksumMatched = hasReconciliation && reconciliation.every((r) => r.checksum_match);
  const isAllApproved =
    hasReconciliation && reconciliation.every((r) => r.reviewer_disposition === 'approved');

  const gatesPassedCount = [hasTabs, isStaffAllMapped, isChecksumMatched, isAllApproved].filter(
    Boolean,
  ).length;

  const isReadyForCommit = hasTabs && isStaffAllMapped && hasReconciliation && isChecksumMatched;

  return (
    <div className="space-y-5">
      <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-5 sm:p-6 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-[#18181B] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#0F766E]" />
              Cutover Readiness Gate &amp; Execution
            </h3>
            <p className="text-xs font-medium text-[#78716C] mt-1">
              Acceptance gates must be verified before cutover. Dry-run rehearsals can run safely
              without modifying active schedules.
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${
              gatesPassedCount === 4
                ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                : 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
            }`}
          >
            {gatesPassedCount} / 4 Passed
          </span>
        </div>

        {/* Verification Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3.5">
            {hasTabs ? (
              <CheckCircle2 className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-extrabold text-[#18181B]">
                1. 100% Source Tabs Ingested
              </div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                {tabs.length} tabs classified and archived ({batch.raw_row_count} rows).
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3.5">
            {isStaffAllMapped ? (
              <CheckCircle2 className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-extrabold text-[#18181B]">
                2. Staff Identities Reconciled
              </div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                {unresolvedStaffCount === 0
                  ? 'All source doctor names mapped to canonical Staff Directory IDs.'
                  : `${unresolvedStaffCount} staff mappings unresolved. Review in Identity Mapping tab.`}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3.5">
            {isChecksumMatched ? (
              <CheckCircle2 className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-extrabold text-[#18181B]">
                3. Historical Checksum Verification
              </div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                {isChecksumMatched
                  ? 'Source row counts match canonical destination row counts exactly.'
                  : 'Reconciliation dry-run required to verify aggregate checksums.'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3.5">
            {isAllApproved ? (
              <CheckCircle2 className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-extrabold text-[#18181B]">
                4. Owner Exception Disposition
              </div>
              <div className="text-[11px] text-[#57534E] mt-0.5">
                {isAllApproved
                  ? 'Zero unexplained exceptions. All categories marked approved.'
                  : 'Review discrepancy reports and document disposition.'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#EFECE6]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRunningTransform || isReverting}
              onClick={() => void onRunTransform(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-[#FAF8F5] px-4 py-2 text-xs font-extrabold text-[#18181B] shadow-2xs hover:bg-[#EFECE6] disabled:opacity-50 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 text-[#0F766E]" />
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
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
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
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isReverting ? 'Reverting...' : 'Revert Batch (Preserve Evidence)'}
            </button>
          )}
        </div>
      </div>

      {/* Cutover & Rollback Protocol Notice */}
      <div className="rounded-[22px] border border-[#99F6E4] bg-[#F0FDFA] p-5">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-[#0F766E] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-extrabold text-[#18181B]">Cutover &amp; Rollback Protocol</h4>
            <p className="text-[#57534E] leading-relaxed font-medium">
              Once dry-run rehearsal succeeds, freeze external spreadsheet edits and commit the
              verified historical batch while leaving native January 2027 drafts intact. Any revert
              preserves original raw rows and audit records.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Commit */}
      <Modal
        isOpen={confirmCommitOpen}
        onClose={() => setConfirmCommitOpen(false)}
        title="Confirm Canonical Data Commit"
        presentation="drawer"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmCommitOpen(false)}
              className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirmCommitOpen(false);
                await onRunTransform(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-[#115E59] cursor-pointer"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Proceed with Commit
            </button>
          </div>
        }
      >
        <p className="text-xs font-medium text-[#57534E] leading-relaxed">
          This will archive historical roster periods as read-only alongside their planned
          assignments and request records. Existing native roster drafts (such as January 2027)
          remain untouched.
        </p>
      </Modal>

      {/* Confirmation Modal: Revert */}
      <Modal
        isOpen={confirmRevertOpen}
        onClose={() => setConfirmRevertOpen(false)}
        title="Revert Migration Batch"
        presentation="drawer"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmRevertOpen(false)}
              className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirmRevertOpen(false);
                await onRevertBatch();
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-rose-700 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Confirm Revert
            </button>
          </div>
        }
      >
        <p className="text-xs font-medium text-[#57534E] leading-relaxed">
          Are you sure you want to revert batch <code>{batch.batch_id}</code>? Historical periods
          linked to this batch will be archived while all raw ingest evidence and audit logs remain
          preserved.
        </p>
      </Modal>
    </div>
  );
}
