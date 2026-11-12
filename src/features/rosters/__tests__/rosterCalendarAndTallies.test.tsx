import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RosterCalendarView } from '../components/RosterCalendarView';
import { RosterTallyTables } from '../components/RosterTallyTables';

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
    expect(screen.getByText(/MEDICAL OFFICER \(ON DUTY\)/i)).toBeInTheDocument();
    expect(screen.getByText(/EMERGENCY PHYSICIAN \(SPECIALIST\)/i)).toBeInTheDocument();

    // Verify MO and EP assignments for Day 1
    expect(screen.getAllByText('Dr Siti').length).toBeGreaterThan(0);
    expect(screen.getByText('Dr Tan')).toBeInTheDocument();
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
    expect(screen.queryByText(/Emergency Physician Quick Stamp & Painter/i)).toBeNull();

    // Enter Edit EP Mode
    const editEpBtn = screen.getByRole('button', { name: /Edit EP Schedule/i });
    fireEvent.click(editEpBtn);

    expect(screen.getByText(/Emergency Physician Quick Stamp & Painter/i)).toBeInTheDocument();

    // Select Dr Afif stamp
    const epStampBtn = screen.getByRole('button', { name: /Dr Afif/i });
    fireEvent.click(epStampBtn);

    expect(screen.getByText(/Active Stamp: Dr Afif/i)).toBeInTheDocument();

    // Batch fill weekdays
    const fillWeekdaysBtn = screen.getByRole('button', { name: /Fill Weekdays/i });
    fireEvent.click(fillWeekdaysBtn);

    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);

    // Done editing exits edit mode
    const doneBtn = screen.getByRole('button', { name: /Done Editing EP/i });
    fireEvent.click(doneBtn);
    expect(screen.queryByText(/Emergency Physician Quick Stamp & Painter/i)).toBeNull();
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

    expect(screen.getByText('📊 Shift Distribution Tally')).toBeInTheDocument();
    expect(screen.getByText(/AM Shift/i)).toBeInTheDocument();
    expect(screen.getByText(/PM Shift/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Duty/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Leave/i)).toBeInTheDocument();
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
    expect(screen.getByText('Total Worked')).toBeInTheDocument();
    expect(screen.getByText('Dr Afif')).toBeInTheDocument();
    expect(screen.getByText('Dr Siti')).toBeInTheDocument();
  });
});
