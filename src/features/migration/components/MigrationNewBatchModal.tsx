import { useState } from 'react';
import { X, Plus, FileSpreadsheet } from 'lucide-react';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-primary p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-brand-primary" />
            <h3 className="text-sm font-bold text-text-primary">New Migration Ingest Batch</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-surface-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-text-secondary">
          Registers a new immutable migration batch container in <code>legacy.import_batches</code>{' '}
          for read-only workbook export ingestion.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Batch Identifier
            </label>
            <input
              type="text"
              required
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-primary p-2 text-xs font-mono text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Source Google Sheets ID
            </label>
            <input
              type="text"
              required
              value={sourceSpreadsheetId}
              onChange={(e) => setSourceSpreadsheetId(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-primary p-2 text-xs font-mono text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Source Workbook Label
            </label>
            <input
              type="text"
              required
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-primary p-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Batch Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-primary p-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-brand-primary/90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {isSubmitting ? 'Creating...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
