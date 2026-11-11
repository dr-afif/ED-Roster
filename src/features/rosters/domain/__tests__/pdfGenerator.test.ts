import { describe, expect, it } from 'vitest';
import {
  generateCalendarRosterPdf,
  generateRosterPdf,
  type CalendarRosterPdfPayload,
  type RosterPdfPayload,
} from '../pdfGenerator';

describe('Deterministic Roster PDF Generator (07_PDF_TELEGRAM_WORKFLOW.md)', () => {
  const samplePayload: RosterPdfPayload = {
    period: {
      year: '2027',
      month: '01',
      periodStart: '2027-01-01',
      revision: 1,
    },
    snapshotVersion: 1,
    snapshotType: 'initial',
    reason: null,
    predecessorVersion: null,
    staffList: [
      {
        id: 1,
        staffCode: 'MO-ADMIN',
        displayName: 'Dr Muhammad Afif',
        rosterName: 'Dr Afif',
        staffGroup: 'Medical Officer',
        active: true,
      },
      {
        id: 2,
        staffCode: 'MO-102',
        displayName: 'Dr Sarah Jenkins',
        rosterName: 'Dr Sarah',
        staffGroup: 'Medical Officer',
        active: true,
      },
    ],
    assignments: [
      { staffId: 1, dutyDate: '2027-01-01', shiftCode: 'AM' },
      { staffId: 1, dutyDate: '2027-01-02', shiftCode: 'PM' },
      { staffId: 1, dutyDate: '2027-01-03', shiftCode: 'ON' },
      { staffId: 1, dutyDate: '2027-01-04', shiftCode: 'PN' },
      { staffId: 1, dutyDate: '2027-01-05', shiftCode: 'OFF' },
      { staffId: 2, dutyDate: '2027-01-01', shiftCode: 'PM' },
      { staffId: 2, dutyDate: '2027-01-02', shiftCode: 'AM' },
      { staffId: 2, dutyDate: '2027-01-03', shiftCode: 'OFF' },
    ],
    shiftDefinitions: [
      {
        code: 'AM',
        label: 'Morning Shift (08:00 - 16:00)',
        short_label: 'AM',
        color_token: 'am',
        sort_order: 10,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        code: 'PM',
        label: 'Evening Shift (16:00 - 23:00)',
        short_label: 'PM',
        color_token: 'pm',
        sort_order: 20,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        code: 'ON',
        label: 'Night Duty (23:00 - 08:00)',
        short_label: 'ON',
        color_token: 'on',
        sort_order: 30,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        code: 'PN',
        label: 'Post Night (Transparent)',
        short_label: 'PN',
        color_token: 'pn',
        sort_order: 40,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        code: 'OFF',
        label: 'Rest Day (Weekly OFF)',
        short_label: 'OFF',
        color_token: 'off',
        sort_order: 50,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
    generatedAt: '2027-01-01 10:00:00',
    generatedBy: 'Dr Muhammad Afif',
    canonicalHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };

  it('generates landscape PDF bytes with valid filename and SHA-256', async () => {
    const result = await generateRosterPdf(samplePayload);

    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(result.pdfBytes.length).toBeGreaterThan(1000);
    expect(result.fileName).toBe('ED_Roster_2027-01_v01_Initial.pdf');
    expect(result.pdfSha256).toMatch(/^[a-f0-9]{64}$/);

    // Verify PDF header %PDF-1.
    const headerStr = new TextDecoder().decode(result.pdfBytes.slice(0, 5));
    expect(headerStr).toBe('%PDF-');
  });

  it('formats amendment filename with version padding and date label', async () => {
    const amendmentPayload: RosterPdfPayload = {
      ...samplePayload,
      snapshotVersion: 2,
      snapshotType: 'amendment',
      reason: 'Dr Sarah replacement for morning shift',
    };

    const result = await generateRosterPdf(amendmentPayload);
    expect(result.fileName).toBe('ED_Roster_2027-01_v02_Amendment_2027-01.pdf');
    expect(result.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates portrait Calendar Duty Schedule PDF with MO & EP coverage', async () => {
    const calendarPayload: CalendarRosterPdfPayload = {
      period: {
        year: '2027',
        month: '01',
        periodStart: '2027-01-01',
        revision: 1,
      },
      snapshotVersion: 1,
      snapshotType: 'initial',
      staffList: samplePayload.staffList,
      assignments: samplePayload.assignments,
      epAssignments: [
        {
          duty_date: '2027-01-01',
          slot_type: 'EP_OFFICE_HOUR',
          physician_names: 'Dr Afif',
        },
        {
          duty_date: '2027-01-01',
          slot_type: 'EP_ONCALL',
          physician_names: 'Dr Afif',
        },
      ],
      holidays: [{ date: '2027-01-01', name: "New Year's Day" }],
      generatedAt: '2027-01-01 10:00:00',
      canonicalHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    const result = await generateCalendarRosterPdf(calendarPayload);
    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(result.pdfBytes.length).toBeGreaterThan(1000);
    expect(result.fileName).toBe('ED_Duty_Roster_Timetable_2027-01_v01.pdf');
    expect(result.pdfSha256).toMatch(/^[a-f0-9]{64}$/);

    const headerStr = new TextDecoder().decode(result.pdfBytes.slice(0, 5));
    expect(headerStr).toBe('%PDF-');
  });
});
