import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { computeSha256Hex } from '@/shared/crypto/sha256';
import type { ShiftDefinitionRow } from '../data/rosterQueries';
import type { Assignment, StaffRosterIdentity } from './types';

export interface RosterPdfPayload {
  period: {
    year: string;
    month: string;
    periodStart: string;
    revision: number;
  };
  snapshotVersion: number;
  snapshotType: 'initial' | 'amendment' | 'final' | 'manual';
  reason?: string | null;
  predecessorVersion?: number | null;
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  shiftDefinitions: readonly ShiftDefinitionRow[];
  generatedAt: string;
  generatedBy?: string;
  canonicalHash: string;
}

export interface GeneratedPdfResult {
  pdfBytes: Uint8Array;
  pdfSha256: string;
  fileName: string;
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

const DAY_ABBR = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];

/**
 * Deterministic landscape A4 PDF generator for Emergency Department roster snapshots.
 * Implements blueprint specifications from 07_PDF_TELEGRAM_WORKFLOW.md.
 */
export async function generateRosterPdf(payload: RosterPdfPayload): Promise<GeneratedPdfResult> {
  const doc = await PDFDocument.create();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Landscape A4: 841.89 x 595.28 points
  const pageWidth = 841.89;
  const pageHeight = 595.28;

  const yearNum = parseInt(payload.period.year, 10);
  const monthNum = parseInt(payload.period.month, 10);
  const monthName = MONTH_NAMES[monthNum - 1] ?? payload.period.month;

  // Days in month
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const dateList: Array<{ dateStr: string; dayNum: number; dayOfWeek: number }> = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${payload.period.year}-${payload.period.month.padStart(2, '0')}-${dayStr}`;
    const dt = new Date(yearNum, monthNum - 1, d);
    dateList.push({
      dateStr: fullDate,
      dayNum: d,
      dayOfWeek: dt.getDay(),
    });
  }

  // Map assignments: `staffId:dateStr` -> shiftCode
  const assignmentMap = new Map<string, string>();
  for (const a of payload.assignments) {
    assignmentMap.set(`${a.staffId}:${a.dutyDate}`, a.shiftCode);
  }

  // Layout metrics
  const marginX = 24;
  const marginTop = 20;
  const marginBottom = 20;

  const staffNameWidth = 100;
  const staffCodeWidth = 46;
  const gridWidth = pageWidth - marginX * 2;
  const dayColWidth = Math.floor((gridWidth - staffNameWidth - staffCodeWidth) / daysInMonth);
  const totalDayColumnsWidth = dayColWidth * daysInMonth;
  const actualGridWidth = staffNameWidth + staffCodeWidth + totalDayColumnsWidth;

  const rowHeight = 13.5;
  const headerRowHeight = 14;

  const staffPerPage = 24;
  const totalPages = Math.max(1, Math.ceil(payload.staffList.length / staffPerPage));

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = doc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - marginTop;

    // 1. Department Header
    page.drawText('HOSPITAL SULTAN ABDUL AZIZ SHAH (HSAAS) — EMERGENCY DEPARTMENT', {
      x: marginX,
      y: currentY,
      size: 11,
      font: fontBold,
      color: rgb(0.08, 0.18, 0.36),
    });
    currentY -= 13;

    // Title line
    const versionStr = `v${payload.snapshotVersion.toString().padStart(2, '0')}`;
    const titleText = `OFFICIAL EMERGENCY ROSTER — ${monthName.toUpperCase()} ${payload.period.year}`;
    page.drawText(titleText, {
      x: marginX,
      y: currentY,
      size: 10,
      font: fontBold,
      color: rgb(0.12, 0.15, 0.2),
    });

    const metaText = `Snapshot: ${versionStr} (${payload.snapshotType.toUpperCase()}) | Revision: ${payload.period.revision} | Generated: ${payload.generatedAt} MYT`;
    const metaWidth = fontRegular.widthOfTextAtSize(metaText, 7.5);
    page.drawText(metaText, {
      x: marginX + actualGridWidth - metaWidth,
      y: currentY,
      size: 7.5,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.45),
    });
    currentY -= 12;

    if (payload.reason) {
      page.drawText(`Operational Justification: ${payload.reason}`, {
        x: marginX,
        y: currentY,
        size: 7.5,
        font: fontOblique,
        color: rgb(0.25, 0.3, 0.4),
      });
      currentY -= 11;
    } else {
      currentY -= 3;
    }

    // 2. Table Headers
    const tableTop = currentY;

    // Header background
    page.drawRectangle({
      x: marginX,
      y: tableTop - headerRowHeight * 2,
      width: actualGridWidth,
      height: headerRowHeight * 2,
      color: rgb(0.92, 0.94, 0.97),
      borderColor: rgb(0.75, 0.8, 0.86),
      borderWidth: 0.5,
    });

    // Doctor column header
    page.drawText('Doctor / Medical Officer', {
      x: marginX + 4,
      y: tableTop - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.25),
    });
    page.drawText('Code', {
      x: marginX + staffNameWidth + 4,
      y: tableTop - 11,
      size: 7.5,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.25),
    });

    // Date headers (Day numbers + Day abbreviations)
    for (let dIdx = 0; dIdx < dateList.length; dIdx++) {
      const item = dateList[dIdx];
      if (!item) continue;
      const colX = marginX + staffNameWidth + staffCodeWidth + dIdx * dayColWidth;
      const isWeekend = item.dayOfWeek === 0 || item.dayOfWeek === 6;

      if (isWeekend) {
        page.drawRectangle({
          x: colX,
          y: tableTop - headerRowHeight * 2,
          width: dayColWidth,
          height: headerRowHeight * 2,
          color: rgb(0.85, 0.89, 0.95),
        });
      }

      // Column vertical border
      page.drawLine({
        start: { x: colX, y: tableTop },
        end: { x: colX, y: tableTop - headerRowHeight * 2 },
        color: rgb(0.75, 0.8, 0.86),
        thickness: 0.5,
      });

      // Day number (Row 1)
      const dayNumStr = String(item.dayNum);
      const dayNumWidth = fontBold.widthOfTextAtSize(dayNumStr, 7.5);
      page.drawText(dayNumStr, {
        x: colX + (dayColWidth - dayNumWidth) / 2,
        y: tableTop - 10,
        size: 7.5,
        font: fontBold,
        color: isWeekend ? rgb(0.1, 0.2, 0.45) : rgb(0.15, 0.2, 0.25),
      });

      // Day of week letter (Row 2)
      const dayAbbrStr = DAY_ABBR[item.dayOfWeek] ?? 'D';
      const dayAbbrWidth = fontRegular.widthOfTextAtSize(dayAbbrStr, 6.5);
      page.drawText(dayAbbrStr, {
        x: colX + (dayColWidth - dayAbbrWidth) / 2,
        y: tableTop - headerRowHeight - 9,
        size: 6.5,
        font: fontRegular,
        color: isWeekend ? rgb(0.2, 0.3, 0.5) : rgb(0.4, 0.45, 0.5),
      });
    }

    currentY = tableTop - headerRowHeight * 2;

    // 3. Staff Rows
    const pageStaff = payload.staffList.slice(pageIdx * staffPerPage, (pageIdx + 1) * staffPerPage);

    for (let rIdx = 0; rIdx < pageStaff.length; rIdx++) {
      const staff = pageStaff[rIdx];
      if (!staff) continue;
      const rowY = currentY - (rIdx + 1) * rowHeight;
      const isEven = rIdx % 2 === 0;

      // Row background
      page.drawRectangle({
        x: marginX,
        y: rowY,
        width: actualGridWidth,
        height: rowHeight,
        color: isEven ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 0.5,
      });

      // Truncate name if needed
      let nameStr = staff.rosterName ?? staff.displayName;
      if (fontRegular.widthOfTextAtSize(nameStr, 7) > staffNameWidth - 8) {
        nameStr = nameStr.slice(0, 16) + '…';
      }

      page.drawText(nameStr, {
        x: marginX + 3,
        y: rowY + 3.5,
        size: 7,
        font: fontRegular,
        color: rgb(0.1, 0.12, 0.15),
      });

      page.drawText(staff.staffCode, {
        x: marginX + staffNameWidth + 3,
        y: rowY + 3.5,
        size: 6.5,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5),
      });

      // Cells
      for (let dIdx = 0; dIdx < dateList.length; dIdx++) {
        const item = dateList[dIdx];
        if (!item) continue;
        const colX = marginX + staffNameWidth + staffCodeWidth + dIdx * dayColWidth;
        const shiftCode = assignmentMap.get(`${staff.id}:${item.dateStr}`) ?? '';

        // Cell vertical border
        page.drawLine({
          start: { x: colX, y: rowY + rowHeight },
          end: { x: colX, y: rowY },
          color: rgb(0.85, 0.88, 0.92),
          thickness: 0.5,
        });

        if (shiftCode) {
          // Color text based on shift
          let textColor = rgb(0.15, 0.2, 0.25);
          let isShiftBold = false;

          if (shiftCode === 'AM') {
            textColor = rgb(0.02, 0.35, 0.65);
          } else if (shiftCode === 'PM') {
            textColor = rgb(0.75, 0.42, 0.05);
          } else if (shiftCode === 'ON' || shiftCode === 'ON1' || shiftCode === 'ON2') {
            textColor = rgb(0.45, 0.15, 0.65);
          } else if (shiftCode === 'PN') {
            textColor = rgb(0.35, 0.2, 0.6);
          } else if (shiftCode === 'OFF' || shiftCode === 'GOFF') {
            textColor = rgb(0.2, 0.4, 0.35);
            isShiftBold = true;
          } else if (shiftCode === 'AL' || shiftCode === 'MC' || shiftCode === 'EL') {
            textColor = rgb(0.7, 0.15, 0.15);
          }

          const fontToUse = isShiftBold ? fontBold : fontRegular;
          const textWidth = fontToUse.widthOfTextAtSize(shiftCode, 6.5);
          page.drawText(shiftCode, {
            x: colX + (dayColWidth - textWidth) / 2,
            y: rowY + 3.5,
            size: 6.5,
            font: fontToUse,
            color: textColor,
          });
        }
      }
    }

    currentY -= pageStaff.length * rowHeight;

    // 4. Shift Legend (at bottom of last page)
    if (pageIdx === totalPages - 1) {
      currentY -= 14;
      page.drawText('SHIFT CODES & OPERATIONAL TIMINGS:', {
        x: marginX,
        y: currentY,
        size: 7,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.3),
      });

      const legendItems = payload.shiftDefinitions
        .slice(0, 10)
        .map((s) => `${s.code}: ${s.label}`)
        .join('   |   ');

      currentY -= 9;
      page.drawText(legendItems, {
        x: marginX,
        y: currentY,
        size: 6,
        font: fontRegular,
        color: rgb(0.35, 0.4, 0.45),
      });
    }

    // 5. Footer
    const footerY = marginBottom + 4;
    page.drawLine({
      start: { x: marginX, y: footerY + 8 },
      end: { x: marginX + actualGridWidth, y: footerY + 8 },
      color: rgb(0.8, 0.83, 0.88),
      thickness: 0.5,
    });

    page.drawText('CONFIDENTIAL — MOH / HSAAS Emergency Department Operational Roster', {
      x: marginX,
      y: footerY,
      size: 6.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });

    const pageIndicator = `Page ${pageIdx + 1} of ${totalPages}`;
    const pageIndWidth = fontRegular.widthOfTextAtSize(pageIndicator, 6.5);
    page.drawText(pageIndicator, {
      x: marginX + (actualGridWidth - pageIndWidth) / 2,
      y: footerY,
      size: 6.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });

    const hashStr = `Payload SHA: ${payload.canonicalHash.slice(0, 16)}…`;
    const hashWidth = fontRegular.widthOfTextAtSize(hashStr, 6.5);
    page.drawText(hashStr, {
      x: marginX + actualGridWidth - hashWidth,
      y: footerY,
      size: 6.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  const pdfBytes = await doc.save();
  const pdfSha256 = await computeSha256Hex(pdfBytes);

  const verPadded = payload.snapshotVersion.toString().padStart(2, '0');
  const typeLabel =
    payload.snapshotType === 'initial'
      ? 'Initial'
      : payload.snapshotType === 'amendment'
        ? `Amendment_${payload.period.year}-${payload.period.month.padStart(2, '0')}`
        : 'Final';

  const fileName = `ED_Roster_${payload.period.year}-${payload.period.month.padStart(2, '0')}_v${verPadded}_${typeLabel}.pdf`;

  return {
    pdfBytes,
    pdfSha256,
    fileName,
  };
}

export interface CalendarRosterPdfPayload {
  period: {
    year: string;
    month: string;
    periodStart: string;
    revision: number;
  };
  snapshotVersion: number;
  snapshotType: 'initial' | 'amendment' | 'final' | 'manual';
  staffList: readonly StaffRosterIdentity[];
  assignments: readonly Assignment[];
  epAssignments: ReadonlyArray<{
    duty_date: string;
    slot_type: string;
    physician_names: string;
  }>;
  holidays?: ReadonlyArray<{ date: string; name: string }>;
  generatedAt: string;
  canonicalHash: string;
}

/**
 * Deterministic portrait A4 PDF generator for Emergency Department Calendar / Duty Schedule.
 * Formats daily Medical Officer coverage (AM, PM, Night) and Emergency Physician coverage.
 */
export async function generateCalendarRosterPdf(
  payload: CalendarRosterPdfPayload,
): Promise<GeneratedPdfResult> {
  const doc = await PDFDocument.create();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Portrait A4: 595.28 x 841.89 points
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  const yearNum = parseInt(payload.period.year, 10);
  const monthNum = parseInt(payload.period.month, 10);
  const monthName = MONTH_NAMES[monthNum - 1] ?? payload.period.month;

  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const dateList: Array<{ dateStr: string; dayNum: number; dayName: string; isWeekend: boolean }> =
    [];
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${payload.period.year}-${payload.period.month.padStart(2, '0')}-${dayStr}`;
    const dt = new Date(yearNum, monthNum - 1, d);
    dateList.push({
      dateStr: fullDate,
      dayNum: d,
      dayName: dayNames[dt.getDay()] ?? '',
      isWeekend: dt.getDay() === 0 || dt.getDay() === 6,
    });
  }

  // Lookup map for staff
  const staffMap = new Map<number, StaffRosterIdentity>();
  for (const s of payload.staffList) {
    staffMap.set(s.id, s);
  }

  // Lookup map for EP assignments: `${duty_date}:${slot_type}`
  const epMap = new Map<string, string>();
  for (const ep of payload.epAssignments) {
    epMap.set(`${ep.duty_date}:${ep.slot_type}`, ep.physician_names);
  }

  // Group MO assignments by date
  const moDaily = new Map<string, { am: string[]; pm: string[]; night: string[] }>();
  for (const d of dateList) {
    moDaily.set(d.dateStr, { am: [], pm: [], night: [] });
  }

  for (const a of payload.assignments) {
    const day = moDaily.get(a.dutyDate);
    if (!day) continue;
    const staff = staffMap.get(a.staffId);
    const name = staff ? staff.rosterName || staff.displayName : `Dr ${a.staffId}`;
    const code = (a.shiftCode || '').toUpperCase().trim();
    if (code === 'AM') day.am.push(name);
    else if (code === 'PM') day.pm.push(name);
    else if (
      code === 'ND' ||
      code === 'NIGHT' ||
      code === 'ON1' ||
      code === 'ON2' ||
      code === 'PN'
    ) {
      day.night.push(name);
    }
  }

  const holidaysMap = new Map<string, string>();
  if (payload.holidays) {
    for (const h of payload.holidays) {
      holidaysMap.set(h.date, h.name);
    }
  }

  const page = doc.addPage([pageWidth, pageHeight]);

  const marginX = 20;
  const marginTop = 20;
  const marginBottom = 18;
  const usableWidth = pageWidth - marginX * 2; // 555.28 pt

  let currentY = pageHeight - marginTop;

  // 1. Department Header
  page.drawText('HOSPITAL SULTAN ABDUL AZIZ SHAH (HSAAS) — EMERGENCY MEDICINE DEPARTMENT', {
    x: marginX,
    y: currentY,
    size: 10,
    font: fontBold,
    color: rgb(0.08, 0.18, 0.36),
  });
  currentY -= 12;

  const versionStr = `v${payload.snapshotVersion.toString().padStart(2, '0')}`;
  page.drawText(
    `MONTHLY DUTY ROSTER — ${monthName.toUpperCase()} ${yearNum} (${versionStr} · Rev ${payload.period.revision})`,
    {
      x: marginX,
      y: currentY,
      size: 8.5,
      font: fontBold,
      color: rgb(0.3, 0.35, 0.45),
    },
  );

  const genDateStr = `Generated: ${payload.generatedAt.slice(0, 10)}`;
  const genWidth = fontRegular.widthOfTextAtSize(genDateStr, 7.5);
  page.drawText(genDateStr, {
    x: marginX + usableWidth - genWidth,
    y: currentY,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5),
  });
  currentY -= 14;

  // Column widths (Total = 555.28)
  const colDateW = 24;
  const colDayW = 26;
  const colAmW = 148;
  const colPmW = 148;
  const colNightW = 75;
  const colEpAmW = 67;
  const colEpOncallW = 67;

  // Table header row 1 (height 12)
  const th1Height = 11;
  const th2Height = 11;

  // Top header background
  page.drawRectangle({
    x: marginX,
    y: currentY - th1Height,
    width: usableWidth,
    height: th1Height,
    color: rgb(0.12, 0.2, 0.32),
  });

  page.drawText('DATE', {
    x: marginX + 3,
    y: currentY - th1Height + 3,
    size: 6.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText('DAY', {
    x: marginX + colDateW + 4,
    y: currentY - th1Height + 3,
    size: 6.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // MO header box
  const moHeaderW = colAmW + colPmW + colNightW;
  page.drawRectangle({
    x: marginX + colDateW + colDayW,
    y: currentY - th1Height,
    width: moHeaderW,
    height: th1Height,
    color: rgb(0.16, 0.26, 0.42),
  });
  page.drawText('MEDICAL OFFICER (ON DUTY)', {
    x: marginX + colDateW + colDayW + (moHeaderW - 130) / 2,
    y: currentY - th1Height + 3,
    size: 6.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // EP header box
  const epHeaderW = colEpAmW + colEpOncallW;
  page.drawRectangle({
    x: marginX + colDateW + colDayW + moHeaderW,
    y: currentY - th1Height,
    width: epHeaderW,
    height: th1Height,
    color: rgb(0.08, 0.45, 0.42),
  });
  page.drawText('EMERGENCY PHYSICIAN', {
    x: marginX + colDateW + colDayW + moHeaderW + (epHeaderW - 95) / 2,
    y: currentY - th1Height + 3,
    size: 6.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  currentY -= th1Height;

  // Table header row 2
  page.drawRectangle({
    x: marginX,
    y: currentY - th2Height,
    width: usableWidth,
    height: th2Height,
    color: rgb(0.2, 0.28, 0.4),
  });

  let subX = marginX + colDateW + colDayW;
  page.drawText('AM (08:00 - 16:00)', {
    x: subX + 4,
    y: currentY - th2Height + 3,
    size: 6,
    font: fontBold,
    color: rgb(1, 0.85, 0.4),
  });
  subX += colAmW;

  page.drawText('PM (16:00 - 23:00)', {
    x: subX + 4,
    y: currentY - th2Height + 3,
    size: 6,
    font: fontBold,
    color: rgb(0.6, 0.85, 1),
  });
  subX += colPmW;

  page.drawText('NIGHT (23:00 - 08:00)', {
    x: subX + 4,
    y: currentY - th2Height + 3,
    size: 6,
    font: fontBold,
    color: rgb(0.85, 0.8, 1),
  });
  subX += colNightW;

  page.drawRectangle({
    x: subX,
    y: currentY - th2Height,
    width: epHeaderW,
    height: th2Height,
    color: rgb(0.1, 0.5, 0.46),
  });

  page.drawText('OFFICE (08:00 - 16:00)', {
    x: subX + 3,
    y: currentY - th2Height + 3,
    size: 5.5,
    font: fontBold,
    color: rgb(0.8, 1, 0.95),
  });
  subX += colEpAmW;

  page.drawText('ON CALL (16:00 - 08:00)', {
    x: subX + 3,
    y: currentY - th2Height + 3,
    size: 5.5,
    font: fontBold,
    color: rgb(0.8, 1, 0.95),
  });

  currentY -= th2Height;

  // Day Rows: available height for 31 days
  const footerReserved = 48;
  const availableTableH = currentY - marginBottom - footerReserved;
  const rowH = Math.min(22, availableTableH / daysInMonth);

  for (let idx = 0; idx < dateList.length; idx++) {
    const item = dateList[idx];
    if (!item) continue;
    const { dateStr, dayNum, dayName, isWeekend } = item;
    const isHoliday = holidaysMap.has(dateStr);

    const rowY = currentY - rowH;

    // Background shading
    if (isHoliday) {
      page.drawRectangle({
        x: marginX,
        y: rowY,
        width: usableWidth,
        height: rowH,
        color: rgb(0.99, 0.93, 0.94),
      });
    } else if (isWeekend) {
      page.drawRectangle({
        x: marginX,
        y: rowY,
        width: usableWidth,
        height: rowH,
        color: rgb(0.95, 0.96, 0.98),
      });
    }

    // Row borders
    page.drawLine({
      start: { x: marginX, y: rowY },
      end: { x: marginX + usableWidth, y: rowY },
      color: rgb(0.85, 0.88, 0.92),
      thickness: 0.5,
    });

    // Date
    page.drawText(String(dayNum), {
      x: marginX + 7,
      y: rowY + rowH / 2 - 2,
      size: 7.5,
      font: fontBold,
      color: isHoliday ? rgb(0.8, 0.1, 0.2) : rgb(0.1, 0.15, 0.25),
    });

    // Day Name
    page.drawText(dayName, {
      x: marginX + colDateW + 4,
      y: rowY + rowH / 2 - 2,
      size: 6.5,
      font: isWeekend ? fontBold : fontRegular,
      color: isWeekend ? rgb(0.7, 0.35, 0.1) : rgb(0.35, 0.4, 0.5),
    });

    // MO Columns
    const mo = moDaily.get(dateStr) ?? { am: [], pm: [], night: [] };

    // Function to render text inside cell
    const renderCellNames = (names: string[], startX: number, cellW: number) => {
      if (!names.length) {
        page.drawText('-', {
          x: startX + cellW / 2 - 2,
          y: rowY + rowH / 2 - 2,
          size: 6.5,
          font: fontRegular,
          color: rgb(0.7, 0.75, 0.8),
        });
        return;
      }
      const text = names.join(', ');
      // Truncate or fit at 6pt
      const maxChars = Math.floor(cellW / 3.4);
      const displayStr = text.length > maxChars ? text.slice(0, maxChars - 2) + '…' : text;
      page.drawText(displayStr, {
        x: startX + 3,
        y: rowY + rowH / 2 - 2,
        size: 6.2,
        font: fontRegular,
        color: rgb(0.1, 0.15, 0.25),
      });
    };

    let colX = marginX + colDateW + colDayW;
    renderCellNames(mo.am, colX, colAmW);
    colX += colAmW;

    renderCellNames(mo.pm, colX, colPmW);
    colX += colPmW;

    renderCellNames(mo.night, colX, colNightW);
    colX += colNightW;

    // EP Office Hour
    const epOffice = epMap.get(`${dateStr}:EP_OFFICE_HOUR`) ?? '';
    if (epOffice) {
      page.drawText(epOffice.slice(0, 18), {
        x: colX + 3,
        y: rowY + rowH / 2 - 2,
        size: 6.2,
        font: fontBold,
        color: rgb(0.08, 0.45, 0.4),
      });
    } else {
      page.drawText('-', {
        x: colX + colEpAmW / 2 - 2,
        y: rowY + rowH / 2 - 2,
        size: 6.5,
        font: fontRegular,
        color: rgb(0.7, 0.75, 0.8),
      });
    }
    colX += colEpAmW;

    // EP On Call
    const epOncall = epMap.get(`${dateStr}:EP_ONCALL`) ?? '';
    if (epOncall) {
      page.drawText(epOncall.slice(0, 18), {
        x: colX + 3,
        y: rowY + rowH / 2 - 2,
        size: 6.2,
        font: fontBold,
        color: rgb(0.08, 0.45, 0.4),
      });
    } else {
      page.drawText('-', {
        x: colX + colEpOncallW / 2 - 2,
        y: rowY + rowH / 2 - 2,
        size: 6.5,
        font: fontRegular,
        color: rgb(0.7, 0.75, 0.8),
      });
    }

    currentY = rowY;
  }

  // Footer: Signatures & Verification
  const signY = marginBottom + 20;
  page.drawLine({
    start: { x: marginX, y: signY + 14 },
    end: { x: marginX + usableWidth, y: signY + 14 },
    color: rgb(0.75, 0.8, 0.88),
    thickness: 0.5,
  });

  const signColW = usableWidth / 3;
  page.drawText('Prepared By: ___________________', {
    x: marginX,
    y: signY + 4,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.45),
  });
  page.drawText('(MO IC Roster)', {
    x: marginX,
    y: signY - 4,
    size: 5.5,
    font: fontOblique,
    color: rgb(0.45, 0.5, 0.6),
  });

  page.drawText('Checked By: ___________________', {
    x: marginX + signColW,
    y: signY + 4,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.45),
  });
  page.drawText('(Emergency Physician IC)', {
    x: marginX + signColW,
    y: signY - 4,
    size: 5.5,
    font: fontOblique,
    color: rgb(0.45, 0.5, 0.6),
  });

  page.drawText('Approved By: ___________________', {
    x: marginX + signColW * 2,
    y: signY + 4,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.3, 0.35, 0.45),
  });
  page.drawText('(Head of Department)', {
    x: marginX + signColW * 2,
    y: signY - 4,
    size: 5.5,
    font: fontOblique,
    color: rgb(0.45, 0.5, 0.6),
  });

  // Security hash
  const hashY = marginBottom;
  const hashNotice = `CONFIDENTIAL · HSAAS ED Timetable · Hash: ${payload.canonicalHash.slice(0, 16)}…`;
  page.drawText(hashNotice, {
    x: marginX,
    y: hashY,
    size: 5.5,
    font: fontRegular,
    color: rgb(0.5, 0.55, 0.6),
  });

  const pdfBytes = await doc.save();
  const pdfSha256 = await computeSha256Hex(pdfBytes);

  const verPadded = payload.snapshotVersion.toString().padStart(2, '0');
  const fileName = `ED_Duty_Roster_Timetable_${payload.period.year}-${payload.period.month.padStart(2, '0')}_v${verPadded}.pdf`;

  return {
    pdfBytes,
    pdfSha256,
    fileName,
  };
}
