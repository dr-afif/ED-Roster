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
import { computeAutoPassiveEps } from './RosterCalendarView';
import { type LivePdfContact, openLiveRosterPdfExport } from '../domain/livePdfExport';
import { generateCalendarRosterPdf, generateRosterPdf } from '../domain/pdfGenerator';
import {
  getMoWorkMode,
  sortStaffByWorkMode,
  type Assignment,
  type PublicHolidayEntry,
  type StaffRosterIdentity,
} from '../domain/types';

export interface RosterExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodYear: string;
  periodMonth: string;
  periodStart: string;
  periodRevision: number;
  staffList: readonly StaffRosterIdentity[];
  allStaffList?: readonly StaffRosterIdentity[];
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
  allStaffList,
  assignments,
  shiftDefinitions,
  epAssignments = [],
  holidays = [],
}: RosterExportModalProps) {
  const monthIdx = parseInt(periodMonth, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] ?? periodMonth;
  const defaultMonthYear = `${monthName.toUpperCase()} ${periodYear}`;

  const directorySource = (
    allStaffList && allStaffList.length > 0 ? allStaffList : staffList
  ).filter((s) => s.active !== false);

  const adminPreparedByOptions = Array.from(
    new Set(
      directorySource
        .filter((s) => {
          const group = (s.staffGroup || '').toUpperCase();
          const code = (s.staffCode || '').toUpperCase();
          const role = ((s as unknown as { role?: string }).role || '').toLowerCase();
          const isPtpo = group.includes('PTPO') || code.startsWith('PTPO-');
          if (isPtpo) return false;
          return group.includes('SUPER-ADMIN') || group.includes('ADMIN-MO') || role === 'owner';
        })
        .map((s) => s.displayName || s.rosterName)
        .filter(Boolean),
    ),
  );
  if (adminPreparedByOptions.length === 0) {
    adminPreparedByOptions.push('Dr. Muhammad Afif');
  }

  const epStaffMembers = directorySource.filter((s) => {
    const group = (s.staffGroup || '').toUpperCase();
    const code = (s.staffCode || '').toUpperCase();
    return code.startsWith('EP-') || group.startsWith('EP |') || group === 'EP';
  });
  const epSignOffOptions = Array.from(
    new Set(epStaffMembers.map((s) => s.displayName || s.rosterName).filter(Boolean)),
  );
  if (epSignOffOptions.length === 0) {
    epSignOffOptions.push('Emergency Physician IC', 'Head of Emergency Medicine Department');
  }

  const [rosterType, setRosterType] = useState<
    'MO ROSTER' | 'MO & EP ROSTER' | 'EP ROSTER' | 'EP+ ROSTER'
  >('MO ROSTER');
  const [mainTitle, setMainTitle] = useState(
    'HOSPITAL SULTAN ABDUL AZIZ SHAH (HSAAS) — EMERGENCY MEDICINE DEPARTMENT',
  );
  const [monthYear, setMonthYear] = useState(defaultMonthYear);
  const [version, setVersion] = useState(
    periodRevision === 0 ? 'DRAFT' : `FINAL (Rev ${periodRevision})`,
  );
  const [preparedBy, setPreparedBy] = useState<string>(
    adminPreparedByOptions[0] ?? 'Dr. Muhammad Afif',
  );
  const [checkedBy, setCheckedBy] = useState<string>(epSignOffOptions[0] ?? '');
  const [approvedBy, setApprovedBy] = useState<string>(
    epSignOffOptions[1] ?? epSignOffOptions[0] ?? '',
  );
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
    const sortedMoStaff = sortStaffByWorkMode(staffList);
    const spreadsheetDoctors = sortedMoStaff.map((st) => {
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
          const workMode = getMoWorkMode(staff?.staffGroup);
          if (workMode === 'oh_non_clinical') continue;
          const name = staff ? staff.rosterName || staff.displayName : `Dr ${a.staffId}`;
          const code = (a.shiftCode || '')
            .toUpperCase()
            .replace(/\(S\)|-S|\(X\)|-X/g, '')
            .trim();
          if (code === 'AM' || (workMode === 'oh_clinical' && code === 'OH')) amNames.push(name);
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

      const epAmVal =
        epMap.get(`${d.dateStr}:EP_OFFICE_HOUR`) || epMap.get(`${d.dateStr}:AM`) || '';
      const epOncallVal =
        epMap.get(`${d.dateStr}:EP_ONCALL`) || epMap.get(`${d.dateStr}:ONCALL`) || '';
      const hasManualPassive =
        epMap.has(`${d.dateStr}:EP_PASSIVE`) ||
        epMap.has(`${d.dateStr}:EP_OFFICE_HOUR_PASSIVE`) ||
        epMap.has(`${d.dateStr}:PASSIVE`);
      const epPassiveVal = hasManualPassive
        ? (epMap.get(`${d.dateStr}:EP_PASSIVE`) ??
          epMap.get(`${d.dateStr}:EP_OFFICE_HOUR_PASSIVE`) ??
          epMap.get(`${d.dateStr}:PASSIVE`) ??
          '')
        : computeAutoPassiveEps(
            epStaffMembers.map((s) => s.rosterName || s.displayName),
            epAmVal,
            epOncallVal,
          ).join(', ');

      return {
        date: d.dayNum,
        day: d.dayName,
        isHoliday: Boolean(d.holidayName),
        moAm: amNames.join('\n'),
        moPm: pmNames.join('\n'),
        moNight: nightNames.join('\n'),
        epAm: epAmVal,
        epOncall: epOncallVal,
        epPassive: epPassiveVal,
      };
    });

    // Contacts
    const moContacts: LivePdfContact[] = staffList.slice(0, 15).map((s) => ({
      name: s.rosterName || s.displayName,
      phone: (s as unknown as { mobileNumber?: string }).mobileNumber || undefined,
    }));
    const epContacts: LivePdfContact[] = epStaffMembers.map((s) => ({
      name: s.rosterName || s.displayName,
      phone: (s as unknown as { mobileNumber?: string }).mobileNumber || undefined,
    }));

    return {
      spreadsheetDays,
      spreadsheetDoctors,
      calendarRows,
      contacts: { mo: moContacts, ep: epContacts },
    };
  };

  // 1. Live App Layout Print (Exact Parity)
  const handlePrintLiveLayout = () => {
    try {
      setIsExporting(true);
      setErrorMessage(null);

      const { spreadsheetDays, spreadsheetDoctors, calendarRows, contacts } = buildExportData();
      const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
      const logoUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${base}ed-crest.png`
          : '/ed-crest.png';

      openLiveRosterPdfExport({
        mainTitle,
        rosterType,
        monthYear,
        version,
        notes,
        logoUrl,
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
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#18181B]/55 p-0 sm:p-4 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="no-scrollbar w-full max-w-xl rounded-t-[28px] sm:rounded-[24px] border border-[#E7E5E4] bg-white p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto sheet-slide-up sm:animate-in"
      >
        {/* Mobile drag handle */}
        <div className="mx-auto -mt-1 h-1 w-10 rounded-full bg-[#D6D3D1] sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F4EFE6] pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F0FDFA] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#0F766E] mb-1">
              <Sparkles className="h-3 w-3" />
              <span>Official Department Document</span>
            </div>
            <h2
              id="roster-pdf-export-title"
              className="text-lg font-extrabold text-[#18181B] tracking-tight"
            >
              Roster PDF Export &amp; Print
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Generate pixel-perfect clinical roster documents with HSAAS department letterhead.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="rounded-xl border border-[#E7E5E4] p-1.5 text-[#57534E] hover:bg-[#FAF8F5] hover:text-[#18181B] cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs font-semibold text-[#B91C1C]">
            {errorMessage}
          </div>
        )}

        {/* Format Selector Pills */}
        <div>
          <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#78716C] mb-2">
            Roster Document Layout
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setRosterType('MO ROSTER')}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                rosterType === 'MO ROSTER'
                  ? 'border-[#0F766E] bg-[#F0FDFA] text-[#18181B] ring-2 ring-[#0F766E]'
                  : 'border-[#E7E5E4] bg-white hover:bg-[#FAF8F5]'
              }`}
            >
              <FileSpreadsheet className="h-5 w-5 text-[#0F766E] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-extrabold">MO Roster</div>
                <div className="text-[11px] text-[#78716C] leading-tight mt-0.5">
                  Table view in Landscape A4 · 31-day MO matrix, holidays &amp; sign-off blocks.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRosterType('MO & EP ROSTER')}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                rosterType === 'MO & EP ROSTER'
                  ? 'border-[#0F766E] bg-[#F0FDFA] text-[#18181B] ring-2 ring-[#0F766E]'
                  : 'border-[#E7E5E4] bg-white hover:bg-[#FAF8F5]'
              }`}
            >
              <FileText className="h-5 w-5 text-[#0F766E] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-extrabold">EP &amp; MO Roster</div>
                <div className="text-[11px] text-[#78716C] leading-tight mt-0.5">
                  Month view in Portrait A4 · Daily MO AM/PM/Night and EP Office Hour &amp; On-Call.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRosterType('EP ROSTER')}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                rosterType === 'EP ROSTER'
                  ? 'border-[#0F766E] bg-[#F0FDFA] text-[#18181B] ring-2 ring-[#0F766E]'
                  : 'border-[#E7E5E4] bg-white hover:bg-[#FAF8F5]'
              }`}
            >
              <FileText className="h-5 w-5 text-[#0F766E] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-extrabold">EP</div>
                <div className="text-[11px] text-[#78716C] leading-tight mt-0.5">
                  EP-only month view in Portrait A4 · AM (8AM–4PM) &amp; On-Call (4PM–8AM).
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRosterType('EP+ ROSTER')}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                rosterType === 'EP+ ROSTER'
                  ? 'border-[#0F766E] bg-[#F0FDFA] text-[#18181B] ring-2 ring-[#0F766E]'
                  : 'border-[#E7E5E4] bg-white hover:bg-[#FAF8F5]'
              }`}
            >
              <FileText className="h-5 w-5 text-[#0F766E] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-extrabold">EP+</div>
                <div className="text-[11px] text-[#78716C] leading-tight mt-0.5">
                  Portrait A4 with extra EP column: Office Hour (8AM–5PM).
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Configuration Fields */}
        <div className="space-y-3.5">
          <div>
            <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#78716C] mb-1">
              Hospital &amp; Department Header
            </label>
            <input
              type="text"
              value={mainTitle}
              onChange={(e) => setMainTitle(e.target.value)}
              className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2 text-xs font-bold text-[#18181B] outline-none focus:border-[#0F766E] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#78716C] mb-1">
                Month / Year
              </label>
              <input
                type="text"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2 text-xs font-bold text-[#18181B] outline-none focus:border-[#0F766E] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#78716C] mb-1">
                Version / Revision
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2 text-xs font-bold text-[#18181B] outline-none focus:border-[#0F766E] focus:bg-white"
              />
            </div>
          </div>

          {/* Signature Configuration */}
          <div className="rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#57534E]">
              <UserCheck className="h-3.5 w-3.5 text-[#0F766E]" />
              <span>Official Sign-Off Panels</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="signoff-prepared-by"
                  className="block text-[10px] font-bold text-[#78716C] mb-0.5"
                >
                  Prepared By
                </label>
                <select
                  id="signoff-prepared-by"
                  aria-label="Prepared By"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-white px-2 py-1.5 text-xs font-medium text-[#18181B] outline-none focus:border-[#0F766E] cursor-pointer"
                >
                  {adminPreparedByOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="signoff-checked-by"
                  className="block text-[10px] font-bold text-[#78716C] mb-0.5"
                >
                  Checked By
                </label>
                <select
                  id="signoff-checked-by"
                  aria-label="Checked By"
                  value={checkedBy}
                  onChange={(e) => setCheckedBy(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-white px-2 py-1.5 text-xs font-medium text-[#18181B] outline-none focus:border-[#0F766E] cursor-pointer"
                >
                  {epSignOffOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="signoff-approved-by"
                  className="block text-[10px] font-bold text-[#78716C] mb-0.5"
                >
                  Approved By
                </label>
                <select
                  id="signoff-approved-by"
                  aria-label="Approved By"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-white px-2 py-1.5 text-xs font-medium text-[#18181B] outline-none focus:border-[#0F766E] cursor-pointer"
                >
                  {epSignOffOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#78716C] mb-1">
              Optional Administrative Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Any shift swap must be submitted via amendment request form 48 hours in advance."
              className="w-full resize-none rounded-xl border border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2 text-xs font-medium text-[#18181B] outline-none focus:border-[#0F766E] focus:bg-white"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-[#F4EFE6] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-bold text-[#57534E] hover:bg-[#FAF8F5] cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <div className="flex w-full sm:w-auto items-center gap-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownloadBinaryPdf}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-xs font-bold text-[#18181B] hover:bg-[#FAF8F5] cursor-pointer shadow-2xs transition-all active:scale-[0.98]"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#57534E]" />
              ) : (
                <Download className="h-4 w-4 text-[#57534E]" />
              )}
              <span>Download .pdf</span>
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={handlePrintLiveLayout}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#14867D,#0F766E)] px-4 py-2 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(15,118,110,0.28)] cursor-pointer transition-all active:scale-[0.98]"
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
