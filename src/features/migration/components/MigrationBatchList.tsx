import {
  DatabaseBackup,
  Plus,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { useIsMobileViewport } from '@/shared/ui';
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
  const isMobile = useIsMobileViewport(767);

  const getStatusBadge = (status: MigrationBatch['status']) => {
    switch (status) {
      case 'committed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#065F46]">
            <CheckCircle2 className="h-3 w-3" /> Committed
          </span>
        );
      case 'reconciled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#0F766E]">
            <CheckCircle2 className="h-3 w-3" /> Reconciled (Dry Run)
          </span>
        );
      case 'rolled_back':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#92400E]">
            <AlertTriangle className="h-3 w-3" /> Reverted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-[#F5F5F4] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#57534E]">
            <RefreshCw className="h-3 w-3" /> Staged
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[#18181B]">
            Migration &amp; Rehearsal Batches
          </h2>
          <p className="text-xs font-medium text-[#78716C]">
            Immutable raw snapshots ingested from read-only Google Sheets exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLoadSampleRehearsal}
            disabled={isCreatingSample}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-white px-3.5 py-1.5 text-xs font-extrabold text-[#18181B] shadow-2xs hover:bg-[#FAF8F5] disabled:opacity-50 cursor-pointer"
          >
            {isCreatingSample ? (
              <RefreshCw className="h-3.5 w-3.5 text-[#0F766E] animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 text-[#0F766E]" />
            )}
            {isCreatingSample ? 'Loading Rehearsal Batch...' : 'Load Rehearsal Batch (Dec 2026)'}
          </button>

          <button
            type="button"
            onClick={onNewBatchClick}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-2xs hover:bg-[#115E59] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New Import Batch
          </button>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-[#D6D3D1] p-10 text-center bg-white">
          <DatabaseBackup className="h-9 w-9 text-[#A8A29E] mb-3" />
          <h3 className="text-sm font-extrabold text-[#18181B]">No Migration Batches Found</h3>
          <p className="mt-1 text-xs font-medium text-[#78716C] max-w-md">
            No Google Sheets export batches have been staged yet. Click &quot;Load Rehearsal
            Batch&quot; to test the historical import and checksum reconciliation engine with
            December 2026 sample data.
          </p>
        </div>
      ) : isMobile ? (
        /* Mobile Stacked Batch Cards */
        <div className="space-y-2.5">
          {batches.map((batch) => {
            const isSelected = batch.batch_id === selectedBatchId;
            return (
              <div
                key={batch.batch_id}
                onClick={() => onSelectBatch(batch.batch_id)}
                className={`rounded-[22px] border p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-2.5 cursor-pointer transition ${
                  isSelected
                    ? 'border-[#0F766E] bg-[#F0FDFA]'
                    : 'border-[#E7E5E4] bg-white hover:bg-[#FAF8F5]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-extrabold text-[#18181B]">
                      {batch.batch_id}
                    </div>
                    <div className="text-xs font-bold text-[#57534E] truncate mt-0.5">
                      {batch.source_label}
                    </div>
                  </div>
                  {getStatusBadge(batch.status)}
                </div>

                <div className="flex items-center justify-between border-t border-[#EFECE6] pt-2 text-[11px]">
                  <span className="font-semibold text-[#78716C]">
                    {batch.raw_row_count} rows ·{' '}
                    {new Date(batch.export_timestamp).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBatch(batch.batch_id);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-3 py-1 text-[11px] font-extrabold text-[#18181B] cursor-pointer"
                  >
                    <Eye className="h-3 w-3 text-[#0F766E]" />
                    Inspect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Batch Table */
        <div className="overflow-hidden rounded-[22px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFECE6] bg-[#FAF8F5] text-[#78716C] font-extrabold uppercase text-[10.5px] tracking-[0.05em]">
                  <th className="px-4 py-3">Batch ID</th>
                  <th className="px-4 py-3">Source Spreadsheet</th>
                  <th className="px-4 py-3">Export Date</th>
                  <th className="px-4 py-3">Raw Rows</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {batches.map((batch) => {
                  const isSelected = batch.batch_id === selectedBatchId;
                  return (
                    <tr
                      key={batch.batch_id}
                      onClick={() => onSelectBatch(batch.batch_id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#F0FDFA]' : 'hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-extrabold text-[#18181B]">
                        {batch.batch_id}
                      </td>
                      <td className="px-4 py-3 text-[#57534E]">
                        <div className="font-extrabold text-[#18181B]">{batch.source_label}</div>
                        <div className="text-[11px] font-mono text-[#78716C] truncate max-w-xs">
                          {batch.source_spreadsheet_id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#57534E] font-semibold">
                        {new Date(batch.export_timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-[#18181B]">
                        {batch.raw_row_count} rows
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(batch.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBatch(batch.batch_id);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-3 py-1 text-xs font-extrabold text-[#18181B] hover:bg-[#FAF8F5] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#0F766E]" />
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
