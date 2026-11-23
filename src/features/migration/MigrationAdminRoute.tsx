import { useState } from 'react';
import { OwnerUxBoundary } from '@/platform/auth';
import { useStaffDirectoryQuery } from '@/features/directory/useDirectoryAdmin';
import { ModuleBackBar, SkeletonCardList, SkeletonTableCard, useToast } from '@/shared/ui';
import {
  useMigrationBatchesQuery,
  useMigrationBatchDetailsQuery,
  useCreateMigrationBatchMutation,
  useStageRawRowsMutation,
  useSaveIdMappingMutation,
  useUpdateReconciliationDispositionMutation,
  useExecuteTransformMutation,
  useRevertMigrationMutation,
} from './data/migrationQueries';
import { MigrationBatchList } from './components/MigrationBatchList';
import { MigrationReconciliationView } from './components/MigrationReconciliationView';
import { MigrationIdentityMappingTable } from './components/MigrationIdentityMappingTable';
import { MigrationCutoverGate } from './components/MigrationCutoverGate';
import { MigrationNewBatchModal } from './components/MigrationNewBatchModal';
import { createSampleLegacyExport } from './domain/migrationEngine';
import { Layers, Users, ShieldCheck, ChevronLeft, AlertCircle } from 'lucide-react';

function getErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object') {
    const candidate = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      error?: { message?: unknown; details?: unknown };
      error_description?: unknown;
    };
    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message;
    }
    if (typeof candidate.details === 'string' && candidate.details.trim()) {
      return candidate.details;
    }
    if (typeof candidate.error?.message === 'string' && candidate.error.message.trim()) {
      return candidate.error.message;
    }
    if (typeof candidate.error_description === 'string' && candidate.error_description.trim()) {
      return candidate.error_description;
    }
    if (typeof candidate.hint === 'string' && candidate.hint.trim()) {
      return candidate.hint;
    }
  }
  return fallback;
}

export function MigrationAdminRoute() {
  const showToast = useToast();
  const { data: batches = [], isLoading: isBatchesLoading } = useMigrationBatchesQuery();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'identity' | 'cutover'>(
    'reconciliation',
  );
  const [isNewBatchOpen, setIsNewBatchOpen] = useState(false);
  const [isCreatingSample, setIsCreatingSample] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: batchDetails, isLoading: isDetailsLoading } =
    useMigrationBatchDetailsQuery(selectedBatchId);
  const { data: staffList = [] } = useStaffDirectoryQuery();

  const createBatchMutation = useCreateMigrationBatchMutation();
  const stageRowsMutation = useStageRawRowsMutation();
  const saveMappingMutation = useSaveIdMappingMutation();
  const updateDispositionMutation = useUpdateReconciliationDispositionMutation();
  const executeTransformMutation = useExecuteTransformMutation();
  const revertMutation = useRevertMigrationMutation();

  const handleLoadSampleRehearsal = async () => {
    try {
      setErrorMessage(null);
      setIsCreatingSample(true);
      const sample = createSampleLegacyExport();

      await createBatchMutation.mutateAsync({
        batchId: sample.batchId,
        sourceSpreadsheetId: sample.spreadsheetId,
        sourceLabel: 'Legacy Google Sheets Master Workbook (December 2026 Rehearsal)',
        tabManifest: sample.tabManifest,
        notes: 'Automated historical rehearsal batch generated for dry-run verification.',
      });

      for (const [tabName, rows] of Object.entries(sample.tabsData)) {
        await stageRowsMutation.mutateAsync({
          batchId: sample.batchId,
          tabName,
          rows,
        });
      }

      await executeTransformMutation.mutateAsync({
        batchId: sample.batchId,
        dryRun: true,
      });

      setSelectedBatchId(sample.batchId);
      setActiveTab('reconciliation');
      showToast('Rehearsal batch staged & reconciled ✓');
    } catch (err) {
      console.error('Failed to load sample rehearsal batch:', err);
      setErrorMessage(getErrorMessage(err, 'Failed to stage and reconcile rehearsal batch.'));
    } finally {
      setIsCreatingSample(false);
    }
  };

  const handleCreateBatch = async (params: {
    batchId: string;
    sourceSpreadsheetId: string;
    sourceLabel: string;
    notes?: string;
  }) => {
    try {
      setErrorMessage(null);
      await createBatchMutation.mutateAsync(params);
      setSelectedBatchId(params.batchId);
      showToast(`Batch ${params.batchId} created ✓`);
    } catch (err) {
      console.error('Failed to create batch:', err);
      setErrorMessage(getErrorMessage(err, 'Failed to create migration batch.'));
    }
  };

  const handleSaveMapping = async (
    sourceKey: string,
    canonicalId: string,
    canonicalLabel: string,
    notes?: string,
  ) => {
    if (!selectedBatchId) return;
    try {
      setErrorMessage(null);
      await saveMappingMutation.mutateAsync({
        batchId: selectedBatchId,
        sourceEntity: 'staff',
        sourceTab: 'StaffDirectory',
        sourceKey,
        canonicalTable: 'staff_directory',
        canonicalId,
        canonicalLabel,
        confidence: 'manual_approved',
        notes,
      });
      showToast(`Mapped ${sourceKey} → ${canonicalLabel} ✓`);
    } catch (err) {
      console.error('Failed to save mapping:', err);
      setErrorMessage(getErrorMessage(err, 'Failed to save staff mapping.'));
    }
  };

  const handleUpdateDisposition = async (
    resultId: number,
    disposition: 'pending' | 'approved' | 'flagged' | 'rejected',
    notes?: string,
  ) => {
    if (!selectedBatchId) return;
    try {
      setErrorMessage(null);
      await updateDispositionMutation.mutateAsync({
        resultId,
        batchId: selectedBatchId,
        disposition,
        notes,
      });
      showToast(`Reconciliation marked ${disposition} ✓`);
    } catch (err) {
      console.error('Failed to update disposition:', err);
      setErrorMessage(getErrorMessage(err, 'Failed to update disposition.'));
    }
  };

  const handleRunTransform = async (dryRun: boolean) => {
    if (!selectedBatchId) return;
    try {
      setErrorMessage(null);
      await executeTransformMutation.mutateAsync({
        batchId: selectedBatchId,
        dryRun,
      });
      showToast(dryRun ? 'Dry-run rehearsal completed ✓' : 'Batch committed to database ✓');
    } catch (err) {
      console.error('Failed to run transform:', err);
      setErrorMessage(getErrorMessage(err, 'Failed to run migration transform.'));
    }
  };

  const handleRevertBatch = async () => {
    if (!selectedBatchId) return;
    try {
      setErrorMessage(null);
      await revertMutation.mutateAsync({ batchId: selectedBatchId });
      showToast('Batch reverted with raw evidence preserved ✓');
    } catch (err) {
      console.error('Failed to revert batch:', err);
      setErrorMessage(getErrorMessage(err, 'Failed to revert migration batch.'));
    }
  };

  const staffCandidates = staffList.map((s) => ({
    id: s.id,
    rosterName: s.roster_name,
    staffCode: s.staff_code,
    active: s.active,
  }));

  const totalRows = batches.reduce((sum, b) => sum + Number(b.raw_row_count ?? 0), 0);
  const reconciledRows = batches
    .filter((b) => b.status === 'reconciled' || b.status === 'committed')
    .reduce((sum, b) => sum + Number(b.raw_row_count ?? 0), 0);
  const identityMatchPct = batchDetails?.id_maps.length
    ? `${Math.round(
        (batchDetails.id_maps.filter(
          (m) => m.confidence !== 'unresolved' && m.confidence !== 'collision',
        ).length /
          batchDetails.id_maps.length) *
          100,
      )}%`
    : '—';
  const cutoverReady =
    batches.length > 0 &&
    batches.every((b) => b.status === 'reconciled' || b.status === 'committed');

  return (
    <OwnerUxBoundary areaName="Sheets Migration & Cutover Tooling">
      <div className="max-w-[1040px] space-y-4">
        <ModuleBackBar title="Sheets Migration" />

        {/* Desktop Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-transparent lg:border-[#EFECE6] lg:pb-4">
          <div>
            <p className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
              Owner Administration
            </p>
            <h1 className="sr-only lg:not-sr-only mt-1 text-[26px] font-extrabold tracking-tight text-[#18181B]">
              Google Sheets Migration &amp; Cutover Tooling
            </h1>
            <p className="hidden lg:block mt-0.5 text-[13px] font-medium text-[#78716C]">
              Read-only workbook ingestion, staff identity collision resolution, checksum
              reconciliation, and dry-run rehearsal gates.
            </p>
          </div>
        </div>

        {/* Prototype Top-Accented KPI Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#18181B] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
              Import Batches
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[#18181B] tabular-nums">
              {batches.length}
            </p>
          </div>
          <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#0F766E] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
              Rows Reconciled
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[#0F766E] tabular-nums">
              {reconciledRows}/{totalRows}
            </p>
          </div>
          <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#15803D] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
              Identity Match
            </p>
            <p className="mt-1 text-2xl font-extrabold text-[#15803D] tabular-nums">
              {identityMatchPct}
            </p>
          </div>
          <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#D97706] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
              Cutover Gate
            </p>
            <p
              className={`mt-1.5 text-base font-extrabold ${
                cutoverReady ? 'text-[#0F766E]' : 'text-[#B45309]'
              }`}
            >
              {cutoverReady ? 'Ready ✓' : batches.length === 0 ? 'No Batches' : 'In Review'}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center justify-between gap-3 rounded-[16px] border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs font-bold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Selected Batch View or Batches List */}
        {selectedBatchId && isDetailsLoading && !batchDetails ? (
          <SkeletonTableCard rows={5} cols={4} srLabel="Loading migration batch details..." />
        ) : selectedBatchId && batchDetails ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-[22px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedBatchId(null)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-1.5 text-xs font-extrabold text-[#18181B] hover:bg-[#EFECE6] cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  All Batches
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-extrabold text-[#18181B]">
                      {batchDetails.batch.batch_id}
                    </span>
                    <span className="text-xs text-[#78716C] truncate">
                      ({batchDetails.batch.source_label})
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-[#78716C]">
                    Export Date: {new Date(batchDetails.batch.export_timestamp).toLocaleString()} •{' '}
                    {batchDetails.batch.raw_row_count} raw rows
                  </div>
                </div>
              </div>

              {/* Scrollable View Switcher Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap rounded-full bg-[#EFECE6] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('reconciliation')}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-extrabold transition cursor-pointer ${
                    activeTab === 'reconciliation'
                      ? 'bg-[#18181B] text-white shadow-xs'
                      : 'text-[#57534E] hover:text-[#18181B]'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Reconciliation
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('identity')}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-extrabold transition cursor-pointer ${
                    activeTab === 'identity'
                      ? 'bg-[#18181B] text-white shadow-xs'
                      : 'text-[#57534E] hover:text-[#18181B]'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Staff Identity Mapping
                  {batchDetails.id_maps.filter(
                    (m) => m.confidence === 'unresolved' || m.confidence === 'collision',
                  ).length > 0 && (
                    <span className="rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-extrabold text-[#92400E]">
                      {
                        batchDetails.id_maps.filter(
                          (m) => m.confidence === 'unresolved' || m.confidence === 'collision',
                        ).length
                      }
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cutover')}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-extrabold transition cursor-pointer ${
                    activeTab === 'cutover'
                      ? 'bg-[#18181B] text-white shadow-xs'
                      : 'text-[#57534E] hover:text-[#18181B]'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Cutover Gate
                </button>
              </div>
            </div>

            {activeTab === 'reconciliation' && (
              <MigrationReconciliationView
                details={batchDetails}
                onUpdateDisposition={handleUpdateDisposition}
              />
            )}

            {activeTab === 'identity' && (
              <MigrationIdentityMappingTable
                idMaps={batchDetails.id_maps}
                staffDirectory={staffCandidates}
                onSaveMapping={handleSaveMapping}
              />
            )}

            {activeTab === 'cutover' && (
              <MigrationCutoverGate
                details={batchDetails}
                onRunTransform={handleRunTransform}
                onRevertBatch={handleRevertBatch}
                isRunningTransform={executeTransformMutation.isPending}
                isReverting={revertMutation.isPending}
              />
            )}
          </div>
        ) : isBatchesLoading ? (
          <SkeletonCardList count={3} srLabel="Loading migration batches..." />
        ) : (
          <MigrationBatchList
            batches={batches}
            selectedBatchId={selectedBatchId}
            onSelectBatch={(id) => {
              setSelectedBatchId(id);
              setActiveTab('reconciliation');
            }}
            onNewBatchClick={() => setIsNewBatchOpen(true)}
            onLoadSampleRehearsal={handleLoadSampleRehearsal}
            isCreatingSample={isCreatingSample}
          />
        )}

        <MigrationNewBatchModal
          isOpen={isNewBatchOpen}
          onClose={() => setIsNewBatchOpen(false)}
          onCreateBatch={handleCreateBatch}
        />
      </div>
    </OwnerUxBoundary>
  );
}
