import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/shared/ui';

interface MigrationNewBatchModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreateBatch: (params: {
    batchId: string;
    sourceSpreadsheetId: string;
    sourceLabel: string;
    notes?: string;
  }) => Promise<void>;
}

export function MigrationNewBatchModal({
  isOpen,
  onClose,
  onCreateBatch,
}: MigrationNewBatchModalProps) {
  const [batchId, setBatchId] = useState(
    () => `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`,
  );
  const [sourceSpreadsheetId, setSourceSpreadsheetId] = useState(
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  );
  const [sourceLabel, setSourceLabel] = useState('HSAAS Emergency Medicine Master Workbook');
  const [notes, setNotes] = useState('Exported from live read-only Google Sheets');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !sourceSpreadsheetId) return;

    try {
      setIsSubmitting(true);
      await onCreateBatch({
        batchId: batchId.trim(),
        sourceSpreadsheetId: sourceSpreadsheetId.trim(),
        sourceLabel: sourceLabel.trim(),
        notes: notes.trim(),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Migration Ingest Batch"
      description="Register an immutable migration batch container for read-only workbook export ingestion."
      presentation="drawer"
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-migration-batch-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            {isSubmitting ? 'Creating...' : 'Create Batch'}
          </button>
        </div>
      }
    >
      <form id="new-migration-batch-form" onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-extrabold text-[#18181B] mb-1">
            Batch Identifier
          </label>
          <input
            type="text"
            required
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-2.5 text-xs font-mono text-[#18181B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-extrabold text-[#18181B] mb-1">
            Source Google Sheets ID
          </label>
          <input
            type="text"
            required
            value={sourceSpreadsheetId}
            onChange={(e) => setSourceSpreadsheetId(e.target.value)}
            className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-2.5 text-xs font-mono text-[#18181B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-extrabold text-[#18181B] mb-1">
            Source Workbook Label
          </label>
          <input
            type="text"
            required
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-2.5 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-extrabold text-[#18181B] mb-1">
            Batch Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-2.5 text-xs text-[#18181B] focus:border-[#0F766E] focus:outline-none"
          />
        </div>
      </form>
    </Modal>
  );
}
