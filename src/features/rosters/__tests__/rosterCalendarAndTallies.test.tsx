import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RosterCalendarView } from '../components/RosterCalendarView';
import { RosterTallyTables } from '../components/RosterTallyTables';
import { sortStaffByWorkMode, type StaffRosterIdentity } from '../domain/types';

describe('RosterCalendarView (Duty Timetable & EP Coverage)', () => {
  const periodDates = ['2027-01-01', '2027-01-02', '2027-01-03'];
  const staffList = [
    {
      id: 1,
      staffCode: 'MO-01',
      rosterName: 'Dr Afif',
      displayName: 'Dr Muhammad Afif',
      staffGroup: 'Emergency Physician',
      active: true,
    },
    {
      id: 2,
      staffCode: 'MO-02',
      rosterName: 'Dr Siti',
      displayName: 'Dr Siti Aminah',
      staffGroup: 'Medical Officer',
      active: true,
    },
    {
      id: 3,
      staffCode: 'MO-03',
      rosterName: 'Dr Tan',
      displayName: 'Dr Tan Wei',
      staffGroup: 'Medical Officer',
      active: true,
    },
  ];

  const assignments = [
    { staffId: 2, dutyDate: '2027-01-01', shiftCode: 'AM' },
    { staffId: 3, dutyDate: '2027-01-01', shiftCode: 'PM' },
    { staffId: 2, dutyDate: '2027-01-02', shiftCode: 'ND' },
  ];

  const epAssignments = [
    {
      id: 1,
      period_id: 1,
      duty_date: '2027-01-01',
      slot_type: 'EP_OFFICE_HOUR' as const,
      physician_names: 'Dr Afif',
      updated_at: '2027-01-01T00:00:00Z',
      updated_by: null,
    },
    {
      id: 2,
      period_id: 1,
      duty_date: '2027-01-01',
      slot_type: 'EP_ONCALL' as const,
      physician_names: 'Dr Afif',
      updated_at: '2027-01-01T00:00:00Z',
      updated_by: null,
    },
  ];

  const holidays = [{ date: '2027-01-01', name: "New Year's Day" }];

  it('renders calendar headers and daily duty assignments', () => {
    render(
      <RosterCalendarView
        periodDates={periodDates}
        staffList={staffList}
        assignments={assignments}
        epAssignments={epAssignments}
        holidays={holidays}
        isEditable={false}
      />,
    );

    expect(screen.getByText('DATE')).toBeInTheDocument();
    expect(screen.getByText('DAY')).toBeInTheDocument();
    expect(screen.getByText('MEDICAL OFFICER')).toBeInTheDocument();
    expect(screen.getByText('EMERGENCY PHYSICIAN')).toBeInTheDocument();

    // Verify MO and EP assignments for Day 1 (uppercase short names rendered)
    expect(screen.getAllByText('Siti').length).toBeGreaterThan(0);
    expect(screen.getByText('Tan')).toBeInTheDocument();
    expect(screen.getAllByText('Dr Afif').length).toBeGreaterThan(0);
    expect(screen.getByText("New Year's Day")).toBeInTheDocument();
  });

  it('requires entering Edit EP mode before showing toolbar or applying stamps', () => {
    const mockUpdate = vi.fn();
    const mockBatchUpdate = vi.fn();

    render(
      <RosterCalendarView
        periodDates={periodDates}
        staffList={staffList}
        assignments={assignments}
        epAssignments={epAssignments}
        holidays={holidays}
        isEditable={true}
        onUpdateEpAssignment={mockUpdate}
        onBatchUpdateEpAssignments={mockBatchUpdate}
      />,
    );

    // In default view mode, painter toolbar is NOT visible
    expect(screen.queryByText(/EP 1-Click Painter/i)).toBeNull();

    // Enter Edit EP Mode
    const editEpBtn = screen.getByRole('button', { name: /Edit EP/i });
    fireEvent.click(editEpBtn);

    expect(screen.getByText(/EP 1-Click Painter/i)).toBeInTheDocument();

    // Select Dr Afif stamp
    const epStampBtn = screen.getByRole('button', { name: /^Dr Afif$/i });
    fireEvent.click(epStampBtn);

    expect(screen.getByText(/Active: Dr Afif/i)).toBeInTheDocument();

    // Batch fill weekdays
    const fillWeekdaysBtn = screen.getByRole('button', { name: /Fill Weekdays \(OH\)/i });
    fireEvent.click(fillWeekdaysBtn);

    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);

    // Done editing exits edit mode
    const doneBtn = screen.getByRole('button', { name: /Done EP/i });
    fireEvent.click(doneBtn);
    expect(screen.queryByText(/EP 1-Click Painter/i)).toBeNull();
  });

  it('auto-saves and deselects an active EP inline edit cell when clicking outside', () => {
    const mockUpdate = vi.fn();

    render(
      <RosterCalendarView
        periodDates={periodDates}
        staffList={staffList}
        assignments={assignments}
        epAssignments={epAssignments}
        holidays={holidays}
        isEditable={true}
        onUpdateEpAssignment={mockUpdate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Edit EP/i }));

    // Open inline editor on the first EP Office Hour (AM) cell
    const ohCells = screen.getAllByTitle('Tap to add/remove EP Office Hour (AM)');
    const firstCell = ohCells[0];
    if (!firstCell) throw new Error('Expected at least one EP Office Hour cell');
    fireEvent.click(firstCell);

    const input = screen.getByPlaceholderText('Dr. ...');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Dr Nurul' } });

    // Click outside the active cell
    fireEvent.mouseDown(document.body);

    expect(mockUpdate).toHaveBeenCalledWith('2027-01-01', 'EP_OFFICE_HOUR', 'Dr Nurul');
    expect(screen.queryByPlaceholderText('Dr. ...')).toBeNull();
  });

  it('renders unified Printable Monthly Duty Roster Sheet without Daily Card Feed on mobile viewport', () => {
    const origInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    try {
      render(
        <RosterCalendarView
          periodDates={periodDates}
          staffList={staffList}
          assignments={assignments}
          epAssignments={epAssignments}
          holidays={holidays}
          isEditable={false}
        />,
      );

      expect(screen.getByText('MEDICAL OFFICER')).toBeInTheDocument();
      expect(screen.queryByText(/Daily Card Feed/i)).toBeNull();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: origInnerWidth,
      });
    }
  });
});

describe('RosterTallyTables (Daily Coverage & Member Tallies)', () => {
  const periodDates = ['2027-01-01', '2027-01-02', '2027-01-03'];
  const staffList = [
    {
      id: 1,
      staffCode: 'MO-01',
      rosterName: 'Dr Afif',
      displayName: 'Dr Muhammad Afif',
      staffGroup: 'Medical Officer',
      active: true,
    },
    {
      id: 2,
      staffCode: 'MO-02',
      rosterName: 'Dr Siti',
      displayName: 'Dr Siti Aminah',
      staffGroup: 'Medical Officer',
      active: true,
    },
  ];

  const assignments = [
    { staffId: 1, dutyDate: '2027-01-01', shiftCode: 'AM' },
    { staffId: 2, dutyDate: '2027-01-01', shiftCode: 'AM' },
    { staffId: 1, dutyDate: '2027-01-02', shiftCode: 'PM' },
    { staffId: 2, dutyDate: '2027-01-02', shiftCode: 'ND' },
    { staffId: 1, dutyDate: '2027-01-03', shiftCode: 'OFF' },
    { staffId: 2, dutyDate: '2027-01-03', shiftCode: 'AL' },
  ];

  it('renders Shift Distribution Tally and calculates shift counts', () => {
    render(
      <RosterTallyTables
        periodDates={periodDates}
        staffList={staffList}
        assignments={assignments}
      />,
    );

    expect(screen.getByText(/Shift Distribution Tally/i)).toBeInTheDocument();
    expect(screen.getByText(/AM Shift/i)).toBeInTheDocument();
    expect(screen.getByText(/PM Shift/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Duty/i)).toBeInTheDocument();
    expect(screen.getByText(/Post Night \(PN\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Leave/i)).toBeInTheDocument();
  });

  it('counts AMX toward AM, PMX toward PM, and separates PN from Night', () => {
    render(
      <RosterTallyTables
        periodDates={['2027-01-01']}
        staffList={[
          ...staffList,
          {
            id: 3,
            staffCode: 'MO-03',
            rosterName: 'Dr Lee',
            displayName: 'Dr Lee Wei',
            staffGroup: 'Medical Officer',
            active: true,
          },
          {
            id: 4,
            staffCode: 'MO-04',
            rosterName: 'Dr Tan',
            displayName: 'Dr Tan Mei',
            staffGroup: 'Medical Officer',
            active: true,
          },
        ]}
        assignments={[
          { staffId: 1, dutyDate: '2027-01-01', shiftCode: 'AMX' },
          { staffId: 2, dutyDate: '2027-01-01', shiftCode: 'PMX' },
          { staffId: 3, dutyDate: '2027-01-01', shiftCode: 'ON1' },
          { staffId: 4, dutyDate: '2027-01-01', shiftCode: 'PN' },
        ]}
      />,
    );

    const amRow = screen.getByText(/AM Shift/i).closest('tr');
    const pmRow = screen.getByText(/PM Shift/i).closest('tr');
    const nightRow = screen.getByText(/Night Duty/i).closest('tr');
    const pnRow = screen.getByText(/Post Night \(PN\)/i).closest('tr');

    expect(amRow).toHaveTextContent('1⚠');
    expect(pmRow).toHaveTextContent('1⚠');
    expect(nightRow).toHaveTextContent('1⚠');
    expect(pnRow).toHaveTextContent('1');
  });

  it('allows expanding Individual Member Shift Tally to inspect member workload', () => {
    render(
      <RosterTallyTables
        periodDates={periodDates}
        staffList={staffList}
        assignments={assignments}
      />,
    );

    const toggleBtn = screen.getByRole('button', { name: /Individual Member Shift Tally/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Doctor Name')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Total\s*Worked/i })).toBeInTheDocument();
    expect(screen.getByText('Dr Afif')).toBeInTheDocument();
    expect(screen.getByText('Dr Siti')).toBeInTheDocument();
  });

  it('shows OH-Clinical OH shifts in MO AM column and excludes OH-Non-Clinical in RosterCalendarView', () => {
    const mixedStaff: StaffRosterIdentity[] = [
      {
        id: 10,
        staffCode: 'MO-10',
        displayName: 'Dr NonClin',
        rosterName: 'Dr NonClin',
        staffGroup: 'MO | Office Hour (Non-Clinical)',
        active: true,
      },
      {
        id: 11,
        staffCode: 'MO-11',
        displayName: 'Dr ClinOH',
        rosterName: 'Dr ClinOH',
        staffGroup: 'MO | Office Hour (Clinical)',
        active: true,
      },
      {
        id: 12,
        staffCode: 'MO-12',
        displayName: 'Dr ShiftMO',
        rosterName: 'Dr ShiftMO',
        staffGroup: 'MO | Shift',
        active: true,
      },
    ];

    const sorted = sortStaffByWorkMode(mixedStaff);
    expect(sorted.map((s) => s.id)).toEqual([12, 11, 10]);

    render(
      <RosterCalendarView
        periodDates={['2027-01-01']}
        staffList={sorted}
        assignments={[
          { staffId: 10, dutyDate: '2027-01-01', shiftCode: 'OH' },
          { staffId: 11, dutyDate: '2027-01-01', shiftCode: 'OH' },
        ]}
        epAssignments={[]}
        holidays={[]}
        isEditable={false}
      />,
    );

    expect(screen.getByText('ClinOH')).toBeInTheDocument();
    expect(screen.queryByText('NonClin')).toBeNull();
  });
});
