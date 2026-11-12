import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
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
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuthBoundary } from '@/platform/auth';
import { generateGhkaMemoDocx } from './ghkaMemoExport';
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

export function PublicHolidayTrackerRoute() {
  const { user } = useAuthBoundary();
  const isOwner = user?.role === 'owner';
  const myStaffId = user?.staffId;

  const [activeYear, setActiveYear] = useState<string>(() => String(new Date().getFullYear()));
  const [activeView, setActiveView] = useState<'department' | 'personal'>(() =>
    isOwner ? 'department' : 'personal',
  );

  // Admin toggles
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isHolidayManagerOpen, setIsHolidayManagerOpen] = useState(false);
  const [isMemoEditMode, setIsMemoEditMode] = useState(false);

  // Opening balance inline edits
  const [editingBalances, setEditingBalances] = useState<
    Record<number, { balance: number; note: string }>
  >({});

  // New holiday form
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayJurisdiction, setNewHolidayJurisdiction] = useState('federal_and_selangor');
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
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

  // Selected Doctor for Personal View (owner can inspect any doctor, doctor inspects self)
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(myStaffId || null);
  const currentViewStaffId = isOwner && selectedStaffId ? selectedStaffId : myStaffId;

  const currentDoctorProfile = useMemo(() => {
    return staffList.find((s) => s.id === currentViewStaffId) || null;
  }, [staffList, currentViewStaffId]);

  const doctorSummary = useMemo(() => {
    if (!currentViewStaffId) {
      return {
        openingBalance: 0,
        phWorked: 0,
        ghkaUsed: 0,
        outstanding: 0,
        excessGhkaUsed: 0,
        oldOutstanding: 0,
      };
    }
    return (
      summaries.find((s) => s.staffId === currentViewStaffId) || {
        openingBalance: 0,
        phWorked: 0,
        ghkaUsed: 0,
        outstanding: 0,
        excessGhkaUsed: 0,
        oldOutstanding: 0,
      }
    );
  }, [summaries, currentViewStaffId]);

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

  // Handle opening export modal & initialize checkboxes
  const handleOpenExportModal = () => {
    let initialMonth = exportMonth;
    if (exportableRecords.length > 0) {
      const sorted = [...exportableRecords].sort((a, b) =>
        (b.matchedGhkaDate || '').localeCompare(a.matchedGhkaDate || ''),
      );
      if (sorted[0]?.matchedGhkaDate) {
        initialMonth = sorted[0].matchedGhkaDate.substring(0, 7);
        setExportMonth(initialMonth);
      }
    }
    const autoSelected: Record<string, boolean> = {};
    exportableRecords.forEach((r) => {
      if (r.matchedGhkaDate && r.matchedGhkaDate.startsWith(initialMonth)) {
        autoSelected[`${r.staffId}_${r.matchedGhkaDate}`] = true;
      }
    });
    setExportSelectedRows(autoSelected);
    setIsExportModalOpen(true);
  };

  const handleMonthChange = (newMonth: string) => {
    setExportMonth(newMonth);
    const autoSelected: Record<string, boolean> = {};
    exportableRecords.forEach((r) => {
      if (r.matchedGhkaDate && r.matchedGhkaDate.startsWith(newMonth)) {
        autoSelected[`${r.staffId}_${r.matchedGhkaDate}`] = true;
      }
    });
    setExportSelectedRows(autoSelected);
  };

  const handleGenerateExport = async () => {
    const selectedRecords = exportableRecords.filter(
      (r) => exportSelectedRows[`${r.staffId}_${r.matchedGhkaDate}`],
    );
    if (selectedRecords.length === 0 || !currentDoctorProfile) return;

    setIsExporting(true);
    try {
      await generateGhkaMemoDocx({
        memoMonth: exportMonth,
        applicantName: currentDoctorProfile.fullName || currentDoctorProfile.name,
        applicantStaffId:
          currentDoctorProfile.staffCode || currentDoctorProfile.registrationNumber || '',
        applicantPhone: currentDoctorProfile.phone || '',
        applicantEmail: currentDoctorProfile.email || '',
        memoDate: new Date().toISOString(),
        rows: selectedRecords.map((r) => {
          const isCarryForward = r.source === 'opening_balance';
          const ghkaDateObj = new Date(r.matchedGhkaDate || '');
          return {
            phDate: isCarryForward ? '' : r.holidayDate || '',
            phName: isCarryForward ? 'Opening Balance' : r.holidayName,
            ghkaDate: r.matchedGhkaDate || '',
            ghkaDay: isNaN(ghkaDateObj.getTime())
              ? ''
              : ghkaDateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          };
        }),
      });
      setIsExportModalOpen(false);
    } catch (error) {
      alert(
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
    const key = `${staffId}_${replacementDate}`;
    const currentStatus = Boolean(memoSubmissionsMap.get(key));
    await toggleMemoStatusMutation.mutateAsync({
      staffId,
      replacementDate,
      holidayDate,
      isSubmitted: !currentStatus,
    });
  };

  const handleSaveOpeningBalance = async (staffId: number) => {
    const edit = editingBalances[staffId];
    if (!edit) return;
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
    } catch (error) {
      alert(`Failed to add holiday: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAddingHoliday(false);
    }
  };

  const handleDeleteCustomHoliday = async (date: string) => {
    if (!confirm(`Are you sure you want to delete the public holiday on ${date}?`)) return;
    try {
      await deleteHolidayMutation.mutateAsync(date);
    } catch (error) {
      alert(`Failed to delete holiday: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">Loading Public Holiday & GHKA Tracker...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto px-4 py-8 md:px-8 max-w-7xl animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-indigo-600" />
            <span className="bg-gradient-to-r from-slate-900 to-indigo-900 bg-clip-text text-transparent">
              {isOwner && activeView === 'department'
                ? 'Public Holiday Tracker'
                : 'My Public Holiday Tracker'}
            </span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1.5">
            {isOwner && activeView === 'department'
              ? 'Read-only tracker for Public Holiday duties and GHKA replacements across the department.'
              : 'This tracker calculates earned replacement leave (GHKA) based on finalized rosters.'}
          </p>
        </div>

        {/* View Switcher & Year Selector */}
        <div className="flex flex-wrap items-center gap-3">
          {isOwner && (
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button
                onClick={() => setActiveView('department')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeView === 'department'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Department
              </button>
              <button
                onClick={() => setActiveView('personal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeView === 'personal'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Doctor View / Memo
              </button>
            </div>
          )}

          <select
            value={activeYear}
            onChange={(e) => setActiveYear(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm outline-none focus:border-indigo-500"
          >
            <option value="2025">2025 Calendar</option>
            <option value="2026">2026 Calendar</option>
            <option value="2027">2027 Calendar</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PERSONAL DOCTOR VIEW ("My Public Holiday Tracker")               */}
      {/* ========================================================================= */}
      {(!isOwner || activeView === 'personal') && (
        <div className="space-y-8 animate-fadeIn">
          {/* Doctor Selector (Surfaced when Owner is testing or generating memo for any doctor) */}
          {isOwner && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Inspecting Doctor:
                </span>
              </div>
              <select
                value={currentViewStaffId || ''}
                onChange={(e) => setSelectedStaffId(Number(e.target.value) || null)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
              >
                {activeStaffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.staffCode || 'MO'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Opening Balance
              </p>
              <p className="text-2xl font-black text-indigo-400 mt-2">
                {doctorSummary.openingBalance}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                PH Worked
              </p>
              <p className="text-2xl font-black text-indigo-600 mt-2">{doctorSummary.phWorked}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                GHKA Used
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-2">{doctorSummary.ghkaUsed}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                GHKA AVAILABLE
              </p>
              <p className="text-2xl font-black text-amber-500 mt-2">
                {doctorSummary.outstanding}
              </p>
            </div>
            {doctorSummary.excessGhkaUsed > 0 && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                  Excess GHKA
                </p>
                <p className="text-2xl font-black text-rose-600 mt-2">
                  {doctorSummary.excessGhkaUsed}
                </p>
              </div>
            )}
          </div>

          {/* User Warnings */}
          {doctorWarnings.length > 0 && (
            <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Personal Warnings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doctorWarnings.map((w, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-rose-100 p-3 shadow-sm flex items-start gap-3"
                  >
                    <div
                      className={`mt-0.5 rounded-full p-1 ${
                        w.severity === 'high'
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">{w.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {doctorCredits.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center gap-3 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <Info className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-bold">
                No public holiday credit records found for this doctor's roster yet.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" /> Public Holiday Credits &
                  Replacements
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 sm:hidden">
                    <span className="text-[10px] text-slate-500">
                      Swipe sideways to view replacement details.
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-1">
                      ← swipe →
                    </span>
                  </div>
                  <button
                    onClick={handleOpenExportModal}
                    disabled={exportableRecords.length === 0}
                    className="text-[11px] font-bold px-3 py-1.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Export Monthly Memo
                  </button>
                </div>
              </div>

              <div className="p-0 overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs whitespace-nowrap min-w-[600px]">
                  <thead className="bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <tr className="border-b border-slate-100">
                      <th
                        colSpan={2}
                        className="py-2 px-4 font-bold text-center border-r border-slate-100 bg-indigo-50/30 text-indigo-800 uppercase tracking-wider"
                      >
                        Public Holiday
                      </th>
                      <th
                        colSpan={3}
                        className="py-2 px-4 font-bold text-center bg-emerald-50/30 text-emerald-800 uppercase tracking-wider"
                      >
                        Replacement Day
                      </th>
                    </tr>
                    <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50">
                      <th className="py-2 px-4 font-bold border-r border-slate-100 w-[15%]">
                        Date
                      </th>
                      <th className="py-2 px-4 font-bold border-r border-slate-100 w-[30%]">
                        PH Name
                      </th>
                      <th className="py-2 px-4 font-bold border-r border-slate-100 w-[15%]">
                        Date
                      </th>
                      <th className="py-2 px-4 font-bold border-r border-slate-100 w-[15%]">Day</th>
                      <th className="py-2 px-4 font-bold w-[25%]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {doctorCredits.map((c, idx) => {
                      const isUsed = c.status === 'USED';
                      const isCarryForward = c.source === 'opening_balance';
                      const memoKey = `${c.staffId}_${c.matchedGhkaDate}`;
                      const isMemoSubmitted = Boolean(memoSubmissionsMap.get(memoKey));

                      const phDateText = isCarryForward
                        ? '—'
                        : c.holidayDate
                          ? new Date(c.holidayDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '—';
                      const phNameText = isCarryForward
                        ? 'Carry-forward GHKA credit'
                        : c.holidayName;

                      let repDateText = '-';
                      let repDayText = '-';

                      if (isUsed && c.matchedGhkaDate) {
                        const d = new Date(c.matchedGhkaDate);
                        repDateText = isNaN(d.getTime())
                          ? c.matchedGhkaDate
                          : d.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            });
                        repDayText = isNaN(d.getTime())
                          ? '-'
                          : d.toLocaleDateString('en-US', { weekday: 'long' });
                      }

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-medium text-slate-600 border-r border-slate-100">
                            {phDateText}
                          </td>
                          <td
                            className="py-3 px-4 font-bold text-slate-700 border-r border-slate-100 truncate max-w-[200px]"
                            title={phNameText}
                          >
                            {phNameText}
                            {c.workedShift && !isCarryForward && (
                              <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {c.workedShift}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600 border-r border-slate-100">
                            {repDateText}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-600 border-r border-slate-100">
                            {repDayText}
                          </td>
                          <td className="py-3 px-4">
                            {isUsed && c.matchedGhkaDate ? (
                              <button
                                onClick={() =>
                                  handleToggleMemoStatus(
                                    c.staffId,
                                    c.matchedGhkaDate || '',
                                    c.holidayDate,
                                  )
                                }
                                title="Click to toggle submission status"
                                className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold border transition ${
                                  isMemoSubmitted
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                                    : 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200'
                                }`}
                              >
                                {isMemoSubmitted
                                  ? 'Used (Memo submitted)'
                                  : 'Used (Memo not marked)'}
                              </button>
                            ) : (
                              <span className="text-slate-400 font-bold px-2 py-1">-</span>
                            )}
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
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEPARTMENT OVERVIEW & ANNUAL MATRIX (OWNER)                       */}
      {/* ========================================================================= */}
      {isOwner && activeView === 'department' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Department Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Opening Balance
              </p>
              <p className="text-2xl font-black text-indigo-400 mt-2">
                {totals.totalOpeningBalance}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                PH Worked This Year
              </p>
              <p className="text-2xl font-black text-indigo-600 mt-2">{totals.totalWorked}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                GHKA Used This Year
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-2">{totals.totalUsed}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Closing Outstanding
              </p>
              <p className="text-2xl font-black text-amber-500 mt-2">{totals.totalOutstanding}</p>
            </div>
          </div>

          {/* Department Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Tracker Warnings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-rose-100 p-3 shadow-sm flex items-start gap-3"
                  >
                    <div
                      className={`mt-0.5 rounded-full p-1 ${
                        w.severity === 'high'
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{w.staffName}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">{w.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Management Action Bars */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => setIsHolidayManagerOpen(!isHolidayManagerOpen)}
              className="text-xs font-bold px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl shadow-sm hover:bg-indigo-100 transition flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              {isHolidayManagerOpen ? 'Close Holiday Calendar' : 'Manage Public Holidays'}
              {isHolidayManagerOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => setIsEditorOpen(!isEditorOpen)}
              className="text-xs font-bold px-4 py-2 bg-slate-800 text-white rounded-xl shadow-sm hover:bg-slate-700 transition flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditorOpen ? 'Close Opening Balances Editor' : 'Edit Opening Balances'}
              {isEditorOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* 1. PUBLIC HOLIDAYS CALENDAR MANAGER */}
          {isHolidayManagerOpen && (
            <div className="rounded-3xl border border-indigo-100 bg-white shadow-sm overflow-hidden animate-fadeIn">
              <div className="p-5 border-b border-indigo-50 bg-indigo-50/50">
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" /> Gazetted & Custom Public
                  Holidays ({activeYear})
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Add official ad-hoc or hospital replacement public holidays. Shifts worked on
                  these dates will accrue GHKA credits.
                </p>
              </div>

              {/* Add Holiday Form */}
              <form
                onSubmit={handleAddCustomHoliday}
                className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-end gap-3 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Holiday Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Holiday Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Special Declared Holiday"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Jurisdiction
                  </label>
                  <select
                    value={newHolidayJurisdiction}
                    onChange={(e) => setNewHolidayJurisdiction(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="federal_and_selangor">Federal & Selangor</option>
                    <option value="selangor_only">Selangor Only</option>
                    <option value="federal_only">Federal Only</option>
                    <option value="special_declared">Special Ad-Hoc Declared</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isAddingHoliday}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold shadow-sm hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingHoliday ? 'Adding...' : 'Add Holiday'}
                </button>
              </form>

              {/* Holidays Table */}
              <div className="max-h-64 overflow-y-auto no-scrollbar">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-4 w-32">Date</th>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4 w-40">Jurisdiction</th>
                      <th className="py-2.5 px-4 w-20 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {holidaysList
                      .filter((h) => h.holidayDate.startsWith(activeYear))
                      .map((h) => (
                        <tr key={h.holidayDate} className="hover:bg-slate-50">
                          <td className="py-2 px-4 font-bold text-slate-700">
                            {new Date(h.holidayDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-2 px-4 font-semibold text-slate-800">{h.name}</td>
                          <td className="py-2 px-4 text-slate-500 text-[11px]">
                            {h.jurisdiction || 'Selangor & Federal'}
                          </td>
                          <td className="py-2 px-4 text-right">
                            <button
                              onClick={() => handleDeleteCustomHoliday(h.holidayDate)}
                              title="Delete Holiday"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. OPENING BALANCES EDITOR */}
          {isEditorOpen && (
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fadeIn">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-600" /> Opening Balances Editor
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Set carry-forward GHKA credits from previous years. Changes save automatically.
                </p>
              </div>
              <div className="p-0 overflow-x-auto max-h-[400px] overflow-y-auto no-scrollbar border-b border-slate-100">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white shadow-sm">
                    <tr className="text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5 font-bold">Doctor Name</th>
                      <th className="py-3 px-5 font-bold">Opening Balance</th>
                      <th className="py-3 px-5 font-bold w-1/2">Note / Year</th>
                      <th className="py-3 px-5 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activeStaffList.map((doc) => {
                      const summary = summaries.find((s) => s.staffId === doc.id);
                      const edit = editingBalances[doc.id] || {
                        balance: summary?.openingBalance || 0,
                        note: '',
                      };
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-5 font-bold text-slate-700">
                            {doc.name}
                            <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                              ({doc.staffCode || 'MO'})
                            </span>
                          </td>
                          <td className="py-2.5 px-5">
                            <input
                              type="number"
                              min="0"
                              value={edit.balance}
                              onChange={(e) =>
                                setEditingBalances((prev) => ({
                                  ...prev,
                                  [doc.id]: {
                                    ...edit,
                                    balance: parseInt(e.target.value, 10) || 0,
                                  },
                                }))
                              }
                              className="w-20 px-2 py-1 text-center bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-bold"
                            />
                          </td>
                          <td className="py-2.5 px-5">
                            <input
                              type="text"
                              placeholder="e.g. Carry forward from 2025"
                              value={edit.note}
                              onChange={(e) =>
                                setEditingBalances((prev) => ({
                                  ...prev,
                                  [doc.id]: {
                                    ...edit,
                                    note: e.target.value,
                                  },
                                }))
                              }
                              className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition placeholder:text-slate-300"
                            />
                          </td>
                          <td className="py-2.5 px-5 text-right">
                            <button
                              onClick={() => handleSaveOpeningBalance(doc.id)}
                              disabled={upsertOpeningBalanceMutation.isPending}
                              className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-sm hover:bg-indigo-700 transition"
                            >
                              Save
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

          {/* 3. HORIZONTAL DOCTOR SUMMARY TABLE (METRICS ON LEFT, DOCTORS ON TOP) */}
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Doctor Summary
              </h3>
            </div>
            <div className="overflow-x-auto p-0 no-scrollbar border-b border-slate-100">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-white shadow-sm">
                  <tr className="text-slate-400 uppercase tracking-wider">
                    <th className="py-2 px-3 font-bold w-28 min-w-[110px] sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10 border-b border-slate-100">
                      Metric
                    </th>
                    {activeStaffList.map((doc) => (
                      <th
                        key={doc.id}
                        className="py-2 px-1 font-bold text-center border-b border-slate-100 min-w-[76px] w-[76px] text-slate-700"
                        title={doc.name}
                      >
                        <span className="block truncate">{getDoctorShortLabel(doc.name)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-mono">
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-1.5 px-3 font-bold font-sans text-slate-500 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[110px]">
                      Opening
                    </td>
                    {activeStaffList.map((doc) => {
                      const s = summaries.find((x) => x.staffId === doc.id) || {
                        openingBalance: 0,
                      };
                      return (
                        <td
                          key={doc.id}
                          className="py-1.5 px-1 text-center font-semibold text-slate-500 min-w-[76px] tabular-nums"
                        >
                          {s.openingBalance}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-1.5 px-3 font-bold font-sans text-slate-500 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[110px]">
                      PH Worked
                    </td>
                    {activeStaffList.map((doc) => {
                      const s = summaries.find((x) => x.staffId === doc.id) || { phWorked: 0 };
                      return (
                        <td
                          key={doc.id}
                          className="py-1.5 px-1 text-center font-semibold text-indigo-600 min-w-[76px] tabular-nums"
                        >
                          {s.phWorked}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-1.5 px-3 font-bold font-sans text-slate-500 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[110px]">
                      GHKA Used
                    </td>
                    {activeStaffList.map((doc) => {
                      const s = summaries.find((x) => x.staffId === doc.id) || { ghkaUsed: 0 };
                      return (
                        <td
                          key={doc.id}
                          className="py-1.5 px-1 text-center font-semibold text-emerald-600 min-w-[76px] tabular-nums"
                        >
                          {s.ghkaUsed}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-1.5 px-3 font-bold font-sans text-slate-500 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[110px]">
                      Outstanding
                    </td>
                    {activeStaffList.map((doc) => {
                      const s = summaries.find((x) => x.staffId === doc.id) || { outstanding: 0 };
                      return (
                        <td key={doc.id} className="py-1.5 px-1 text-center min-w-[76px]">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-md font-bold tabular-nums ${
                              s.outstanding > 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {s.outstanding}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-1.5 px-3 font-bold font-sans text-slate-500 sticky left-0 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] min-w-[110px]">
                      Excess
                    </td>
                    {activeStaffList.map((doc) => {
                      const s = summaries.find((x) => x.staffId === doc.id) || {
                        excessGhkaUsed: 0,
                      };
                      return (
                        <td key={doc.id} className="py-1.5 px-1 text-center min-w-[76px]">
                          {s.excessGhkaUsed > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded-md font-bold bg-rose-100 text-rose-700 tabular-nums">
                              {s.excessGhkaUsed}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-medium">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. ANNUAL REPLACEMENT MATRIX WITH "EDIT MEMOS" MODE */}
          <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0 flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" /> Annual Replacement Matrix
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMemoEditMode(!isMemoEditMode)}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition border ${
                    isMemoEditMode
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {isMemoEditMode ? 'Done Editing Memos' : 'Edit Memos'}
                </button>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-lg">
                  Year {activeYear}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto p-0 no-scrollbar">
              {matrixRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center gap-3">
                  <Info className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-bold">No public holidays found for {activeYear}.</p>
                </div>
              ) : (
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="sticky left-0 z-20 bg-slate-50/90 backdrop-blur-md py-2 px-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 border-r w-28 md:w-36 min-w-[120px] truncate">
                        Holiday
                      </th>
                      {activeStaffList.map((doc) => (
                        <th
                          key={doc.id}
                          className="py-2 px-1 text-[9px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 text-center min-w-[76px] w-[76px]"
                          title={doc.name}
                        >
                          <span className="block truncate">{getDoctorShortLabel(doc.name)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matrixRows.map((row) => {
                      const d = new Date(row.date);
                      const formattedDate = isNaN(d.getTime())
                        ? row.date
                        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                      return (
                        <tr key={row.date} className="hover:bg-slate-50/50 transition">
                          <td
                            className="sticky left-0 z-10 bg-white py-1.5 px-2 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] truncate min-w-[120px]"
                            title={row.name}
                          >
                            <p className="text-[10px] font-bold text-slate-800 truncate">
                              {row.name}
                            </p>
                            <p className="text-[9px] text-slate-500 font-semibold">{formattedDate}</p>
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
                                    className="py-1 px-1 text-center align-middle border-b border-slate-100 min-w-[76px]"
                                  >
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
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
                                    className="py-1 px-1 text-center align-middle border-b border-slate-100 min-w-[76px]"
                                  >
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                      MC
                                    </span>
                                  </td>
                                );
                              }
                              return (
                                <td
                                  key={doc.id}
                                  className="py-1.5 px-1 bg-slate-50/30 text-center border-b border-slate-100 min-w-[76px]"
                                >
                                  <span className="text-[10px] text-slate-300 font-medium">—</span>
                                </td>
                              );
                            }

                            const classification = cellData.classification;
                            const matchedRecord = cellData.matchedRecord;
                            const isUsed = matchedRecord?.status === 'USED';
                            const memoKey = `${doc.id}_${matchedRecord?.matchedGhkaDate}`;
                            const isMemoSubmitted = Boolean(memoSubmissionsMap.get(memoKey));

                            let badgeBg = 'bg-amber-100 text-amber-800 border-amber-200'; // Default pending (yellow)
                            let statusIcon = <Clock className="w-2.5 h-2.5" />;
                            let statusText = 'Pend';

                            if (isUsed && matchedRecord?.matchedGhkaDate) {
                              if (isMemoSubmitted) {
                                badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                                statusIcon = <Check className="w-2.5 h-2.5" />;
                              } else {
                                badgeBg = 'bg-rose-100 text-rose-800 border-rose-200';
                                statusIcon = <AlertTriangle className="w-2.5 h-2.5" />;
                              }
                              const repDateObj = new Date(matchedRecord.matchedGhkaDate);
                              statusText = isNaN(repDateObj.getTime())
                                ? matchedRecord.matchedGhkaDate
                                : repDateObj.toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                  });
                            }

                            return (
                              <td
                                key={doc.id}
                                className={`py-1 px-1 text-center align-top border-b border-slate-100 min-w-[76px] ${
                                  isUsed && isMemoEditMode
                                    ? 'cursor-pointer hover:bg-slate-100/50'
                                    : ''
                                }`}
                                onClick={() => {
                                  if (isUsed && isMemoEditMode && matchedRecord?.matchedGhkaDate) {
                                    void handleToggleMemoStatus(
                                      doc.id,
                                      matchedRecord.matchedGhkaDate,
                                      row.date,
                                    );
                                  }
                                }}
                              >
                                <div
                                  className={`flex flex-col items-center justify-center py-1 px-0.5 rounded-lg border ${badgeBg} mx-0.5 transition-colors`}
                                >
                                  <span className="text-[10px] font-black leading-tight">
                                    {classification.normalizedShift}
                                  </span>
                                  <div className="flex items-center gap-0.5 opacity-80 leading-tight">
                                    <span className="flex items-center justify-center">
                                      {statusIcon}
                                    </span>
                                    <span className="text-[8px] font-bold whitespace-nowrap">
                                      {statusText}
                                    </span>
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
      {/* EXPORT MONTHLY MEMO MODAL (IDENTICAL TO LIVE APP)                        */}
      {/* ========================================================================= */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Export Monthly GHKA Memo (.docx)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select records to include in your monthly replacement leave claim memo.
                </p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Applicant Details */}
              {currentDoctorProfile && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">
                    Applicant Information
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase">Name</span>
                      <p className="font-bold text-indigo-950 truncate">
                        {currentDoctorProfile.fullName || currentDoctorProfile.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase">
                        Staff / MMC ID
                      </span>
                      <p className="font-bold text-indigo-950">
                        {currentDoctorProfile.staffCode ||
                          currentDoctorProfile.registrationNumber ||
                          '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase">Phone</span>
                      <p className="font-bold text-indigo-950">
                        {currentDoctorProfile.phone || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase">Email</span>
                      <p
                        className="font-bold text-indigo-950 truncate"
                        title={currentDoctorProfile.email}
                      >
                        {currentDoctorProfile.email || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Month Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Claim Month
                </label>
                <input
                  type="month"
                  value={exportMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition"
                />
              </div>

              {/* Records for Selected Month */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                  Records for {exportMonth || 'Selected Month'}
                </h3>
                {exportableRecords.filter(
                  (r) => r.matchedGhkaDate && r.matchedGhkaDate.startsWith(exportMonth),
                ).length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-xs">
                    No GHKA replacement records found for this month. You may select another month
                    or manually include other used records below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {exportableRecords
                      .filter((r) => r.matchedGhkaDate && r.matchedGhkaDate.startsWith(exportMonth))
                      .map((r) => {
                        const key = `${r.staffId}_${r.matchedGhkaDate}`;
                        const isChecked = Boolean(exportSelectedRows[key]);
                        const isMemoSubmitted = Boolean(memoSubmissionsMap.get(key));
                        const isCarryForward = r.source === 'opening_balance';
                        const phDateText = isCarryForward
                          ? 'Carry-forward'
                          : r.holidayDate
                            ? new Date(r.holidayDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—';
                        const phNameText = isCarryForward
                          ? 'Opening Balance GHKA'
                          : r.holidayName;
                        const ghkaDateObj = new Date(r.matchedGhkaDate || '');
                        const ghkaDateText = isNaN(ghkaDateObj.getTime())
                          ? r.matchedGhkaDate
                          : ghkaDateObj.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            });
                        const ghkaDayText = isNaN(ghkaDateObj.getTime())
                          ? ''
                          : ghkaDateObj.toLocaleDateString('en-US', { weekday: 'short' });

                        return (
                          <label
                            key={key}
                            className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                              isChecked
                                ? 'bg-indigo-50/70 border-indigo-300'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
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
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {ghkaDateText}{' '}
                                  <span className="text-slate-500 font-normal">
                                    ({ghkaDayText})
                                  </span>
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  Replaces: {phNameText} ({phDateText})
                                </p>
                              </div>
                              <div>
                                {isMemoSubmitted ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Memo submitted
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    Memo not marked
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Other Records */}
              {exportableRecords.filter(
                (r) => !(r.matchedGhkaDate && r.matchedGhkaDate.startsWith(exportMonth)),
              ).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                    Other Used GHKA Records
                  </h3>
                  <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                    {exportableRecords
                      .filter(
                        (r) => !(r.matchedGhkaDate && r.matchedGhkaDate.startsWith(exportMonth)),
                      )
                      .map((r) => {
                        const key = `${r.staffId}_${r.matchedGhkaDate}`;
                        const isChecked = Boolean(exportSelectedRows[key]);
                        const isMemoSubmitted = Boolean(memoSubmissionsMap.get(key));
                        const isCarryForward = r.source === 'opening_balance';
                        const phDateText = isCarryForward
                          ? 'Carry-forward'
                          : r.holidayDate
                            ? new Date(r.holidayDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—';
                        const phNameText = isCarryForward
                          ? 'Opening Balance GHKA'
                          : r.holidayName;
                        const ghkaDateObj = new Date(r.matchedGhkaDate || '');
                        const ghkaDateText = isNaN(ghkaDateObj.getTime())
                          ? r.matchedGhkaDate
                          : ghkaDateObj.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            });
                        const ghkaDayText = isNaN(ghkaDateObj.getTime())
                          ? ''
                          : ghkaDateObj.toLocaleDateString('en-US', { weekday: 'short' });

                        return (
                          <label
                            key={key}
                            className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                              isChecked
                                ? 'bg-indigo-50/70 border-indigo-300'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
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
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {ghkaDateText}{' '}
                                  <span className="text-slate-500 font-normal">
                                    ({ghkaDayText})
                                  </span>
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  Replaces: {phNameText} ({phDateText})
                                </p>
                              </div>
                              <div>
                                {isMemoSubmitted ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Memo submitted
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    Memo not marked
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateExport}
                disabled={
                  Object.values(exportSelectedRows).filter(Boolean).length === 0 || isExporting
                }
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating Word Document...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Generate Memo DOCX
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
