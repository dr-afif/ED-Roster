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
