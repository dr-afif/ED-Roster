import { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import type { EpAssignmentRow, ShiftDefinitionRow } from '../data/rosterQueries';
import {
  type LivePdfContact,
  openLiveRosterPdfExport,
} from '../domain/livePdfExport';
import { generateCalendarRosterPdf, generateRosterPdf } from '../domain/pdfGenerator';
import type { Assignment, PublicHolidayEntry, StaffRosterIdentity } from '../domain/types';

export interface RosterExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodYear: string;
  periodMonth: string;
  periodStart: string;
  periodRevision: number;
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  shiftDefinitions: readonly ShiftDefinitionRow[];
  epAssignments?: readonly EpAssignmentRow[];
  holidays?: readonly PublicHolidayEntry[];
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function RosterExportModal({
  isOpen,
  onClose,
  periodYear,
  periodMonth,
  periodStart,
  periodRevision,
  staffList,
  assignments,
  shiftDefinitions,
  epAssignments = [],
  holidays = [],
}: RosterExportModalProps) {
  const monthIdx = parseInt(periodMonth, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] ?? periodMonth;
  const defaultMonthYear = `${monthName.toUpperCase()} ${periodYear}`;

  const [rosterType, setRosterType] = useState<'MO ROSTER' | 'MO & EP ROSTER' | 'EP ROSTER'>(
    'MO ROSTER',
  );
  const [mainTitle, setMainTitle] = useState(
    'HOSPITAL SULTAN ABDUL AZIZ SHAH (HSAAS) — EMERGENCY MEDICINE DEPARTMENT',
  );
  const [monthYear, setMonthYear] = useState(defaultMonthYear);
  const [version, setVersion] = useState(
    periodRevision === 0 ? 'DRAFT' : `FINAL (Rev ${periodRevision})`,
  );
  const [preparedBy, setPreparedBy] = useState('Dr. Muhammad Afif (MO IC Roster)');
  const [checkedBy, setCheckedBy] = useState('Emergency Physician IC');
  const [approvedBy, setApprovedBy] = useState('Head of Emergency Medicine Department');
  const [notes, setNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Prepare data structures for Live App HTML print
  const buildExportData = () => {
    const yearNum = parseInt(periodYear, 10);
    const monthNum = parseInt(periodMonth, 10);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // Holiday map: date string -> holiday name
    const holidayMap = new Map<string, string>();
    for (const h of holidays) {
      holidayMap.set(h.date, h.name);
    }

    // Days array
    const spreadsheetDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${periodYear}-${periodMonth.padStart(2, '0')}-${dayStr}`;
      const dt = new Date(yearNum, monthNum - 1, d);
      spreadsheetDays.push({
        dateStr,
        dayNum: d,
        dayName: dayNames[dt.getDay()] ?? '',
        holidayName: holidayMap.get(dateStr),
      });
    }

    // Doctors array
    const spreadsheetDoctors = staffList.map((st) => {
      const docShifts: Record<string, { value: string }> = {};
      for (const a of assignments) {
        if (a.staffId === st.id) {
          docShifts[a.dutyDate] = { value: a.shiftCode };
        }
      }
      return {
        name: st.rosterName || st.displayName,
        shifts: docShifts,
      };
    });

    // Calendar rows for MO & EP schedule
    const staffMap = new Map<number, StaffRosterIdentity>();
    for (const s of staffList) staffMap.set(s.id, s);

    const epMap = new Map<string, string>();
    for (const ep of epAssignments) {
      epMap.set(`${ep.duty_date}:${ep.slot_type}`, ep.physician_names);
    }

    const calendarRows = spreadsheetDays.map((d) => {
      const amNames: string[] = [];
      const pmNames: string[] = [];
      const nightNames: string[] = [];

      for (const a of assignments) {
        if (a.dutyDate === d.dateStr) {
          const staff = staffMap.get(a.staffId);
          const name = staff ? staff.rosterName || staff.displayName : `Dr ${a.staffId}`;
          const code = (a.shiftCode || '').toUpperCase().trim();
          if (code === 'AM') amNames.push(name);
          else if (code === 'PM') pmNames.push(name);
          else if (
            code === 'ND' ||
            code === 'NIGHT' ||
            code === 'ON1' ||
            code === 'ON2' ||
            code === 'PN'
          ) {
            nightNames.push(name);
          }
        }
      }

      return {
        date: d.dayNum,
        day: d.dayName,
        isHoliday: Boolean(d.holidayName),
        moAm: amNames.join('\n'),
        moPm: pmNames.join('\n'),
        moNight: nightNames.join('\n'),
        epAm: epMap.get(`${d.dateStr}:EP_OFFICE_HOUR`) || epMap.get(`${d.dateStr}:AM`) || '',
        epOncall: epMap.get(`${d.dateStr}:EP_ONCALL`) || epMap.get(`${d.dateStr}:ONCALL`) || '',
      };
    });

    // Contacts
    const moContacts: LivePdfContact[] = staffList.slice(0, 15).map((s) => ({
      name: s.rosterName || s.displayName,
      phone: (s as unknown as { mobileNumber?: string }).mobileNumber || undefined,
    }));

    return {
      spreadsheetDays,
      spreadsheetDoctors,
      calendarRows,
      contacts: { mo: moContacts, ep: [] },
    };
  };

  // 1. Live App Layout Print (Exact Parity)
  const handlePrintLiveLayout = () => {
    try {
      setIsExporting(true);
      setErrorMessage(null);

      const { spreadsheetDays, spreadsheetDoctors, calendarRows, contacts } = buildExportData();

      openLiveRosterPdfExport({
        mainTitle,
        rosterType,
        monthYear,
        version,
        notes,
        spreadsheetDays,
        spreadsheetDoctors,
        rows: calendarRows,
        contacts,
        preparedBy,
        checkedBy,
        approvedBy,
      });

      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to launch print export window.');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Binary PDF Download (pdf-lib)
  const handleDownloadBinaryPdf = async () => {
    try {
      setIsExporting(true);
      setErrorMessage(null);

      const canonicalPayload = {
        period: {
          year: periodYear,
          month: periodMonth,
          periodStart,
          revision: periodRevision,
        },
        staffCount: staffList.length,
        assignmentCount: assignments.length,
      };

      if (rosterType === 'MO ROSTER') {
        const { pdfBytes, fileName } = await generateRosterPdf({
          period: {
            year: periodYear,
            month: periodMonth,
            periodStart,
            revision: periodRevision,
          },
          snapshotVersion: periodRevision + 1,
          snapshotType: periodRevision === 0 ? 'initial' : 'amendment',
          staffList,
          assignments,
          shiftDefinitions,
          generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          canonicalHash: JSON.stringify(canonicalPayload),
        });

        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      } else {
        const { pdfBytes, fileName } = await generateCalendarRosterPdf({
          period: {
            year: periodYear,
            month: periodMonth,
            periodStart,
            revision: periodRevision,
          },
          snapshotVersion: periodRevision + 1,
          snapshotType: periodRevision === 0 ? 'initial' : 'amendment',
          staffList,
          assignments,
          epAssignments,
          holidays,
          generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          canonicalHash: JSON.stringify(canonicalPayload),
        });

        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      }

      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate binary PDF file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-pdf-export-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in"
    >
      <div className="w-full max-w-xl rounded-t-[28px] sm:rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl space-y-5 dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
        {/* Mobile drag handle */}
        <div className="mx-auto -mt-1 h-1 w-10 rounded-full bg-stone-300 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 mb-1">
              <Sparkles className="h-3 w-3" />
              <span>Official Department Document</span>
            </div>
            <h2
              id="roster-pdf-export-title"
              className="text-lg font-bold text-slate-900 dark:text-white tracking-tight"
            >
              Roster PDF Export &amp; Print
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate pixel-perfect clinical roster documents with HSAAS department letterhead.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Format Selector Pills */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Roster Document Layout
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setRosterType('MO ROSTER')}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                rosterType === 'MO ROSTER'
                  ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/30 text-teal-950 dark:text-teal-100 ring-2 ring-teal-600'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className="h-5 w-5 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">Staff Spreadsheet (Landscape A4)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  Complete 31-day doctor matrix, shift badges, public holiday list &amp; sign-off blocks.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRosterType('MO & EP ROSTER')}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                rosterType === 'MO & EP ROSTER'
                  ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/30 text-teal-950 dark:text-teal-100 ring-2 ring-teal-600'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">Daily Coverage Schedule (Portrait A4)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  Day-by-day AM, PM, Night MO coverage and EP Office Hour &amp; On-Call assignments.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Configuration Fields */}
        <div className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Hospital &amp; Department Header
            </label>
            <input
              type="text"
              value={mainTitle}
              onChange={(e) => setMainTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Month / Year
              </label>
              <input
                type="text"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Version / Revision
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Signature Configuration */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <UserCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>Official Sign-Off Panels</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Prepared By
                </label>
                <input
                  type="text"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Checked By
                </label>
                <input
                  type="text"
                  value={checkedBy}
                  onChange={(e) => setCheckedBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                  Approved By
                </label>
                <input
                  type="text"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Optional Administrative Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Any shift swap must be submitted via amendment request form 48 hours in advance."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <div className="flex w-full sm:w-auto items-center gap-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadBinaryPdf}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs transition-all active:scale-[0.98]"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              ) : (
                <Download className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              )}
              <span>Download .pdf</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handlePrintLiveLayout}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 cursor-pointer transition-all active:scale-[0.98] dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span>Print / Live Layout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
