import { useState } from 'react';
import { UserCheck, AlertTriangle, ShieldCheck, Edit3, Check } from 'lucide-react';
import { Modal, useIsMobileViewport } from '@/shared/ui';
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
  const isMobile = useIsMobileViewport(767);
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
          <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#065F46]">
            <ShieldCheck className="h-3 w-3" /> Exact Match
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#0F766E]">
            <UserCheck className="h-3 w-3" /> High Confidence
          </span>
        );
      case 'manual_approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#B8CEF2] bg-[#DCE7F9] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#1E3A8A]">
            <UserCheck className="h-3 w-3" /> Owner Approved
          </span>
        );
      case 'collision':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10.5px] font-extrabold text-rose-700">
            <AlertTriangle className="h-3 w-3" /> Name Collision
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#92400E]">
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
          <h3 className="text-sm font-extrabold text-[#18181B]">Staff Identity Reconciliation</h3>
          <p className="text-xs font-medium text-[#78716C]">
            Deterministic mapping from Google Sheets names to canonical Staff Directory records.
          </p>
        </div>

        {unresolvedCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-3 py-1 text-xs font-extrabold text-[#92400E]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {unresolvedCount} Pending Identity Resolutions
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1 text-xs font-extrabold text-[#065F46]">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% Staff Identities Reconciled
          </span>
        )}
      </div>

      {idMaps.length === 0 ? (
        <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-8 text-center text-xs font-semibold text-[#78716C]">
          No staff identity mappings discovered for this batch yet.
        </div>
      ) : isMobile ? (
        /* Mobile Stacked Identity Mapping Cards */
        <div className="space-y-2.5">
          {idMaps.map((map) => (
            <div
              key={map.id}
              className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-extrabold text-[#18181B]">{map.source_key}</div>
                  <div className="text-[11px] font-semibold text-[#78716C]">
                    Tab: {map.source_tab}
                  </div>
                </div>
                {getConfidenceBadge(map.confidence)}
              </div>

              <div className="rounded-xl border border-[#EFECE6] bg-[#FAF8F5] px-3 py-2 text-xs">
                <div className="font-extrabold text-[#18181B]">
                  Match: {map.canonical_label}
                  {map.canonical_id !== '0' && (
                    <span className="ml-1.5 font-mono text-[10.5px] font-semibold text-[#78716C]">
                      (ID: {map.canonical_id})
                    </span>
                  )}
                </div>
                {map.notes && <div className="text-[11px] text-[#78716C] mt-0.5">{map.notes}</div>}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(map)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-3 py-1 text-xs font-extrabold text-[#18181B] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  <Edit3 className="h-3 w-3 text-[#0F766E]" />
                  {map.confidence === 'unresolved' ? 'Resolve' : 'Remap'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop Identity Table */
        <div className="overflow-hidden rounded-[22px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFECE6] bg-[#FAF8F5] text-[#78716C] font-extrabold uppercase text-[10.5px] tracking-[0.05em]">
                  <th className="px-4 py-3">Source Name</th>
                  <th className="px-4 py-3">Source Tab</th>
                  <th className="px-4 py-3">Canonical Staff Match</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {idMaps.map((map) => (
                  <tr key={map.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="px-4 py-3 font-extrabold text-[#18181B]">{map.source_key}</td>
                    <td className="px-4 py-3 text-[#78716C] font-semibold">{map.source_tab}</td>
                    <td className="px-4 py-3">
                      <span className="font-extrabold text-[#18181B]">{map.canonical_label}</span>
                      {map.canonical_id !== '0' && (
                        <span className="ml-1.5 font-mono text-[11px] text-[#78716C]">
                          (ID: {map.canonical_id})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getConfidenceBadge(map.confidence)}</td>
                    <td className="px-4 py-3 text-[#57534E] truncate max-w-xs">
                      {map.notes ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(map)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-3 py-1 text-xs font-extrabold text-[#18181B] hover:bg-[#FAF8F5] cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3 text-[#0F766E]" />
                        {map.confidence === 'unresolved' ? 'Resolve' : 'Remap'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Resolution Modal */}
      <Modal
        isOpen={editingMap !== null}
        onClose={() => setEditingMap(null)}
        title={editingMap ? `Resolve Identity: ${editingMap.source_key}` : 'Resolve Identity'}
        description="Bind legacy record names to an approved Staff Directory account."
        presentation="drawer"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingMap(null)}
              className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedStaffId || isSubmitting}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-4 py-2 text-xs font-extrabold text-white shadow-2xs hover:bg-[#115E59] disabled:opacity-50 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              {isSubmitting ? 'Saving...' : 'Save Mapping'}
            </button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-extrabold text-[#18181B] mb-1">
              Canonical Staff Member
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-2.5 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
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
            <label className="block text-xs font-extrabold text-[#18181B] mb-1">
              Resolution Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Confirmed with Dr Afif on Telegram"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-2.5 text-xs font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
