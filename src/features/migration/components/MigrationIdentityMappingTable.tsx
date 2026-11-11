import { useState } from 'react';
import { UserCheck, AlertTriangle, ShieldCheck, Edit3, X, Check } from 'lucide-react';
import type { MigrationIdMap } from '../domain/migrationEngine';

interface MigrationIdentityMappingTableProps {
  readonly idMaps: ReadonlyArray<MigrationIdMap>;
  readonly staffDirectory: ReadonlyArray<{
    readonly id: number;
    readonly rosterName: string;
    readonly staffCode: string;
  }>;
  readonly onSaveMapping: (
    sourceKey: string,
    canonicalId: string,
    canonicalLabel: string,
    notes?: string,
  ) => Promise<void>;
}

export function MigrationIdentityMappingTable({
  idMaps,
  staffDirectory,
  onSaveMapping,
}: MigrationIdentityMappingTableProps) {
  const [editingMap, setEditingMap] = useState<MigrationIdMap | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenEdit = (map: MigrationIdMap) => {
    setEditingMap(map);
    setSelectedStaffId(map.canonical_id !== '0' ? map.canonical_id : '');
    setNotes(map.notes ?? '');
  };

  const handleSave = async () => {
    if (!editingMap || !selectedStaffId) return;
    const target = staffDirectory.find((s) => String(s.id) === selectedStaffId);
    if (!target) return;

    try {
      setIsSubmitting(true);
      await onSaveMapping(
        editingMap.source_key,
        String(target.id),
        target.rosterName,
        notes || 'Manually approved by owner',
      );
      setEditingMap(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConfidenceBadge = (confidence: MigrationIdMap['confidence']) => {
    switch (confidence) {
      case 'exact':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> Exact Match
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:text-blue-300">
            <UserCheck className="h-3 w-3" /> High Confidence
          </span>
        );
      case 'manual_approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-800 dark:text-purple-300">
            <UserCheck className="h-3 w-3" /> Owner Approved
          </span>
        );
      case 'collision':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-800 dark:text-rose-300">
            <AlertTriangle className="h-3 w-3" /> Name Collision
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" /> Unresolved
          </span>
        );
    }
  };

  const unresolvedCount = idMaps.filter(
    (m) => m.confidence === 'unresolved' || m.confidence === 'collision',
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text-primary">
            Staff Identity Reconciliation (legacy.id_map)
          </h3>
          <p className="text-xs text-text-secondary">
            Deterministic mapping from legacy Google Sheets names to canonical Staff Directory
            records. Never merge without confirmation.
          </p>
        </div>

        {unresolvedCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {unresolvedCount} Pending Identity Resolutions
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% Staff Identities Reconciled
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-primary shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary/70 text-text-secondary font-semibold">
                <th className="px-3.5 py-2.5">Source Name</th>
                <th className="px-3.5 py-2.5">Source Tab</th>
                <th className="px-3.5 py-2.5">Canonical Staff Match</th>
                <th className="px-3.5 py-2.5">Confidence</th>
                <th className="px-3.5 py-2.5">Notes</th>
                <th className="px-3.5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {idMaps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-text-muted italic">
                    No staff identity mappings discovered for this batch yet.
                  </td>
                </tr>
              ) : (
                idMaps.map((map) => (
                  <tr key={map.id} className="hover:bg-surface-secondary/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-bold text-text-primary">{map.source_key}</td>
                    <td className="px-3.5 py-2.5 text-text-muted">{map.source_tab}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="font-semibold text-text-primary">{map.canonical_label}</span>
                      {map.canonical_id !== '0' && (
                        <span className="ml-1.5 font-mono text-[11px] text-text-muted">
                          (ID: {map.canonical_id})
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">{getConfidenceBadge(map.confidence)}</td>
                    <td className="px-3.5 py-2.5 text-text-secondary truncate max-w-xs">
                      {map.notes ?? '-'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(map)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-primary px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-surface-secondary"
                      >
                        <Edit3 className="h-3 w-3 text-text-muted" />
                        {map.confidence === 'unresolved' ? 'Resolve' : 'Remap'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Resolution Modal */}
      {editingMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-primary p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-text-primary">
                Resolve Identity: {editingMap.source_key}
              </h4>
              <button
                type="button"
                onClick={() => setEditingMap(null)}
                className="rounded-lg p-1 text-text-muted hover:bg-surface-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-text-secondary">
              Select the canonical staff member from the approved Staff Directory to bind with
              legacy records.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Canonical Staff Member
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-primary p-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                >
                  <option value="">-- Choose Canonical Staff --</option>
                  {staffDirectory.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.rosterName} ({staff.staffCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Resolution Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Confirmed with Dr Afif on Telegram"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-primary p-2 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMap(null)}
                className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedStaffId || isSubmitting}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-brand-primary/90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                {isSubmitting ? 'Saving...' : 'Save Mapping'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
