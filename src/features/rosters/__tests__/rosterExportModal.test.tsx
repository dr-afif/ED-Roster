import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RosterExportModal } from '../components/RosterExportModal';
import { buildPrintDocument } from '../domain/livePdfExport';

describe('RosterExportModal & livePdfExport', () => {
  const dummyStaff = [
    {
      id: 1,
      staffCode: 'MO-01',
      displayName: 'Dr Afif',
      rosterName: 'Dr Afif',
      role: 'owner' as const,
      isRosterEligible: true,
      active: true,
      seniorityRank: 1,
      staffGroup: 'mo' as const,
    },
    {
      id: 2,
      staffCode: 'MO-02',
      displayName: 'Dr Siti',
      rosterName: 'Dr Siti',
      role: 'member' as const,
      isRosterEligible: true,
      active: true,
      seniorityRank: 2,
      staffGroup: 'mo' as const,
    },
  ];

  const dummyAssignments = [
    { staffId: 1, dutyDate: '2027-01-01', shiftCode: 'AM' },
    { staffId: 2, dutyDate: '2027-01-01', shiftCode: 'PM' },
  ];

  const dummyShifts = [
    {
      code: 'AM',
      label: 'Morning Shift',
      short_label: 'AM',
      color_token: 'emerald',
      sort_order: 1,
      is_active: true,
      start_time: '08:00',
      end_time: '16:00',
      duration_hours: 8,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      code: 'PM',
      label: 'Evening Shift',
      short_label: 'PM',
      color_token: 'amber',
      sort_order: 2,
      is_active: true,
      start_time: '16:00',
      end_time: '23:00',
      duration_hours: 7,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  it('renders modal with layout selectors, header fields, and signatures', () => {
    const handleClose = vi.fn();
    render(
      <RosterExportModal
        isOpen={true}
        onClose={handleClose}
        periodYear="2027"
        periodMonth="01"
        periodStart="2027-01-01"
        periodRevision={0}
        staffList={dummyStaff}
        assignments={dummyAssignments}
        shiftDefinitions={dummyShifts}
      />,
    );

    expect(screen.getByRole('heading', { name: /Roster PDF Export & Print/i })).toBeDefined();
    expect(screen.getByText(/Staff Spreadsheet \(Landscape A4\)/i)).toBeDefined();
    expect(screen.getByText(/Daily Coverage Schedule \(Portrait A4\)/i)).toBeDefined();
    expect(screen.getByText(/Official Sign-Off Panels/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Print \/ Live Layout/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Download \.pdf/i })).toBeDefined();
  });

  it('switches document layouts when clicking layout cards', async () => {
    const user = userEvent.setup();
    render(
      <RosterExportModal
        isOpen={true}
        onClose={vi.fn()}
        periodYear="2027"
        periodMonth="01"
        periodStart="2027-01-01"
        periodRevision={0}
        staffList={dummyStaff}
        assignments={dummyAssignments}
        shiftDefinitions={dummyShifts}
      />,
    );

    const dailyScheduleCard = screen.getByText(/Daily Coverage Schedule \(Portrait A4\)/i);
    await user.click(dailyScheduleCard);

    // Verify modal remains open and responsive
    expect(screen.getByRole('button', { name: /Print \/ Live Layout/i })).toBeDefined();
  });

  it('generates HTML print document with department header and signature blocks', () => {
    const html = buildPrintDocument({
      mainTitle: 'HOSPITAL SULTAN ABDUL AZIZ SHAH (HSAAS)',
      rosterType: 'MO ROSTER',
      monthYear: 'JANUARY 2027',
      version: 'FINAL',
      preparedBy: 'Dr Muhammad Afif',
      checkedBy: 'Emergency Physician IC',
      approvedBy: 'Head of Department',
      spreadsheetDays: [
        { dateStr: '2027-01-01', dayNum: 1, dayName: 'FRI', holidayName: "New Year's Day" },
      ],
      spreadsheetDoctors: [
        { name: 'Dr Afif', shifts: { '2027-01-01': { value: 'AM' } } },
      ],
    });

    expect(html).toContain('HOSPITAL SULTAN ABDUL AZIZ SHAH (HSAAS)');
    expect(html).toContain('MO ROSTER');
    expect(html).toContain('JANUARY 2027 FINAL');
    expect(html).toContain('Dr Muhammad Afif');
    expect(html).toContain('Emergency Physician IC');
    expect(html).toContain('Head of Department');
    expect(html).toContain("New Year&#39;s Day");
    expect(html).toContain('shift-cell-am');
  });
});
