import { useState } from 'react';
import { CheckCircle2, AlertTriangle, FileSpreadsheet, ShieldAlert } from 'lucide-react';
import type { MigrationBatchDetails } from '../domain/migrationEngine';

interface MigrationReconciliationViewProps {
  readonly details: MigrationBatchDetails;
  readonly onUpdateDisposition: (
    resultId: number,
    disposition: 'pending' | 'approved' | 'flagged' | 'rejected',
    notes?: string,
  ) => Promise<void>;
}

export function MigrationReconciliationView({
  details,
  onUpdateDisposition,
}: MigrationReconciliationViewProps) {
  const { batch, tabs, reconciliation } = details;
  const [dispositionNotes, setDispositionNotes] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const totalCanonicalRows = reconciliation.reduce((acc, r) => acc + r.canonical_count, 0);
  const allChecksumsMatch =
    reconciliation.length > 0 && reconciliation.every((r) => r.checksum_match);

  const handleSetDisposition = async (
    resultId: number,
    disposition: 'approved' | 'flagged' | 'rejected',
  ) => {
    try {
      setIsUpdating(true);
      await onUpdateDisposition(resultId, disposition, dispositionNotes);
      setDispositionNotes('');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold">
            <FileSpreadsheet className="h-4 w-4 text-brand-primary" />
            Source Raw Rows
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{batch.raw_row_count}</div>
          <div className="text-[11px] text-text-muted mt-0.5">
            Across {tabs.length} classified tabs
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Canonical Records
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{totalCanonicalRows}</div>
          <div className="text-[11px] text-text-muted mt-0.5">Transformed into Supabase schema</div>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold">
            <ShieldAlert className="h-4 w-4 text-teal-600" />
            Checksum Verification
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">
            {allChecksumsMatch ? (
              <span className="text-emerald-700 dark:text-emerald-400">100% Match</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">Review Required</span>
            )}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">
            Deterministic cryptographic audit
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-primary p-4 shadow-2xs">
          <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Status
          </div>
          <div className="mt-2 text-2xl font-bold capitalize text-text-primary">
            {batch.status.replace('_', ' ')}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">Batch ID: {batch.batch_id}</div>
        </div>
      </div>

      {/* Tabs Manifest Cards */}
      <div className="rounded-2xl border border-border-default bg-surface-primary p-4 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-text-primary">Ingested Tabs Manifest</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {tabs.map((tab) => (
            <div
              key={tab.tab_name}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-secondary/40 px-3 py-2 text-xs"
            >
              <span className="font-semibold text-text-primary">{tab.tab_name}</span>
              <span className="rounded-md bg-surface-primary px-2 py-0.5 font-mono text-[11px] font-bold text-text-secondary shadow-2xs">
                {tab.row_count} rows
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-text-primary">
            Domain Reconciliation Results (legacy.reconciliation_results)
          </h3>
          <p className="text-xs text-text-secondary">
            Aggregate row counts, duplicate checks, and owner disposition for historical records.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-primary shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary/70 text-text-secondary font-semibold">
                  <th className="px-3.5 py-2.5">Category</th>
                  <th className="px-3.5 py-2.5">Period</th>
                  <th className="px-3.5 py-2.5 text-center">Source Rows</th>
                  <th className="px-3.5 py-2.5 text-center">Canonical Rows</th>
                  <th className="px-3.5 py-2.5 text-center">Checksum Match</th>
                  <th className="px-3.5 py-2.5">Owner Disposition</th>
                  <th className="px-3.5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {reconciliation.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-text-muted italic">
                      No reconciliation passes executed yet. Run a dry-run rehearsal to calculate
                      reconciliation counts.
                    </td>
                  </tr>
                ) : (
                  reconciliation.map((res) => (
                    <tr key={res.id} className="hover:bg-surface-secondary/40 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold capitalize text-text-primary">
                        {res.category.replace('_', ' ')}
                      </td>
                      <td className="px-3.5 py-2.5 text-text-muted">
                        {res.period_start ?? 'All / Aggregate'}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono font-semibold text-text-primary">
                        {res.source_count}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono font-semibold text-text-primary">
                        {res.canonical_count}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        {res.checksum_match ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" /> Mismatch
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            res.reviewer_disposition === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                              : res.reviewer_disposition === 'flagged'
                                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {res.reviewer_disposition}
                        </span>
                        {res.disposition_notes && (
                          <span className="ml-2 text-[11px] text-text-muted italic truncate max-w-xs">
                            {res.disposition_notes}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {res.reviewer_disposition !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleSetDisposition(res.id, 'approved')}
                              disabled={isUpdating}
                              className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              Approve
                            </button>
                          )}
                          {res.reviewer_disposition !== 'flagged' && (
                            <button
                              type="button"
                              onClick={() => handleSetDisposition(res.id, 'flagged')}
                              disabled={isUpdating}
                              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              Flag
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
