import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useIsMobileViewport } from '@/shared/ui';
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
  const isMobile = useIsMobileViewport(767);
  const { tabs, reconciliation } = details;
  const [dispositionNotes, setDispositionNotes] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSetDisposition = async (
    resultId: number,
    disposition: 'approved' | 'flagged' | 'rejected',
  ) => {
    try {
      setIsUpdating(true);
      await onUpdateDisposition(resultId, disposition, dispositionNotes.trim() || undefined);
      setDispositionNotes('');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tabs Manifest Cards */}
      <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-3">
        <h3 className="text-sm font-extrabold text-[#18181B]">Ingested Tabs Manifest</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {tabs.map((tab) => (
            <div
              key={tab.tab_name}
              className="flex items-center justify-between rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] px-3 py-2 text-xs"
            >
              <span className="font-extrabold text-[#18181B]">{tab.tab_name}</span>
              <span className="rounded-full border border-[#E7E5E4] bg-white px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-[#57534E]">
                {tab.row_count} rows
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Reconciliation Results Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#18181B]">Domain Reconciliation Results</h3>
            <p className="text-xs font-medium text-[#78716C]">
              Aggregate row counts, duplicate checks, and owner review disposition for imported
              records.
            </p>
          </div>
          <div className="sm:w-72">
            <input
              type="text"
              aria-label="Owner review note"
              value={dispositionNotes}
              onChange={(e) => setDispositionNotes(e.target.value)}
              placeholder="Optional review note (saved on Approve/Flag)..."
              className="w-full rounded-full border border-[#E7E5E4] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#18181B] placeholder:text-[#A8A29E] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>

        {reconciliation.length === 0 ? (
          <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-8 text-center text-xs font-semibold text-[#78716C]">
            No reconciliation passes executed yet. Run a dry-run rehearsal to calculate
            reconciliation counts.
          </div>
        ) : isMobile ? (
          /* Mobile Stacked Reconciliation Cards */
          <div className="space-y-2.5">
            {reconciliation.map((res) => (
              <div
                key={res.id}
                className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold capitalize text-[#18181B]">
                      {res.category.replace('_', ' ')}
                    </div>
                    <div className="text-[11px] font-semibold text-[#78716C]">
                      Period: {res.period_start ?? 'All / Aggregate'}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${
                      res.reviewer_disposition === 'approved'
                        ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                        : res.reviewer_disposition === 'flagged'
                          ? 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
                          : 'border-[#E7E5E4] bg-[#F5F5F4] text-[#57534E]'
                    }`}
                  >
                    {res.reviewer_disposition}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] rounded-xl border border-[#EFECE6] bg-[#FAF8F5] px-3 py-2">
                  <span className="font-mono font-bold text-[#18181B]">
                    Source: {res.source_count} · Canonical: {res.canonical_count}
                  </span>
                  {res.checksum_match ? (
                    <span className="inline-flex items-center gap-1 font-extrabold text-[#065F46]">
                      <CheckCircle2 className="h-3 w-3" /> Matched
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-extrabold text-[#B45309]">
                      <AlertTriangle className="h-3 w-3" /> Mismatch
                    </span>
                  )}
                </div>

                {res.disposition_notes && (
                  <p className="text-[11px] italic text-[#78716C]">{res.disposition_notes}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  {res.reviewer_disposition !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => void handleSetDisposition(res.id, 'approved')}
                      disabled={isUpdating}
                      className="rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1 text-[11px] font-extrabold text-[#065F46] hover:bg-[#D1FAE5] cursor-pointer"
                    >
                      Approve
                    </button>
                  )}
                  {res.reviewer_disposition !== 'flagged' && (
                    <button
                      type="button"
                      onClick={() => void handleSetDisposition(res.id, 'flagged')}
                      disabled={isUpdating}
                      className="rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-3 py-1 text-[11px] font-extrabold text-[#92400E] hover:bg-[#FDE68A]/70 cursor-pointer"
                    >
                      Flag
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop Reconciliation Table */
          <div className="overflow-hidden rounded-[22px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#EFECE6] bg-[#FAF8F5] text-[#78716C] font-extrabold uppercase text-[10.5px] tracking-[0.05em]">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3 text-center">Source Rows</th>
                    <th className="px-4 py-3 text-center">Canonical Rows</th>
                    <th className="px-4 py-3 text-center">Checksum Match</th>
                    <th className="px-4 py-3">Owner Disposition</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6]">
                  {reconciliation.map((res) => (
                    <tr key={res.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="px-4 py-3 font-extrabold capitalize text-[#18181B]">
                        {res.category.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-[#78716C] font-semibold">
                        {res.period_start ?? 'All / Aggregate'}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-extrabold text-[#18181B]">
                        {res.source_count}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-extrabold text-[#18181B]">
                        {res.canonical_count}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {res.checksum_match ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#065F46]">
                            <CheckCircle2 className="h-3 w-3" /> Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#B45309]">
                            <AlertTriangle className="h-3 w-3" /> Mismatch
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold ${
                            res.reviewer_disposition === 'approved'
                              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                              : res.reviewer_disposition === 'flagged'
                                ? 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
                                : 'border-[#E7E5E4] bg-[#F5F5F4] text-[#57534E]'
                          }`}
                        >
                          {res.reviewer_disposition}
                        </span>
                        {res.disposition_notes && (
                          <span className="ml-2 text-[11px] text-[#78716C] italic truncate max-w-xs">
                            {res.disposition_notes}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {res.reviewer_disposition !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => void handleSetDisposition(res.id, 'approved')}
                              disabled={isUpdating}
                              className="rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-extrabold text-[#065F46] hover:bg-[#D1FAE5] cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {res.reviewer_disposition !== 'flagged' && (
                            <button
                              type="button"
                              onClick={() => void handleSetDisposition(res.id, 'flagged')}
                              disabled={isUpdating}
                              className="rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-1 text-[11px] font-extrabold text-[#92400E] hover:bg-[#FDE68A]/70 cursor-pointer"
                            >
                              Flag
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
