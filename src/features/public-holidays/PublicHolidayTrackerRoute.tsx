import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit3,
  FileText,
  Info,
  Loader2,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuthBoundary } from '@/platform/auth';
import { generateGhkaMemoDocx } from './ghkaMemoExport';
import { usePublicHolidayTracker } from './usePublicHolidayTracker';

export function PublicHolidayTrackerRoute() {
  const { user } = useAuthBoundary();
  const isOwner = user?.role === 'owner';
  const myStaffId = user?.staffId;

  const [activeYear, setActiveYear] = useState<string>(() => String(new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState<'personal' | 'department'>(() =>
    isOwner ? 'department' : 'personal',
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingBalances, setEditingBalances] = useState<
    Record<number, { balance: number; note: string }>
  >({});

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
    upsertOpeningBalanceMutation,
    toggleMemoStatusMutation,
  } = tracker;

  // Selected Doctor for Personal View (owner can inspect any doctor, doctor inspects self)
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(myStaffId || null);
  const currentViewStaffId = isOwner && selectedStaffId ? selectedStaffId : myStaffId;

  const myProfile = useMemo(() => {
    return staffList.find((s) => s.id === currentViewStaffId) || null;
  }, [staffList, currentViewStaffId]);

  const mySummary = useMemo(() => {
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

  const myCredits = useMemo(() => {
    if (!currentViewStaffId) return [];
    return matched.filter((m) => m.staffId === currentViewStaffId);
  }, [matched, currentViewStaffId]);

  const myWarnings = useMemo(() => {
    if (!currentViewStaffId) return [];
    return warnings.filter((w) => w.staffId === currentViewStaffId);
  }, [warnings, currentViewStaffId]);

  const exportableRecords = useMemo(() => {
    return myCredits.filter((c) => c.status === 'USED' && c.matchedGhkaDate);
  }, [myCredits]);

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
    if (selectedRecords.length === 0 || !myProfile) return;

    setIsExporting(true);
    try {
      await generateGhkaMemoDocx({
        memoMonth: exportMonth,
        applicantName: myProfile.fullName || myProfile.name,
        applicantStaffId: myProfile.staffCode || myProfile.registrationNumber || '',
        applicantPhone: myProfile.phone || '',
        applicantEmail: myProfile.email || '',
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
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Sparkles className="w-6 h-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-slate-900 to-indigo-900 bg-clip-text text-transparent">
              Public Holiday & GHKA Tracker
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1.5">
            Automatic accrual of replacement leave (GHKA) earned on Malaysian Public Holidays and
            official Word memo generator.
          </p>
        </div>

        {/* View Switcher & Year Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('personal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'personal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              My Tracker
            </button>
            {isOwner && (
              <button
                onClick={() => setActiveTab('department')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'department'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Department
              </button>
            )}
          </div>

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

      {/* TAB 1: PERSONAL TRACKER */}
      {activeTab === 'personal' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Doctor Selector for Owner */}
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

          {/* Personal KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Opening Balance
              </p>
              <p className="text-2xl font-black text-indigo-500 mt-2">{mySummary.openingBalance}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                PH Worked ({activeYear})
              </p>
              <p className="text-2xl font-black text-indigo-700 mt-2">{mySummary.phWorked}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                GHKA Used ({activeYear})
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-2">{mySummary.ghkaUsed}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Available GHKA
              </p>
              <p className="text-2xl font-black text-amber-500 mt-2">{mySummary.outstanding}</p>
            </div>
            {mySummary.excessGhkaUsed > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                  Excess GHKA Taken
                </p>
                <p className="text-2xl font-black text-rose-600 mt-2">{mySummary.excessGhkaUsed}</p>
              </div>
            )}
          </div>

          {/* Personal Warnings */}
          {myWarnings.length > 0 && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Action Required / Warnings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myWarnings.map((w, idx) => (
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
                    <p className="text-xs font-semibold text-slate-700">{w.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credits & Replacements Table */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Public Holiday Credits & Replacement Matching
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Chronological FIFO matching between duties worked and replacement leave taken.
                </p>
              </div>
              <button
                onClick={handleOpenExportModal}
                disabled={exportableRecords.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 transition flex items-center gap-2 self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-3.5 h-3.5" />
                Export Monthly Memo (.docx)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th
                      colSpan={2}
                      className="py-2.5 px-4 text-center border-r border-slate-200 bg-indigo-50/40 text-indigo-900"
                    >
                      Earned Public Holiday Duty
                    </th>
                    <th
                      colSpan={3}
                      className="py-2.5 px-4 text-center bg-emerald-50/40 text-emerald-900"
                    >
                      Replacement Day Taken (GHKA)
                    </th>
                  </tr>
                  <tr className="border-t border-slate-100 text-[10px]">
                    <th className="py-2.5 px-4 border-r border-slate-200 w-[18%]">Duty Date</th>
                    <th className="py-2.5 px-4 border-r border-slate-200 w-[32%]">Holiday Name</th>
                    <th className="py-2.5 px-4 border-r border-slate-200 w-[18%]">Taken Date</th>
                    <th className="py-2.5 px-4 border-r border-slate-200 w-[14%]">Day of Week</th>
                    <th className="py-2.5 px-4 w-[18%]">Memo Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myCredits.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        <Info className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                        No public holiday credit records found for this doctor yet.
                      </td>
                    </tr>
                  ) : (
                    myCredits.map((c, idx) => {
                      const isUsed = c.status === 'USED';
                      const isCarryForward = c.source === 'opening_balance';
                      const repKey = `${c.staffId}_${c.matchedGhkaDate}`;
                      const isMemoSubmitted = Boolean(memoSubmissionsMap.get(repKey));

                      const phDateText = isCarryForward
                        ? 'Carry-forward'
                        : c.holidayDate
                          ? new Date(c.holidayDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—';

                      let repDateText = '—';
                      let repDayText = '—';

                      if (isUsed && c.matchedGhkaDate) {
                        const d = new Date(c.matchedGhkaDate);
                        repDateText = isNaN(d.getTime())
                          ? c.matchedGhkaDate
                          : d.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            });
                        repDayText = isNaN(d.getTime())
                          ? ''
                          : d.toLocaleDateString('en-US', { weekday: 'long' });
                      }

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-semibold text-slate-700 border-r border-slate-100">
                            {phDateText}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800 border-r border-slate-100 truncate max-w-xs">
                            {c.holidayName}
                            {c.workedShift && c.source !== 'opening_balance' && (
                              <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {c.workedShift}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 border-r border-slate-100">
                            {repDateText}
                          </td>
                          <td className="py-3 px-4 text-slate-600 border-r border-slate-100">
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
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 ${
                                  isMemoSubmitted
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                }`}
                              >
                                {isMemoSubmitted ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Memo submitted
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3 text-rose-600" />
                                    Memo not marked
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Available (Pending replacement)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENT OVERVIEW & MATRIX (OWNER) */}
      {activeTab === 'department' && isOwner && (
        <div className="space-y-8 animate-fadeIn">
          {/* Department Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Opening Balances
              </p>
              <p className="text-2xl font-black text-indigo-500 mt-2">
                {totals.totalOpeningBalance}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                PH Worked This Year
              </p>
              <p className="text-2xl font-black text-indigo-700 mt-2">{totals.totalWorked}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                GHKA Used This Year
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-2">{totals.totalUsed}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Closing Available GHKA
              </p>
              <p className="text-2xl font-black text-amber-500 mt-2">{totals.totalOutstanding}</p>
            </div>
          </div>

          {/* Department Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Department GHKA Discrepancy
                Warnings
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

          {/* Opening Balances Editor Toggle */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsEditorOpen(!isEditorOpen)}
              className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-700 transition flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditorOpen ? 'Close Opening Balances Editor' : 'Edit Opening Balances'}
              {isEditorOpen ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {isEditorOpen && (
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fadeIn">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-600" /> Opening Balances Carry-Forward
                  Editor
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Set carry-forward GHKA credits from previous hospital rosters ({activeYear}).
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold text-[10px] uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 w-1/3">Doctor Name</th>
                      <th className="py-2.5 px-4 w-1/4">Opening Balance</th>
                      <th className="py-2.5 px-4">Carry-forward Note / Justification</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeStaffList.map((doc) => {
                      const summary = summaries.find((s) => s.staffId === doc.id);
                      const edit = editingBalances[doc.id] || {
                        balance: summary?.openingBalance || 0,
                        note: '',
                      };
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-bold text-slate-700">
                            {doc.name}
                            <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                              ({doc.staffCode || 'MO'})
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <input
                              type="number"
                              min={0}
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
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-4">
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
                              className="w-full px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:bg-white focus:border-indigo-500"
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => handleSaveOpeningBalance(doc.id)}
                              disabled={upsertOpeningBalanceMutation.isPending}
                              className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition"
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

          {/* Doctor Summary Table */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Doctor Summary Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Doctor</th>
                    <th className="py-2.5 px-4 text-center">Opening</th>
                    <th className="py-2.5 px-4 text-center">PH Worked</th>
                    <th className="py-2.5 px-4 text-center">GHKA Used</th>
                    <th className="py-2.5 px-4 text-center">Available</th>
                    <th className="py-2.5 px-4 text-center">Excess</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaries.map((s) => (
                    <tr key={s.staffId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-700">{s.staffName}</td>
                      <td className="py-2.5 px-4 text-center font-medium text-slate-500">
                        {s.openingBalance}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-indigo-600">
                        {s.phWorked}
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-emerald-600">
                        {s.ghkaUsed}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            s.outstanding > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {s.outstanding}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {s.excessGhkaUsed > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[11px] bg-rose-100 text-rose-800">
                            {s.excessGhkaUsed}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Public Holiday Matrix */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" /> Public Holiday Duty Matrix (
                  {activeYear})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Rostered duties and replacements for each Malaysian Gazetted Public Holiday.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 w-28 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                      Date
                    </th>
                    <th className="py-2.5 px-4 w-48 border-r border-slate-200">Public Holiday</th>
                    {activeStaffList.map((doc) => (
                      <th
                        key={doc.id}
                        className="py-2.5 px-2 text-center font-bold truncate max-w-[80px]"
                        title={doc.name}
                      >
                        {doc.name.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeStaffList.length + 2}
                        className="py-8 text-center text-slate-400"
                      >
                        No gazetted holidays found for {activeYear}.
                      </td>
                    </tr>
                  ) : (
                    matrixRows.map((row) => (
                      <tr key={row.date} className="hover:bg-slate-50">
                        <td className="py-2 px-4 font-semibold text-slate-600 sticky left-0 bg-white z-10 border-r border-slate-100">
                          {new Date(row.date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </td>
                        <td
                          className="py-2 px-4 font-bold text-slate-800 border-r border-slate-100 truncate max-w-[200px]"
                          title={row.name}
                        >
                          {row.name}
                        </td>
                        {activeStaffList.map((doc) => {
                          const entry = row.doctors[doc.id];
                          if (!entry) {
                            return (
                              <td key={doc.id} className="py-2 px-1 text-center text-slate-300">
                                —
                              </td>
                            );
                          }

                          const { classification } = entry;
                          let badgeBg = 'bg-slate-100 text-slate-500';
                          if (classification.earnsCredit) {
                            badgeBg = 'bg-indigo-100 text-indigo-800 font-bold';
                          } else if (classification.normalizedShift === 'HKA') {
                            badgeBg = 'bg-amber-100 text-amber-800';
                          } else if (classification.normalizedShift === 'AL') {
                            badgeBg = 'bg-blue-100 text-blue-800';
                          }

                          return (
                            <td key={doc.id} className="py-2 px-1 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${badgeBg}`}
                                title={`${classification.normalizedShift} (${classification.category})`}
                              >
                                {classification.normalizedShift || '—'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT MONTHLY MEMO MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Export Monthly GHKA Memo (.docx)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate official Word replacement leave justification for Hospital
                  Administration.
                </p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Applicant Details Card */}
              {myProfile && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2">
                    Applicant Information
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase">Name</span>
                      <p className="font-bold text-indigo-950 truncate">
                        {myProfile.fullName || myProfile.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase">
                        Staff / MMC ID
                      </span>
                      <p className="font-bold text-indigo-950">
                        {myProfile.staffCode || myProfile.registrationNumber || '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase">Phone</span>
                      <p className="font-bold text-indigo-950">{myProfile.phone || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-400 font-bold uppercase">Email</span>
                      <p className="font-bold text-indigo-950 truncate" title={myProfile.email}>
                        {myProfile.email || '—'}
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

              {/* Records List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select GHKA Replacements to Include in Memo
                </h3>
                {exportableRecords.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-xs">
                    No used GHKA replacement records available for memo export yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {exportableRecords.map((r) => {
                      const key = `${r.staffId}_${r.matchedGhkaDate}`;
                      const isChecked = Boolean(exportSelectedRows[key]);
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
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800">
                              {ghkaDateText}{' '}
                              <span className="text-slate-500 font-normal">({ghkaDayText})</span>
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              Replaces: {r.holidayName} (
                              {r.holidayDate
                                ? new Date(r.holidayDate).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                  })
                                : 'Carry-forward'}
                              )
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
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
