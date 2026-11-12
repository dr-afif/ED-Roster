import { useState } from 'react';
import { OwnerUxBoundary } from '@/platform/auth';
import { useStaffDirectoryQuery } from '@/features/directory/useDirectoryAdmin';
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

export function MigrationAdminRoute() {
  const { data: batches = [] } = useMigrationBatchesQuery();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'identity' | 'cutover'>(
    'reconciliation',
  );
  const [isNewBatchOpen, setIsNewBatchOpen] = useState(false);
  const [isCreatingSample, setIsCreatingSample] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: batchDetails } = useMigrationBatchDetailsQuery(selectedBatchId);
  const { data: staffList = [] } = useStaffDirectoryQuery();

  const createBatchMutation = useCreateMigrationBatchMutation();
  const stageRowsMutation = useStageRawRowsMutation();
  const saveMappingMutation = useSaveIdMappingMutation();
  const updateDispositionMutation = useUpdateReconciliationDispositionMutation();
  const executeTransformMutation = useExecuteTransformMutation();
  const revertMutation = useRevertMigrationMutation();

  // Load realistic rehearsal batch
  const handleLoadSampleRehearsal = async () => {
    try {
      setErrorMessage(null);
      setIsCreatingSample(true);
      const sample = createSampleLegacyExport();

      // 1. Create batch
      await createBatchMutation.mutateAsync({
        batchId: sample.batchId,
        sourceSpreadsheetId: sample.spreadsheetId,
        sourceLabel: 'Legacy Google Sheets Master Workbook (December 2026 Rehearsal)',
        tabManifest: sample.tabManifest,
        notes: 'Automated historical rehearsal batch generated for dry-run verification.',
      });

      // 2. Stage raw rows for each tab
      for (const [tabName, rows] of Object.entries(sample.tabsData)) {
        await stageRowsMutation.mutateAsync({
          batchId: sample.batchId,
          tabName,
          rows,
        });
      }

      // 3. Execute initial dry-run transform
      await executeTransformMutation.mutateAsync({
        batchId: sample.batchId,
        dryRun: true,
      });

      setSelectedBatchId(sample.batchId);
      setActiveTab('reconciliation');
    } catch (err) {
      console.error('Failed to load sample rehearsal batch:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to stage and reconcile rehearsal batch.',
      );
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
    } catch (err) {
      console.error('Failed to create batch:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create migration batch.');
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
    } catch (err) {
      console.error('Failed to save mapping:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save staff mapping.');
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
    } catch (err) {
      console.error('Failed to update disposition:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update disposition.');
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
    } catch (err) {
      console.error('Failed to run transform:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to run migration transform.');
    }
  };

  const handleRevertBatch = async () => {
    if (!selectedBatchId) return;
    try {
      setErrorMessage(null);
      await revertMutation.mutateAsync({ batchId: selectedBatchId });
    } catch (err) {
      console.error('Failed to revert batch:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to revert migration batch.');
    }
  };

  const staffCandidates = staffList.map((s) => ({
    id: s.id,
    rosterName: s.roster_name,
    staffCode: s.staff_code,
    active: s.active,
  }));

  return (
    <OwnerUxBoundary areaName="Sheets Migration & Cutover Tooling">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                Owner Administration
              </span>
              <span className="rounded-md bg-teal-500/10 px-2 py-0.5 text-xs font-semibold text-teal-800 dark:text-teal-300">
                Wave G
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-text-primary">
              Google Sheets Migration & Cutover Tooling
            </h1>
            <p className="mt-0.5 text-xs text-text-secondary">
              Read-only workbook ingestion, staff identity collision resolution, checksum
              reconciliation, and dry-run rehearsal gates (ADR-002).
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Selected Batch View or Batches List */}
        {selectedBatchId && batchDetails ? (
          <div className="space-y-5">
            {/* Batch Navigation Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedBatchId(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-secondary/60 px-2.5 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-secondary"
                >
                  <ChevronLeft className="h-4 w-4" />
                  All Batches
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {batchDetails.batch.batch_id}
                    </span>
                    <span className="text-xs text-text-muted">
                      ({batchDetails.batch.source_label})
                    </span>
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    Export Date: {new Date(batchDetails.batch.export_timestamp).toLocaleString()} •{' '}
                    {batchDetails.batch.raw_row_count} raw rows
                  </div>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-1 rounded-xl bg-surface-secondary/70 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('reconciliation')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                    activeTab === 'reconciliation'
                      ? 'bg-surface-primary text-brand-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Reconciliation
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('identity')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                    activeTab === 'identity'
                      ? 'bg-surface-primary text-brand-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Staff Identity Mapping
                  {batchDetails.id_maps.filter((m) => m.confidence === 'unresolved').length > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      {batchDetails.id_maps.filter((m) => m.confidence === 'unresolved').length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cutover')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                    activeTab === 'cutover'
                      ? 'bg-surface-primary text-brand-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Cutover Gate
                </button>
              </div>
            </div>

            {/* Active Subview */}
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

        {/* New Batch Modal */}
        <MigrationNewBatchModal
          isOpen={isNewBatchOpen}
          onClose={() => setIsNewBatchOpen(false)}
          onCreateBatch={handleCreateBatch}
        />
      </div>
    </OwnerUxBoundary>
  );
}
