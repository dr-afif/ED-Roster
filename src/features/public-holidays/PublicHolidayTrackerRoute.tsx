import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  FileText,
  Info,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { isAdminPtpoUser, useAuthBoundary } from '@/platform/auth';
import { getShiftToneClasses, Modal, SkeletonPhTrackerView, useToast } from '@/shared/ui';
import { generateGhkaMemoDocx } from './ghkaMemoExport';
import type { PhCredit } from './types';
import { usePublicHolidayTracker } from './usePublicHolidayTracker';

function getDoctorShortLabel(name?: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  if (first && /^dr\.?$/i.test(first) && parts.length > 1 && parts[1]) {
    return `Dr ${parts[1]}`;
  }
  return first || trimmed;
}

function formatDisplayDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatSlashDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMonthGroupTitle(yyyyMm: string): string {
  if (yyyyMm === 'Other') return 'Other Dates';
  const [y, m] = yyyyMm.split('-').map(Number);
  if (!y || !m) return yyyyMm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export interface PublicHolidayTrackerRouteProps {
  embedded?: boolean;
}

export function PublicHolidayTrackerRoute({ embedded = false }: PublicHolidayTrackerRouteProps) {
  const { user } = useAuthBoundary();
  const showToast = useToast();
  const isOwner = user?.role === 'owner';
  const canManageGhkaMemos = isOwner || isAdminPtpoUser(user);
  const myStaffId = user?.staffId;

  const [activeYear, setActiveYear] = useState<string>(() => String(new Date().getFullYear()));
  const [activeView, setActiveView] = useState<'department' | 'personal'>(() =>
    canManageGhkaMemos ? 'department' : 'personal',
  );

  // Admin toggles
  const [isHolidayManagerOpen, setIsHolidayManagerOpen] = useState(false);
  const [isMemoEditMode, setIsMemoEditMode] = useState(false);
  const [isDeptSummaryOpen, setIsDeptSummaryOpen] = useState(false);
  const [confirmDeleteHolidayDate, setConfirmDeleteHolidayDate] = useState<string | null>(null);

  // Opening balance inline edits
  const [editingBalances, setEditingBalances] = useState<
    Record<number, { balance: number; note: string }>
  >({});

  // New holiday form
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayJurisdiction, setNewHolidayJurisdiction] = useState('federal_and_selangor');
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

  // Personal Detail Modal State
  const [detailCredit, setDetailCredit] = useState<PhCredit | null>(null);

  // 2-Step Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStep, setExportStep] = useState<'select' | 'preview'>('select');
  const [exportSelectedRows, setExportSelectedRows] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);

  const tracker = usePublicHolidayTracker(activeYear);
  const {
    isLoading,
    staffList,
    activeStaffList,
    matched,
    summaries,
    warnings,
    matrixRows,
    totals,
    memoSubmissionsMap,
    holidaysList,
    upsertOpeningBalanceMutation,
    toggleMemoStatusMutation,
    upsertHolidayMutation,
    deleteHolidayMutation,
  } = tracker;

  const yearHolidaysCount = useMemo(
    () => holidaysList.filter((h) => h.holidayDate.startsWith(activeYear)).length,
    [holidaysList, activeYear],
  );

  // Selected Doctor for Personal View (owner can inspect any doctor, doctor inspects self)
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(myStaffId || null);
  const currentViewStaffId = canManageGhkaMemos && selectedStaffId ? selectedStaffId : myStaffId;

  const currentDoctorProfile = useMemo(() => {
    return staffList.find((s) => s.id === currentViewStaffId) || null;
  }, [staffList, currentViewStaffId]);

  const doctorCredits = useMemo(() => {
    if (!currentViewStaffId) return [];
    return matched.filter((m) => m.staffId === currentViewStaffId);
  }, [matched, currentViewStaffId]);

  const doctorWarnings = useMemo(() => {
    if (!currentViewStaffId) return [];
    return warnings.filter((w) => w.staffId === currentViewStaffId);
  }, [warnings, currentViewStaffId]);

  const exportableRecords = useMemo(() => {
    return doctorCredits.filter((c) => c.status === 'USED' && c.matchedGhkaDate);
  }, [doctorCredits]);

  const exportableGroupedByMonth = useMemo(() => {
    const groups = new Map<string, PhCredit[]>();
    const sorted = [...exportableRecords].sort((a, b) =>
      (b.matchedGhkaDate || '').localeCompare(a.matchedGhkaDate || ''),
    );
    for (const r of sorted) {
      const key =
        r.matchedGhkaDate && r.matchedGhkaDate.length >= 7
          ? r.matchedGhkaDate.slice(0, 7)
          : 'Other';
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [exportableRecords]);

  const selectedExportRecords = useMemo(
    () =>
      exportableRecords.filter((r) =>
        Boolean(exportSelectedRows[`${r.staffId}_${r.matchedGhkaDate}`]),
      ),
    [exportableRecords, exportSelectedRows],
  );

  const primaryMemoMonth = useMemo(() => {
    const first = selectedExportRecords[0]?.matchedGhkaDate;
    if (first && first.length >= 7) return first.slice(0, 7);
    return `${activeYear}-01`;
  }, [selectedExportRecords, activeYear]);

  const doctorUnclaimedCredits = useMemo(
    () => doctorCredits.filter((c) => c.status !== 'USED'),
    [doctorCredits],
  );

  const doctorPendingMemosCount = useMemo(() => {
    return exportableRecords.filter(
      (c) => !memoSubmissionsMap.get(`${c.staffId}_${c.matchedGhkaDate}`),
    ).length;
  }, [exportableRecords, memoSubmissionsMap]);

  const deptPendingMemosCount = useMemo(() => {
    return matched.filter(
      (c) =>
        c.status === 'USED' &&
        Boolean(c.matchedGhkaDate) &&
        !memoSubmissionsMap.get(`${c.staffId}_${c.matchedGhkaDate}`),
    ).length;
  }, [matched, memoSubmissionsMap]);

  // Handle opening export modal & preselect latest month or unsubmitted claims
  const handleOpenExportModal = () => {
    const sorted = [...exportableRecords].sort((a, b) =>
      (b.matchedGhkaDate || '').localeCompare(a.matchedGhkaDate || ''),
    );
    const defaultMonth = sorted[0]?.matchedGhkaDate?.slice(0, 7) ?? `${activeYear}-01`;
    const autoSelected: Record<string, boolean> = {};
    for (const r of exportableRecords) {
      const key = `${r.staffId}_${r.matchedGhkaDate}`;
      if (r.matchedGhkaDate?.startsWith(defaultMonth)) {
        autoSelected[key] = true;
      }
    }
    setExportSelectedRows(autoSelected);
    setExportStep('select');
    setIsExportModalOpen(true);
  };

  const handleToggleMonthGroup = (records: PhCredit[], selectAll: boolean) => {
    setExportSelectedRows((prev) => {
      const next = { ...prev };
      for (const r of records) {
        next[`${r.staffId}_${r.matchedGhkaDate}`] = selectAll;
      }
      return next;
    });
  };

  const handleGenerateExport = async () => {
    if (selectedExportRecords.length === 0 || !currentDoctorProfile) return;

    setIsExporting(true);
    try {
      await generateGhkaMemoDocx({
        memoMonth: primaryMemoMonth,
        applicantName: currentDoctorProfile.fullName || currentDoctorProfile.name,
        applicantStaffId:
          currentDoctorProfile.staffCode || currentDoctorProfile.registrationNumber || '',
        applicantPhone: currentDoctorProfile.phone || '',
        applicantEmail: currentDoctorProfile.email || '',
        memoDate: new Date().toISOString(),
        rows: selectedExportRecords.map((r) => {
          const isCarryForward = r.source === 'opening_balance';
          const ghkaDateObj = new Date(r.matchedGhkaDate || '');
          return {
            phDate: isCarryForward ? '' : r.holidayDate || '',
            phName: isCarryForward ? 'Opening Balance' : r.holidayName,
            ghkaDate: r.matchedGhkaDate || '',
            ghkaDay: Number.isNaN(ghkaDateObj.getTime())
              ? ''
              : ghkaDateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          };
        }),
      });
      showToast('GHKA Memo .docx downloaded ✓');
      setIsExportModalOpen(false);
    } catch (error) {
      showToast(
        `Failed to generate DOCX memo: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleMemoStatus = async (
    staffId: number,
    replacementDate: string,
    holidayDate?: string | null,
  ) => {
    if (!canManageGhkaMemos) return;
    const key = `${staffId}_${replacementDate}`;
    const currentStatus = Boolean(memoSubmissionsMap.get(key));
    try {
      await toggleMemoStatusMutation.mutateAsync({
        staffId,
        replacementDate,
        holidayDate,
        isSubmitted: !currentStatus,
      });
      showToast(!currentStatus ? 'Marked as Memo Submitted ✓' : 'Marked as Memo Pending');
    } catch (error) {
      showToast(
        `Failed to update memo status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleSaveOpeningBalance = async (staffId: number) => {
    const edit = editingBalances[staffId];
    if (!edit) return;
    try {
      await upsertOpeningBalanceMutation.mutateAsync({
        staffId,
        year: parseInt(activeYear, 10),
        balance: edit.balance,
        note: edit.note,
      });
      setEditingBalances((prev) => {
        const { [staffId]: _removed, ...rest } = prev;
        return rest;
      });
      showToast('Opening GHKA balance saved ✓');
    } catch (error) {
      showToast(
        `Failed to save opening balance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleAddCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) return;

    setIsAddingHoliday(true);
    try {
      await upsertHolidayMutation.mutateAsync({
        holidayDate: newHolidayDate,
        name: newHolidayName.trim(),
        jurisdiction: newHolidayJurisdiction,
        isStateSpecific: newHolidayJurisdiction.includes('selangor'),
      });
      setNewHolidayDate('');
      setNewHolidayName('');
      showToast('Public holiday added ✓');
    } catch (error) {
      showToast(`Failed to add holiday: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAddingHoliday(false);
    }
  };

  const handleDeleteCustomHoliday = async (date: string) => {
    try {
      await deleteHolidayMutation.mutateAsync(date);
      setConfirmDeleteHolidayDate(null);
      showToast('Holiday removed ✓');
    } catch (error) {
      showToast(
        `Failed to delete holiday: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  if (isLoading) {
    return <SkeletonPhTrackerView embedded={embedded} />;
  }

  return (
    <div className={embedded ? 'space-y-4' : 'mx-auto px-4 py-6 md:px-8 max-w-7xl space-y-5'}>
      {/* Standalone Page Header (omitted when embedded in ProfessionalRecordsRoute) */}
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2 text-[#18181B]">
              <Sparkles className="w-6 h-6 text-[#0F766E]" />
              <span>
                {canManageGhkaMemos && activeView === 'department'
                  ? 'Public Holiday Tracker'
                  : 'My Public Holiday Tracker'}
              </span>
            </h1>
            <p className="text-xs text-[#78716C] mt-1 font-medium">
              {canManageGhkaMemos && activeView === 'department'
                ? 'Track Public Holiday duties and GHKA replacements across the department.'
                : 'Earned replacement leave (GHKA) calculated from finalized duty rosters.'}
            </p>
          </div>
        </div>
      )}

      {/* Compact Warm Editorial Pill Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[20px] border border-[#E7E5E4] bg-white px-3.5 py-2.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
        <div className="flex flex-wrap items-center gap-2">
          {canManageGhkaMemos && (
            <div className="inline-flex items-center rounded-full border border-[#E7E5E4] bg-[#FAF8F5] p-0.5">
              <button
                type="button"
                onClick={() => setActiveView('department')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-extrabold transition cursor-pointer ${
                  activeView === 'department'
                    ? 'bg-[#0F766E] text-white shadow-2xs'
                    : 'text-[#57534E] hover:text-[#18181B]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Department</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('personal')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-extrabold transition cursor-pointer ${
                  activeView === 'personal'
                    ? 'bg-[#0F766E] text-white shadow-2xs'
                    : 'text-[#57534E] hover:text-[#18181B]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Personal</span>
              </button>
            </div>
          )}

          <select
            aria-label="Select tracker year"
            value={activeYear}
            onChange={(e) => setActiveYear(e.target.value)}
            className="rounded-full border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-1 text-[11.5px] font-extrabold text-[#18181B] outline-none focus:border-[#0F766E] cursor-pointer"
          >
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!canManageGhkaMemos || activeView === 'personal' ? (
            <button
              type="button"
              onClick={handleOpenExportModal}
              disabled={exportableRecords.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-3.5 py-1.5 text-[11.5px] font-extrabold text-white shadow-xs hover:bg-[#115E59] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print Memo</span>
            </button>
          ) : (
            <>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsHolidayManagerOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-extrabold transition cursor-pointer ${
                    isHolidayManagerOpen
                      ? 'border-[#0F766E] bg-[#F0FDFA] text-[#0F766E]'
                      : 'border-[#E7E5E4] bg-[#FAF8F5] text-[#18181B] hover:bg-[#EFECE6]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Holidays ({yearHolidaysCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsMemoEditMode((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-extrabold transition cursor-pointer ${
                  isMemoEditMode
                    ? 'border-[#0F766E] bg-[#0F766E] text-white'
                    : 'border-[#E7E5E4] bg-[#FAF8F5] text-[#18181B] hover:bg-[#EFECE6]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isMemoEditMode ? '✓ Memo Mode' : 'Memo Mode'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PERSONAL DOCTOR VIEW                                              */}
      {/* ========================================================================= */}
      {(!canManageGhkaMemos || activeView === 'personal') && (
        <div className="space-y-4">
          {/* Owner / PTPO Inspecting Doctor Pill Selector */}
          {canManageGhkaMemos && (
            <div className="rounded-[20px] border border-[#E7E5E4] bg-white px-4 py-3 shadow-[0_2px_10px_rgba(28,25,23,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#0F766E]" />
                <span className="text-[11px] font-extrabold text-[#57534E] uppercase tracking-[0.06em]">
                  Inspecting Doctor:
                </span>
              </div>
              <select
                value={currentViewStaffId || ''}
                onChange={(e) => setSelectedStaffId(Number(e.target.value) || null)}
                className="px-3.5 py-1.5 bg-[#FAF8F5] border border-[#E7E5E4] rounded-full text-xs font-extrabold text-[#18181B] outline-none focus:bg-white focus:border-[#0F766E]"
              >
                {activeStaffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.staffCode || 'MO'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2 Standardized Overview KPI Cards in 1 Row: Unclaimed GHKA & Claimed GHKA */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#D97706] bg-white px-3.5 py-3.5 sm:p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] flex items-center justify-between gap-2 sm:gap-4">
              <div className="min-w-0">
                <p className="text-[13px] sm:text-sm font-black text-[#18181B] uppercase tracking-[0.03em] leading-[1.18]">
                  <span className="block">Unclaimed</span>
                  <span className="block">GHKA</span>
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-3 sm:px-3.5 py-1 text-base sm:text-lg font-black text-[#92400E] tabular-nums">
                {doctorUnclaimedCredits.length}
              </span>
            </div>

            <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#0F766E] bg-white px-3.5 py-3.5 sm:p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)] flex items-center justify-between gap-2 sm:gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] sm:text-sm font-black text-[#18181B] uppercase tracking-[0.03em] leading-[1.18]">
                  <span className="block">Claimed</span>
                  <span className="block">GHKA</span>
                </p>
                {doctorPendingMemosCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-2 py-0.5 text-[9.5px] sm:text-[10px] font-extrabold text-[#C2410C]">
                    {doctorPendingMemosCount} Pending
                  </span>
                ) : (
                  exportableRecords.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[9.5px] sm:text-[10px] font-extrabold text-[#065F46]">
                      Submitted ✓
                    </span>
                  )
                )}
              </div>
              <span className="shrink-0 rounded-full border border-[#A7F3D0] bg-[#D1FAE5] px-3 sm:px-3.5 py-1 text-base sm:text-lg font-black text-[#065F46] tabular-nums">
                {exportableRecords.length}
              </span>
            </div>
          </div>

          {/* Personal Warnings */}
          {doctorWarnings.length > 0 && (
            <div className="rounded-[22px] border border-rose-200 bg-rose-50/70 p-4 space-y-2.5">
              <h3 className="text-[11px] font-extrabold text-rose-800 uppercase tracking-[0.06em] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Personal Warnings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {doctorWarnings.map((w, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-rose-100 p-3 flex items-start gap-2.5"
                  >
                    <span
                      className={`mt-0.5 rounded-full p-1 shrink-0 ${
                        w.severity === 'high'
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                    <p className="text-xs font-semibold text-[#18181B]">{w.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PH Credits & Replacements — Single-Doctor Matrix Layout matching Admin Department Matrix */}
          {matrixRows.length === 0 && doctorCredits.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-[#78716C] p-8 text-center gap-2 bg-white rounded-[24px] border border-[#E7E5E4]">
              <Info className="w-7 h-7 text-[#A8A29E]" />
              <p className="text-xs font-bold text-[#57534E]">
                No public holiday credit records found for {activeYear} yet.
              </p>
            </div>
          ) : (
            <div className="rounded-[24px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)] overflow-hidden flex flex-col">
              <div className="px-4 py-3.5 border-b border-[#EFECE6] bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-[11.5px] font-extrabold text-[#18181B] uppercase tracking-[0.05em] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0F766E]" />
                    <span>Public Holiday Credits &amp; Replacements</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[#92400E]">
                      ● Unclaimed
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#FDBA74] bg-[#FFF7ED] px-2 py-0.5 text-[#C2410C]">
                      ● Memo ✕
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[#065F46]">
                      ● Memo ✓
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto p-0 no-scrollbar">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[#FAF8F5]">
                      <th className="sticky left-0 z-20 bg-[#FAF8F5] py-2 px-3 text-[9.5px] font-extrabold text-[#78716C] uppercase tracking-wider border-b border-[#E7E5E4] border-r min-w-[140px]">
                        Holiday
                      </th>
                      <th className="py-2 px-3 text-[9.5px] font-extrabold text-[#18181B] uppercase tracking-wider border-b border-[#E7E5E4] text-center min-w-[130px]">
                        {getDoctorShortLabel(
                          currentDoctorProfile?.name || user?.rosterName || user?.displayName,
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6]">
                    {doctorCredits
                      .filter((c) => c.source === 'opening_balance')
                      .map((c, idx) => {
                        const isUsed = c.status === 'USED' && Boolean(c.matchedGhkaDate);
                        const memoKey = `${c.staffId}_${c.matchedGhkaDate}`;
                        const isMemoSubmitted = Boolean(memoSubmissionsMap.get(memoKey));
                        const repDateObj = c.matchedGhkaDate ? new Date(c.matchedGhkaDate) : null;
                        const claimedLabel =
                          repDateObj && !Number.isNaN(repDateObj.getTime())
                            ? repDateObj.toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })
                            : c.matchedGhkaDate || '';

                        return (
                          <tr key={`ob-${idx}`} className="hover:bg-[#FAF8F5]/60 transition">
                            <td className="sticky left-0 z-10 bg-white py-2 px-3 border-r border-[#EFECE6] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                              <p className="text-[11px] font-extrabold text-[#18181B] truncate">
                                Carry-Forward Opening
                              </p>
                              <p className="text-[9.5px] text-[#78716C] font-semibold">
                                Prior Year Balance
                              </p>
                            </td>
                            <td
                              onClick={() => setDetailCredit(c)}
                              className="py-1.5 px-2 text-center align-middle border-b border-[#EFECE6] cursor-pointer"
                            >
                              {!isUsed ? (
                                <div className="mx-auto max-w-[160px] rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-2 py-1 text-[9.5px] leading-tight text-[#92400E] shadow-2xs">
                                  <div className="font-extrabold">Opening Credit</div>
                                  <div className="font-bold opacity-85">Unclaimed</div>
                                </div>
                              ) : (
                                <div
                                  className={`mx-auto max-w-[160px] rounded-lg border px-2 py-1 text-[9.5px] leading-tight shadow-2xs ${
                                    isMemoSubmitted
                                      ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#166534]'
                                      : 'border-[#FDBA74] bg-[#FFF7ED] text-[#C2410C]'
                                  }`}
                                >
                                  <div className="font-extrabold">Opening Credit</div>
                                  <div className="font-bold opacity-90 whitespace-nowrap">
                                    Claimed: {claimedLabel}
                                  </div>
                                  <div className="font-extrabold">
                                    Memo {isMemoSubmitted ? '✓' : '✕'}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                    {matrixRows.map((row) => {
                      const d = new Date(row.date);
                      const formattedDate = Number.isNaN(d.getTime())
                        ? row.date
                        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      const cellData = currentViewStaffId
                        ? row.doctors[currentViewStaffId]
                        : undefined;

                      return (
                        <tr key={row.date} className="hover:bg-[#FAF8F5]/60 transition">
                          <td
                            className="sticky left-0 z-10 bg-white py-2 px-3 border-r border-[#EFECE6] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] max-w-[200px]"
                            title={row.name}
                          >
                            <p className="text-[11px] font-extrabold text-[#18181B] truncate">
                              {row.name}
                            </p>
                            <p className="text-[9.5px] text-[#78716C] font-semibold">
                              {formattedDate}
                            </p>
                          </td>

                          {(() => {
                            if (!cellData || !cellData.classification.earnsCredit) {
                              if (
                                cellData &&
                                cellData.classification.category === 'official_ph_off'
                              ) {
                                return (
                                  <td className="py-1.5 px-2 text-center align-middle border-b border-[#EFECE6]">
                                    <span className="text-[9.5px] font-extrabold text-[#57534E] bg-[#F5F5F4] border border-[#E7E5E4] px-2 py-0.5 rounded-md">
                                      HKA
                                    </span>
                                  </td>
                                );
                              }
                              if (
                                cellData &&
                                (cellData.classification.category === 'mc' ||
                                  cellData.classification.normalizedShift === 'MC')
                              ) {
                                return (
                                  <td className="py-1.5 px-2 text-center align-middle border-b border-[#EFECE6]">
                                    <span className="text-[9.5px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md">
                                      MC
                                    </span>
                                  </td>
                                );
                              }
                              return (
                                <td className="py-2 px-2 bg-[#FAF8F5]/40 text-center border-b border-[#EFECE6]">
                                  <span className="text-[10.5px] text-[#D6D3D1] font-medium">
                                    —
                                  </span>
                                </td>
                              );
                            }

                            const classification = cellData.classification;
                            const matchedRecord = cellData.matchedRecord;
                            const isUsed = matchedRecord?.status === 'USED';
                            const memoKey = `${currentViewStaffId}_${matchedRecord?.matchedGhkaDate}`;
                            const isMemoSubmitted = Boolean(memoSubmissionsMap.get(memoKey));

                            if (!isUsed || !matchedRecord?.matchedGhkaDate) {
                              return (
                                <td
                                  onClick={() => matchedRecord && setDetailCredit(matchedRecord)}
                                  className={`py-1.5 px-2 text-center align-middle border-b border-[#EFECE6] ${
                                    matchedRecord ? 'cursor-pointer' : ''
                                  }`}
                                >
                                  <div className="mx-auto max-w-[160px] rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-2 py-1 text-[9.5px] leading-tight text-[#92400E] shadow-2xs">
                                    <div className="font-extrabold">
                                      Worked {classification.normalizedShift}
                                    </div>
                                    <div className="font-bold opacity-85">Unclaimed</div>
                                  </div>
                                </td>
                              );
                            }

                            const repDateObj = new Date(matchedRecord.matchedGhkaDate);
                            const claimedLabel = Number.isNaN(repDateObj.getTime())
                              ? matchedRecord.matchedGhkaDate
                              : repDateObj.toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                });

                            const cardTone = isMemoSubmitted
                              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#166534]'
                              : 'border-[#FDBA74] bg-[#FFF7ED] text-[#C2410C]';

                            return (
                              <td
                                onClick={() => setDetailCredit(matchedRecord)}
                                className="py-1.5 px-2 text-center align-middle border-b border-[#EFECE6] cursor-pointer"
                              >
                                <div
                                  className={`mx-auto max-w-[160px] rounded-lg border px-2 py-1 text-[9.5px] leading-tight shadow-2xs transition-colors ${cardTone}`}
                                >
                                  <div className="font-extrabold">
                                    Worked {classification.normalizedShift}
                                  </div>
                                  <div className="font-bold opacity-90 whitespace-nowrap">
                                    Claimed: {claimedLabel}
                                  </div>
                                  <div className="font-extrabold">
                                    Memo {isMemoSubmitted ? '✓' : '✕'}
                                  </div>
                                </div>
                              </td>
                            );
                          })()}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEPARTMENT OVERVIEW & ANNUAL MATRIX (OWNER / PTPO)                */}
      {/* ========================================================================= */}
      {canManageGhkaMemos && activeView === 'department' && (
        <div className="space-y-4">
          {/* Department Overview Cards with Concise Status Pills */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#18181B] bg-white p-3.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] font-extrabold text-[#78716C] uppercase tracking-[0.05em]">
                  Total Opening
                </p>
                <span className="rounded-full bg-[#F5F5F4] px-2 py-0.5 text-[9.5px] font-extrabold text-[#57534E]">
                  {activeYear}
                </span>
              </div>
              <p className="text-2xl font-black text-[#18181B] mt-1.5 tabular-nums">
                {totals.totalOpeningBalance}
              </p>
            </div>

            <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#0F766E] bg-white p-3.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] font-extrabold text-[#78716C] uppercase tracking-[0.05em]">
                  PH Worked
                </p>
                <span className="rounded-full bg-[#F0FDFA] border border-[#99F6E4] px-2 py-0.5 text-[9.5px] font-extrabold text-[#0F766E]">
                  Earned
                </span>
              </div>
              <p className="text-2xl font-black text-[#0F766E] mt-1.5 tabular-nums">
                {totals.totalWorked}
              </p>
            </div>

            <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#15803D] bg-white p-3.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] font-extrabold text-[#78716C] uppercase tracking-[0.05em]">
                  GHKA Used
                </p>
                <span className="rounded-full bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 text-[9.5px] font-extrabold text-[#065F46]">
                  Replaced
                </span>
              </div>
              <p className="text-2xl font-black text-[#15803D] mt-1.5 tabular-nums">
                {totals.totalUsed}
              </p>
            </div>

            <div className="rounded-[20px] border border-[#E7E5E4] border-t-[3px] border-t-[#D97706] bg-white p-3.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] font-extrabold text-[#78716C] uppercase tracking-[0.05em]">
                  Closing Balance
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9.5px] font-extrabold ${
                    totals.totalOutstanding > 0
                      ? 'bg-[#FEF3C7] text-[#92400E]'
                      : 'bg-[#D1FAE5] text-[#065F46]'
                  }`}
                >
                  {totals.totalOutstanding > 0 ? 'Unclaimed' : 'Balanced'}
                </span>
              </div>
              <p className="text-2xl font-black text-[#B45309] mt-1.5 tabular-nums">
                {totals.totalOutstanding}
              </p>
            </div>
          </div>

          {/* Department Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-[22px] border border-[#FDE68A] bg-[#FFFBEB] p-4 space-y-2.5">
              <h3 className="text-[11px] font-extrabold text-[#92400E] uppercase tracking-[0.06em] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" /> Tracker Warnings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-[#FDE68A] p-3 flex items-start gap-2.5"
                  >
                    <span
                      className={`mt-0.5 rounded-full p-1 shrink-0 ${
                        w.severity === 'high'
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <p className="text-xs font-extrabold text-[#18181B]">{w.staffName}</p>
                      <p className="text-[11px] text-[#57534E] mt-0.5">{w.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 1. PUBLIC HOLIDAYS CALENDAR MANAGER (Toggled by Toolbar "Holidays (N)") */}
          {isHolidayManagerOpen && (
            <div className="rounded-[24px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[#EFECE6] bg-[#FAF8F5] flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold text-[#18181B] uppercase tracking-[0.05em] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0F766E]" />
                    <span>Gazetted &amp; Custom Public Holidays ({activeYear})</span>
                  </h3>
                  <p className="text-[11px] text-[#78716C] mt-0.5">
                    Shifts worked on these dates accrue GHKA credits automatically.
                  </p>
                </div>
              </div>

              {/* Add Holiday Form */}
              <form
                onSubmit={handleAddCustomHoliday}
                className="p-4 border-b border-[#EFECE6] bg-[#FAF8F5]/60 flex flex-wrap items-end gap-3 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-extrabold text-[#57534E] uppercase mb-1">
                    Holiday Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#E7E5E4] rounded-xl font-semibold text-[#18181B] outline-none focus:border-[#0F766E]"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[10px] font-extrabold text-[#57534E] uppercase mb-1">
                    Holiday Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Special Declared Holiday"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#E7E5E4] rounded-xl font-semibold text-[#18181B] outline-none focus:border-[#0F766E]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-[#57534E] uppercase mb-1">
                    Jurisdiction
                  </label>
                  <select
                    value={newHolidayJurisdiction}
                    onChange={(e) => setNewHolidayJurisdiction(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#E7E5E4] rounded-xl font-semibold text-[#18181B] outline-none focus:border-[#0F766E]"
                  >
                    <option value="federal_and_selangor">Federal &amp; Selangor</option>
                    <option value="selangor_only">Selangor Only</option>
                    <option value="federal_only">Federal Only</option>
                    <option value="special_declared">Special Ad-Hoc Declared</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isAddingHoliday}
                  className="px-4 py-1.5 bg-[#0F766E] text-white rounded-full font-extrabold shadow-xs hover:bg-[#115E59] transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingHoliday ? 'Adding...' : 'Add Holiday'}</span>
                </button>
              </form>

              {/* Holidays Table */}
              <div className="max-h-64 overflow-y-auto no-scrollbar">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white border-b border-[#EFECE6] text-[10px] font-extrabold text-[#78716C] uppercase">
                    <tr>
                      <th className="py-2.5 px-4 w-32">Date</th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4 w-40">Jurisdiction</th>
                      <th className="py-2.5 px-4 w-28 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6]">
                    {holidaysList
                      .filter((h) => h.holidayDate.startsWith(activeYear))
                      .map((h) => (
                        <tr key={h.holidayDate} className="hover:bg-[#FAF8F5]">
                          <td className="py-2 px-4 font-bold text-[#57534E]">
                            {formatDisplayDate(h.holidayDate)}
                          </td>
                          <td className="py-2 px-4 font-extrabold text-[#18181B]">{h.name}</td>
                          <td className="py-2 px-4 text-[#78716C] text-[11px]">
                            {h.jurisdiction || 'Selangor & Federal'}
                          </td>
                          <td className="py-2 px-4 text-right">
                            {confirmDeleteHolidayDate === h.holidayDate ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteCustomHoliday(h.holidayDate)}
                                  className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white cursor-pointer"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteHolidayDate(null)}
                                  className="rounded-full border border-[#E7E5E4] px-2 py-0.5 text-[10px] font-bold text-[#57534E] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteHolidayDate(h.holidayDate)}
                                title="Delete Holiday"
                                className="p-1 text-[#78716C] hover:text-rose-600 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. COMBINED COLLAPSIBLE DOCTOR-PER-ROW DEPARTMENT GHKA TRACKER & OPENING EDITOR */}
          <div className="rounded-[24px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsDeptSummaryOpen((prev) => !prev)}
              className="w-full px-4 py-3.5 border-b border-[#EFECE6] bg-[#FAF8F5] flex items-center justify-between gap-3 text-left hover:bg-[#F4F1EC]/70 transition cursor-pointer"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-xs font-extrabold text-[#18181B] uppercase tracking-[0.05em] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#0F766E]" />
                  <span>Department GHKA Tracker</span>
                </h3>
                {deptPendingMemosCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-2.5 py-0.5 text-[10px] font-extrabold text-[#C2410C]">
                    {deptPendingMemosCount} {deptPendingMemosCount === 1 ? 'Memo' : 'Memos'} Pending
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-extrabold text-[#065F46]">
                    All Submitted ✓
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#57534E]">
                {isDeptSummaryOpen ? 'Collapse' : 'Expand & Edit Balances'}
                {isDeptSummaryOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            </button>

            {isDeptSummaryOpen && (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#EFECE6] bg-[#FAF8F5] text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#78716C]">
                    <tr>
                      <th className="py-2.5 px-4">Doctor</th>
                      <th className="py-2.5 px-3">Opening ({activeYear})</th>
                      <th className="py-2.5 px-3 text-center">PH Worked</th>
                      <th className="py-2.5 px-3 text-center">GHKA Used</th>
                      <th className="py-2.5 px-3 text-center">Outstanding</th>
                      <th className="py-2.5 px-3 text-center">Excess</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6]">
                    {activeStaffList.map((doc) => {
                      const s = summaries.find((x) => x.staffId === doc.id) || {
                        openingBalance: 0,
                        phWorked: 0,
                        ghkaUsed: 0,
                        outstanding: 0,
                        excessGhkaUsed: 0,
                      };
                      const edit = editingBalances[doc.id] || {
                        balance: s.openingBalance,
                        note: '',
                      };
                      const isDirty = editingBalances[doc.id] !== undefined;

                      return (
                        <tr key={doc.id} className="hover:bg-[#FAF8F5]/80 transition">
                          <td className="py-2.5 px-4">
                            <div className="font-extrabold text-[#18181B]">
                              {getDoctorShortLabel(doc.name)}
                            </div>
                            <div className="text-[10px] font-semibold text-[#78716C]">
                              {doc.staffCode || 'MO'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                aria-label={`Opening balance for ${doc.name}`}
                                value={edit.balance}
                                onChange={(e) =>
                                  setEditingBalances((prev) => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...edit,
                                      balance: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    },
                                  }))
                                }
                                className="w-16 rounded-lg border border-[#E7E5E4] bg-[#FAF8F5] px-2 py-1 text-center text-xs font-extrabold text-[#18181B] outline-none focus:border-[#0F766E]"
                              />
                              <button
                                type="button"
                                disabled={!isDirty || upsertOpeningBalanceMutation.isPending}
                                onClick={() => void handleSaveOpeningBalance(doc.id)}
                                className="rounded-full bg-[#0F766E] px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-[#115E59] disabled:opacity-40 cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-extrabold text-[#0F766E] tabular-nums">
                            {s.phWorked}
                          </td>
                          <td className="py-2.5 px-3 text-center font-extrabold text-[#15803D] tabular-nums">
                            {s.ghkaUsed}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                                s.outstanding > 0
                                  ? 'bg-[#FEF3C7] text-[#92400E]'
                                  : 'bg-[#F5F5F4] text-[#78716C]'
                              }`}
                            >
                              {s.outstanding}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {s.excessGhkaUsed > 0 ? (
                              <span className="inline-block rounded-full bg-rose-100 px-2.5 py-0.5 text-[10.5px] font-extrabold text-rose-700 tabular-nums">
                                {s.excessGhkaUsed}
                              </span>
                            ) : (
                              <span className="text-[#A8A29E]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. ANNUAL REPLACEMENT MATRIX */}
          <div className="rounded-[24px] border border-[#E7E5E4] bg-white shadow-[0_2px_10px_rgba(28,25,23,0.03)] overflow-hidden flex flex-col">
            <div className="px-4 py-3.5 border-b border-[#EFECE6] bg-[#FAF8F5] flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-xs font-extrabold text-[#18181B] uppercase tracking-[0.05em] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0F766E]" /> Annual Replacement Matrix
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[#92400E]">
                    ● Unclaimed
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#FDBA74] bg-[#FFF7ED] px-2 py-0.5 text-[#C2410C]">
                    ● Memo ✕
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-0.5 text-[#065F46]">
                    ● Memo ✓
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-[#0F766E] bg-[#F0FDFA] border border-[#99F6E4] px-2.5 py-1 rounded-full">
                {isMemoEditMode ? 'Tap claimed cell to toggle Memo' : `Year ${activeYear}`}
              </span>
            </div>

            <div className="overflow-x-auto p-0 no-scrollbar">
              {matrixRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-[#78716C] p-8 text-center gap-2">
                  <Info className="w-7 h-7 text-[#A8A29E]" />
                  <p className="text-xs font-bold">No public holidays found for {activeYear}.</p>
                </div>
              ) : (
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[#FAF8F5]">
                      <th className="sticky left-0 z-20 bg-[#FAF8F5] py-2 px-2.5 text-[9.5px] font-extrabold text-[#78716C] uppercase tracking-wider border-b border-[#E7E5E4] border-r w-28 md:w-36 min-w-[120px] truncate">
                        Holiday
                      </th>
                      {activeStaffList.map((doc) => (
                        <th
                          key={doc.id}
                          className="py-2 px-1 text-[9.5px] font-extrabold text-[#18181B] uppercase tracking-wider border-b border-[#E7E5E4] text-center min-w-[76px] w-[76px]"
                          title={doc.name}
                        >
                          <span className="block truncate">{getDoctorShortLabel(doc.name)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE6]">
                    {matrixRows.map((row) => {
                      const d = new Date(row.date);
                      const formattedDate = Number.isNaN(d.getTime())
                        ? row.date
                        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                      return (
                        <tr key={row.date} className="hover:bg-[#FAF8F5]/60 transition">
                          <td
                            className="sticky left-0 z-10 bg-white py-1.5 px-2.5 border-r border-[#EFECE6] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] truncate min-w-[120px]"
                            title={row.name}
                          >
                            <p className="text-[10.5px] font-extrabold text-[#18181B] truncate">
                              {row.name}
                            </p>
                            <p className="text-[9.5px] text-[#78716C] font-semibold">
                              {formattedDate}
                            </p>
                          </td>
                          {activeStaffList.map((doc) => {
                            const cellData = row.doctors[doc.id];

                            if (!cellData || !cellData.classification.earnsCredit) {
                              if (
                                cellData &&
                                cellData.classification.category === 'official_ph_off'
                              ) {
                                return (
                                  <td
                                    key={doc.id}
                                    className="py-1 px-1 text-center align-middle border-b border-[#EFECE6] min-w-[76px]"
                                  >
                                    <span className="text-[9px] font-extrabold text-[#57534E] bg-[#F5F5F4] border border-[#E7E5E4] px-1.5 py-0.5 rounded-md">
                                      HKA
                                    </span>
                                  </td>
                                );
                              }
                              if (
                                cellData &&
                                (cellData.classification.category === 'mc' ||
                                  cellData.classification.normalizedShift === 'MC')
                              ) {
                                return (
                                  <td
                                    key={doc.id}
                                    className="py-1 px-1 text-center align-middle border-b border-[#EFECE6] min-w-[76px]"
                                  >
                                    <span className="text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded-md">
                                      MC
                                    </span>
                                  </td>
                                );
                              }
                              return (
                                <td
                                  key={doc.id}
                                  className="py-1.5 px-1 bg-[#FAF8F5]/40 text-center border-b border-[#EFECE6] min-w-[76px]"
                                >
                                  <span className="text-[10px] text-[#D6D3D1] font-medium">—</span>
                                </td>
                              );
                            }

                            const classification = cellData.classification;
                            const matchedRecord = cellData.matchedRecord;
                            const isUsed = matchedRecord?.status === 'USED';
                            const memoKey = `${doc.id}_${matchedRecord?.matchedGhkaDate}`;
                            const isMemoSubmitted = Boolean(memoSubmissionsMap.get(memoKey));

                            if (!isUsed || !matchedRecord?.matchedGhkaDate) {
                              return (
                                <td
                                  key={doc.id}
                                  className="py-1 px-1 text-center align-middle border-b border-[#EFECE6] min-w-[82px]"
                                >
                                  <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-1.5 py-1 text-[9px] leading-tight text-[#92400E] shadow-2xs">
                                    <div className="font-extrabold">
                                      Worked {classification.normalizedShift}
                                    </div>
                                    <div className="font-bold opacity-85">Unclaimed</div>
                                  </div>
                                </td>
                              );
                            }

                            const repDateObj = new Date(matchedRecord.matchedGhkaDate);
                            const claimedLabel = Number.isNaN(repDateObj.getTime())
                              ? matchedRecord.matchedGhkaDate
                              : repDateObj.toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                });

                            const cardTone = isMemoSubmitted
                              ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#166534]'
                              : 'border-[#FDBA74] bg-[#FFF7ED] text-[#C2410C]';

                            return (
                              <td
                                key={doc.id}
                                className={`py-1 px-1 text-center align-middle border-b border-[#EFECE6] min-w-[82px] ${
                                  isMemoEditMode ? 'cursor-pointer hover:bg-[#FAF8F5]' : ''
                                }`}
                                onClick={() => {
                                  if (isMemoEditMode && matchedRecord?.matchedGhkaDate) {
                                    void handleToggleMemoStatus(
                                      doc.id,
                                      matchedRecord.matchedGhkaDate,
                                      row.date,
                                    );
                                  }
                                }}
                              >
                                <div
                                  className={`rounded-lg border px-1.5 py-1 text-[9px] leading-tight shadow-2xs transition-colors ${cardTone} ${
                                    isMemoEditMode ? 'ring-1 ring-[#0F766E]' : ''
                                  }`}
                                >
                                  <div className="font-extrabold">
                                    Worked {classification.normalizedShift}
                                  </div>
                                  <div className="font-bold opacity-90 whitespace-nowrap">
                                    Claimed: {claimedLabel}
                                  </div>
                                  <div className="font-extrabold">
                                    Memo {isMemoSubmitted ? '✓' : '✕'}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERSONAL PH CREDIT DETAIL MODAL                                           */}
      {/* ========================================================================= */}
      <Modal
        isOpen={detailCredit !== null}
        onClose={() => setDetailCredit(null)}
        title="Public Holiday Credit Detail"
        description={
          detailCredit?.source === 'opening_balance'
            ? 'Carry-forward opening credit'
            : detailCredit?.holidayName || ''
        }
        presentation="drawer"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            {canManageGhkaMemos &&
              detailCredit?.status === 'USED' &&
              detailCredit.matchedGhkaDate && (
                <button
                  type="button"
                  onClick={() =>
                    void handleToggleMemoStatus(
                      detailCredit.staffId,
                      detailCredit.matchedGhkaDate || '',
                      detailCredit.holidayDate,
                    )
                  }
                  className="rounded-full border border-[#0F766E] bg-[#F0FDFA] px-4 py-2 text-xs font-extrabold text-[#0F766E] hover:bg-[#CCFBF1] cursor-pointer"
                >
                  {memoSubmissionsMap.get(`${detailCredit.staffId}_${detailCredit.matchedGhkaDate}`)
                    ? 'Mark Memo Pending'
                    : 'Mark Memo Submitted ✓'}
                </button>
              )}
            <button
              type="button"
              onClick={() => setDetailCredit(null)}
              className="rounded-full bg-[#18181B] px-4 py-2 text-xs font-extrabold text-white hover:bg-stone-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        {detailCredit && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#78716C]">Holiday / Source</span>
                <span className="font-extrabold text-[#18181B]">
                  {detailCredit.source === 'opening_balance'
                    ? 'Carry-forward Opening Balance'
                    : detailCredit.holidayName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#78716C]">Holiday Date</span>
                <span className="font-extrabold text-[#18181B]">
                  {detailCredit.source === 'opening_balance'
                    ? 'Carry-forward'
                    : formatDisplayDate(detailCredit.holidayDate)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#78716C]">Worked Shift</span>
                {detailCredit.workedShift ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold ${getShiftToneClasses(detailCredit.workedShift)}`}
                  >
                    {detailCredit.workedShift}
                  </span>
                ) : (
                  <span className="font-semibold text-[#78716C]">—</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#78716C]">Replacement GHKA Date</span>
                <span className="font-extrabold text-[#0F766E]">
                  {detailCredit.status === 'USED' && detailCredit.matchedGhkaDate
                    ? formatDisplayDate(detailCredit.matchedGhkaDate)
                    : 'Not yet claimed'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#78716C]">Memo Submission</span>
                {detailCredit.status === 'USED' && detailCredit.matchedGhkaDate ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold border ${
                      memoSubmissionsMap.get(
                        `${detailCredit.staffId}_${detailCredit.matchedGhkaDate}`,
                      )
                        ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
                        : 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
                    }`}
                  >
                    {memoSubmissionsMap.get(
                      `${detailCredit.staffId}_${detailCredit.matchedGhkaDate}`,
                    )
                      ? 'Memo Submitted ✓'
                      : 'Memo Pending'}
                  </span>
                ) : (
                  <span className="rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#92400E]">
                    Unclaimed Credit
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* 2-STEP EXPORT MONTHLY MEMO MODAL                                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={
          exportStep === 'select' ? 'Export Monthly GHKA Memo (.docx)' : 'GHKA Claim Memo Preview'
        }
        description={
          exportStep === 'select'
            ? 'Group claims by month and choose GHKA dates to include.'
            : 'Verify applicant details and PH/GHKA replacement dates before downloading.'
        }
        presentation="drawer"
        maxWidth="lg"
        footer={
          exportStep === 'select' ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedExportRecords.length === 0}
                onClick={() => setExportStep('preview')}
                className="rounded-full bg-[#0F766E] px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-[#115E59] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Preview &amp; Download →
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setExportStep('select')}
                className="rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-extrabold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={selectedExportRecords.length === 0 || isExporting}
                onClick={() => void handleGenerateExport()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-[#115E59] transition disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating .DOCX...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .DOCX</span>
                  </>
                )}
              </button>
            </div>
          )
        }
      >
        {exportStep === 'select' ? (
          <div className="space-y-5">
            {currentDoctorProfile && (
              <div className="rounded-2xl border border-[#99F6E4] bg-[#F0FDFA] p-4">
                <h3 className="text-[10.5px] font-extrabold text-[#0F766E] uppercase tracking-[0.06em] mb-2">
                  Applicant Information
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-[#0F766E] font-bold uppercase">Name</span>
                    <p className="font-extrabold text-[#18181B] truncate">
                      {currentDoctorProfile.fullName || currentDoctorProfile.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#0F766E] font-bold uppercase">
                      Staff / MMC ID
                    </span>
                    <p className="font-extrabold text-[#18181B]">
                      {currentDoctorProfile.staffCode ||
                        currentDoctorProfile.registrationNumber ||
                        '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#0F766E] font-bold uppercase">Phone</span>
                    <p className="font-extrabold text-[#18181B]">
                      {currentDoctorProfile.phone || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#0F766E] font-bold uppercase">Email</span>
                    <p
                      className="font-extrabold text-[#18181B] truncate"
                      title={currentDoctorProfile.email}
                    >
                      {currentDoctorProfile.email || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {exportableGroupedByMonth.length === 0 ? (
              <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-xs font-semibold text-[#92400E]">
                No claimed GHKA records available for memo generation yet.
              </div>
            ) : (
              <div className="space-y-4">
                {exportableGroupedByMonth.map(([monthKey, recs]) => {
                  const allChecked = recs.every((r) =>
                    Boolean(exportSelectedRows[`${r.staffId}_${r.matchedGhkaDate}`]),
                  );
                  return (
                    <div
                      key={monthKey}
                      className="rounded-2xl border border-[#E7E5E4] bg-white overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[#EFECE6] bg-[#FAF8F5]">
                        <span className="text-xs font-extrabold text-[#18181B]">
                          {formatMonthGroupTitle(monthKey)} ({recs.length})
                        </span>
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#0F766E] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={(e) => handleToggleMonthGroup(recs, e.target.checked)}
                            className="h-3.5 w-3.5 accent-[#0F766E]"
                          />
                          <span>Select All</span>
                        </label>
                      </div>

                      <div className="divide-y divide-[#EFECE6]">
                        {recs.map((r) => {
                          const key = `${r.staffId}_${r.matchedGhkaDate}`;
                          const isChecked = Boolean(exportSelectedRows[key]);
                          const isMemoSubmitted = Boolean(memoSubmissionsMap.get(key));
                          const isCarryForward = r.source === 'opening_balance';
                          const phDateText = isCarryForward
                            ? 'Carry-forward'
                            : formatDisplayDate(r.holidayDate);
                          const phNameText = isCarryForward
                            ? 'Opening Balance GHKA'
                            : r.holidayName;
                          const ghkaDateText = formatDisplayDate(r.matchedGhkaDate);
                          const ghkaDateObj = new Date(r.matchedGhkaDate || '');
                          const ghkaDayText = Number.isNaN(ghkaDateObj.getTime())
                            ? ''
                            : ghkaDateObj.toLocaleDateString('en-US', { weekday: 'short' });

                          return (
                            <label
                              key={key}
                              className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition ${
                                isChecked ? 'bg-[#F0FDFA]/60' : 'hover:bg-[#FAF8F5]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) =>
                                  setExportSelectedRows((prev) => ({
                                    ...prev,
                                    [key]: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 accent-[#0F766E]"
                              />
                              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                <div className="min-w-0">
                                  <p className="text-xs font-extrabold text-[#18181B]">
                                    {ghkaDateText}{' '}
                                    {ghkaDayText && (
                                      <span className="font-semibold text-[#78716C]">
                                        ({ghkaDayText})
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] font-medium text-[#78716C] truncate">
                                    Replaces: {phNameText} ({phDateText})
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 self-start sm:self-center inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold ${
                                    isMemoSubmitted
                                      ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                                      : 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
                                  }`}
                                >
                                  {isMemoSubmitted && <Check className="w-2.5 h-2.5" />}
                                  {isMemoSubmitted ? 'Memo submitted' : 'Memo pending'}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Step 2: HTML Memo Document Preview */
          <div className="rounded-2xl border border-[#D6D3D1] bg-white p-5 sm:p-6 shadow-xs space-y-4 text-xs text-[#18181B]">
            <div className="border-b-2 border-[#18181B] pb-3 text-center space-y-0.5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#0F766E]">
                Hospital Sultan Abdul Aziz Shah (HSAAS) · UPM
              </div>
              <div className="text-sm font-black uppercase tracking-tight">
                Jabatan Perubatan Kecemasan · Permohonan Cuti Gantian Hari Kelepasan Am (GHKA)
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-[#EFECE6] bg-[#FAF8F5] p-3 text-[11.5px]">
              <div>
                <span className="font-bold text-[#78716C]">Nama Pemohon: </span>
                <span className="font-extrabold">
                  {(
                    currentDoctorProfile?.fullName ||
                    currentDoctorProfile?.name ||
                    '—'
                  ).toUpperCase()}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#78716C]">Tarikh Memo: </span>
                <span className="font-extrabold">{formatSlashDate(new Date().toISOString())}</span>
              </div>
              <div>
                <span className="font-bold text-[#78716C]">No. Staf / MMC: </span>
                <span className="font-extrabold">
                  {currentDoctorProfile?.staffCode ||
                    currentDoctorProfile?.registrationNumber ||
                    '—'}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#78716C]">No. Telefon: </span>
                <span className="font-extrabold">{currentDoctorProfile?.phone || '—'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="font-bold text-[#78716C]">E-mel Rasmi: </span>
                <span className="font-extrabold">{currentDoctorProfile?.email || '—'}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E7E5E4]">
              <table className="w-full text-left text-[11.5px]">
                <thead className="border-b border-[#E7E5E4] bg-[#FAF8F5] text-[10px] font-extrabold uppercase text-[#57534E]">
                  <tr>
                    <th className="py-2 px-3">Bil.</th>
                    <th className="py-2 px-3">Tarikh Cuti Umum</th>
                    <th className="py-2 px-3">Nama Hari Kelepasan Am</th>
                    <th className="py-2 px-3">Tarikh Gantian (GHKA)</th>
                    <th className="py-2 px-3">Hari</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6]">
                  {selectedExportRecords.map((r, idx) => {
                    const isCarryForward = r.source === 'opening_balance';
                    const ghkaDateObj = new Date(r.matchedGhkaDate || '');
                    const ghkaDayText = Number.isNaN(ghkaDateObj.getTime())
                      ? '—'
                      : ghkaDateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    return (
                      <tr key={`${r.staffId}_${r.matchedGhkaDate}`}>
                        <td className="py-2 px-3 font-bold text-[#57534E]">{idx + 1}.</td>
                        <td className="py-2 px-3 font-semibold">
                          {isCarryForward ? '—' : formatSlashDate(r.holidayDate)}
                        </td>
                        <td className="py-2 px-3 font-extrabold">
                          {isCarryForward ? 'Opening Balance' : r.holidayName}
                        </td>
                        <td className="py-2 px-3 font-extrabold text-[#0F766E]">
                          {formatSlashDate(r.matchedGhkaDate)}
                        </td>
                        <td className="py-2 px-3 font-semibold text-[#57534E]">{ghkaDayText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
