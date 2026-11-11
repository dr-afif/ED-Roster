import {
  DatabaseBackup,
  Plus,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import type { MigrationBatch } from '../domain/migrationEngine';

interface MigrationBatchListProps {
  readonly batches: ReadonlyArray<MigrationBatch>;
  readonly selectedBatchId: string | null;
  readonly onSelectBatch: (batchId: string) => void;
  readonly onNewBatchClick: () => void;
  readonly onLoadSampleRehearsal: () => void;
  readonly isCreatingSample?: boolean;
}

export function MigrationBatchList({
  batches,
  selectedBatchId,
  onSelectBatch,
  onNewBatchClick,
  onLoadSampleRehearsal,
  isCreatingSample = false,
}: MigrationBatchListProps) {
  const getStatusBadge = (status: MigrationBatch['status']) => {
    switch (status) {
      case 'committed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Committed
          </span>
        );
      case 'reconciled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:text-blue-300">
            <CheckCircle2 className="h-3 w-3" /> Reconciled (Dry Run)
          </span>
        );
      case 'rolled_back':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Reverted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            <RefreshCw className="h-3 w-3" /> Staged
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-text-primary">Migration & Rehearsal Batches</h2>
          <p className="text-xs text-text-secondary">
            Immutable raw evidence ingested from read-only Google Sheets exports (ADR-002).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLoadSampleRehearsal}
            disabled={isCreatingSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-xs font-semibold text-text-primary shadow-2xs hover:bg-surface-secondary disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 text-brand-primary" />
            {isCreatingSample ? 'Loading Rehearsal...' : 'Load Rehearsal Batch (Dec 2026)'}
          </button>

          <button
            type="button"
            onClick={onNewBatchClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-brand-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New Import Batch
          </button>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-default p-10 text-center bg-surface-primary">
          <DatabaseBackup className="h-10 w-10 text-text-muted mb-3" />
          <h3 className="text-sm font-bold text-text-primary">No Migration Batches Found</h3>
          <p className="mt-1 text-xs text-text-secondary max-w-md">
            No Google Sheets export batches have been staged yet. Click &quot;Load Rehearsal
            Batch&quot; to test the historical import and checksum reconciliation engine with
            realistic December 2026 data.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-primary shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary/70 text-text-secondary font-semibold">
                  <th className="px-3.5 py-2.5">Batch ID</th>
                  <th className="px-3.5 py-2.5">Source Spreadsheet</th>
                  <th className="px-3.5 py-2.5">Export Date</th>
                  <th className="px-3.5 py-2.5">Raw Rows</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {batches.map((batch) => {
                  const isSelected = batch.batch_id === selectedBatchId;
                  return (
                    <tr
                      key={batch.batch_id}
                      onClick={() => onSelectBatch(batch.batch_id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-brand-primary/10 hover:bg-brand-primary/15'
                          : 'hover:bg-surface-secondary/50'
                      }`}
                    >
                      <td className="px-3.5 py-3 font-mono font-bold text-text-primary">
                        {batch.batch_id}
                      </td>
                      <td className="px-3.5 py-3 text-text-secondary">
                        <div className="font-medium text-text-primary">{batch.source_label}</div>
                        <div className="text-[11px] font-mono text-text-muted truncate max-w-xs">
                          {batch.source_spreadsheet_id}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-text-secondary">
                        {new Date(batch.export_timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-3.5 py-3 font-semibold text-text-primary">
                        {batch.raw_row_count} rows
                      </td>
                      <td className="px-3.5 py-3">{getStatusBadge(batch.status)}</td>
                      <td className="px-3.5 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBatch(batch.batch_id);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-primary px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-surface-secondary"
                        >
                          <Eye className="h-3.5 w-3.5 text-text-muted" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
