import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffRequestsRoute, AdminRequestsRoute } from '../RequestsRoutes';
import { NewRequestForm } from '../components/NewRequestForm';
import { getRequestPillClasses, getRequestVariant } from '../requestTone';
import { AuthContext, type AuthBoundaryState } from '@/platform/auth/authContext';
import {
  buildUsageByDateAndGroup,
  buildLimitGroupIdByShiftType,
  buildLimitGroupById,
  getLimitStatusForType,
  getMonthlyRequestCount,
  DEFAULT_LIMIT_GROUPS,
  DEFAULT_SHIFT_TYPES,
  toIsoDate,
} from '../domain/quota';

const mockSubmitMutateAsync = vi.fn().mockResolvedValue({});
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(true);

vi.mock('../useRequests', () => ({
  useAllRequestsQuery: () => ({
    data: [
      {
        id: 1,
        public_id: 'req-1',
        staff_id: 1,
        name: 'Dr Afif',
        date: '2026-12-15',
        request: 'OFF',
        comment: 'Family event',
        status: 'active',
      },
      {
        id: 2,
        public_id: 'req-2',
        staff_id: 2,
        name: 'Dr Sarah',
        date: '2026-12-15',
        request: 'AM',
        comment: null,
        status: 'active',
      },
    ],
    isLoading: false,
    error: null,
  }),
  useTeamMembersQuery: () => ({
    data: [
      {
        id: 1,
        staff_code: 'MO-ADMIN',
        roster_name: 'Dr Afif',
        display_name: 'Dr Muhammad Afif',
        active: true,
      },
      {
        id: 2,
        staff_code: 'MO-002',
        roster_name: 'Dr Sarah',
        display_name: 'Dr Sarah Jenkins',
        active: true,
      },
    ],
    isLoading: false,
    error: null,
  }),
  usePublicHolidaysQuery: () => ({
    data: [
      { id: 1, holiday_date: '2026-12-25', name: 'Christmas Day' },
      { id: 2, holiday_date: '2027-01-01', name: "New Year's Day" },
    ],
    isLoading: false,
    error: null,
  }),
  useRequestShiftDefinitionsQuery: () => ({
    data: [
      { code: 'AM', is_active: true },
      { code: 'PM', is_active: true },
      { code: 'ON', is_active: true },
      { code: 'ON1', is_active: true },
      { code: 'ON2', is_active: true },
      { code: 'NIGHT', is_active: true },
      { code: 'ND', is_active: true },
      { code: 'PN', is_active: true },
      { code: 'OFF', is_active: true },
      { code: 'GOFF', is_active: true },
      { code: 'AL', is_active: true },
      { code: 'MC', is_active: true },
      { code: 'EL', is_active: true },
      { code: 'HKA', is_active: true },
      { code: 'GHKA', is_active: true },
      { code: 'COURSE', is_active: true },
    ],
    isLoading: false,
    error: null,
  }),
  useSubmitRequestMutation: () => ({
    mutateAsync: mockSubmitMutateAsync,
    isPending: false,
  }),
  useDeleteRequestMutation: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  }),
}));

function renderStaffRequests(userRole: 'staff' | 'owner' = 'staff') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const authState: AuthBoundaryState = {
    status: 'authenticated',
    user: {
      authUserId: 'test-user-uuid',
      email: 'dr.afif@example.com',
      role: userRole,
      staffId: 1,
      staffCode: 'MO-ADMIN',
      displayName: 'Dr Muhammad Afif',
      rosterName: 'Dr Afif',
    },
    unapprovedReason: null,
    unapprovedEmail: null,
    errorMessage: null,
    retryBootstrap: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authState}>
          <StaffRequestsRoute />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('StaffRequestsRoute (Live-Aligned Workflow)', () => {
  it('renders request panel header, view switcher, and calendar', async () => {
    renderStaffRequests();

    expect(screen.getByText(/Request Panel/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Displaying active requests made by team members/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calendar View/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Table View/i })).toBeInTheDocument();
    expect(screen.getByText(/Roster Calendar/i)).toBeInTheDocument();
  });

  it('toggles between Calendar View and Table View', async () => {
    renderStaffRequests();

    // Switch to Table View
    fireEvent.click(screen.getByRole('button', { name: /Table View/i }));
    expect(screen.getByText(/Roster Table View/i)).toBeInTheDocument();
    expect(screen.getByText(/Dr Afif/i)).toBeInTheDocument();
    expect(screen.getByText(/Dr Sarah/i)).toBeInTheDocument();

    // Switch back to Calendar View
    fireEvent.click(screen.getByRole('button', { name: /Calendar View/i }));
    expect(screen.getByText(/Roster Calendar/i)).toBeInTheDocument();
  });

  it('renders personal request history with edit and delete options when window is open', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T10:00:00+08:00'));
    try {
      renderStaffRequests();

      fireEvent.click(screen.getByRole('button', { name: /My List/i }));

      expect(screen.getByText(/Request History/i)).toBeInTheDocument();
      expect(screen.getAllByText(/OFF/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Family event/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('locks staff edit/delete actions after the monthly cutoff day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-26T10:00:00+08:00'));
    try {
      renderStaffRequests('staff');

      expect(screen.getByText(/Request CLOSED for December 2026/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /My List/i }));
      expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens DateDetailPanel and submits a request when clicking a date cell', async () => {
    renderStaffRequests('owner');

    // Find date cell button
    const calendarCells = screen.getAllByRole('button', {
      name: /(?:\d{1,2} [A-Z][a-z]+ \d{4}|[A-Z][a-z]+ \d{1,2}, \d{4})/i,
    });
    expect(calendarCells.length).toBeGreaterThan(0);

    const targetCell = calendarCells[0];
    expect(targetCell).toBeDefined();
    if (targetCell) {
      fireEvent.click(targetCell);
    }

    // Side panel should be open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 3, name: /Add a Request/i })).toBeInTheDocument();
    expect(screen.getByText(/Submit on behalf of:/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin Mode: Full Shift Catalog/i)).toBeInTheDocument();

    // Verify admin has access to extra departmental shift options like MC and GOFF
    expect(screen.getByRole('button', { name: /^MC/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^GOFF/i })).toBeInTheDocument();

    // Choose PM shift
    const pmButton = screen.getByRole('button', { name: /^PM/i });
    fireEvent.click(pmButton);

    // Save request
    const saveButton = screen.getByRole('button', { name: /Save Request/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSubmitMutateAsync).toHaveBeenCalled();
    });
  });

  it('allows owner to access via AdminRequestsRoute identically', () => {
    const queryClient = new QueryClient();
    const authState: AuthBoundaryState = {
      status: 'authenticated',
      user: {
        authUserId: 'owner-uuid',
        email: 'dr.afif@example.com',
        role: 'owner',
        staffId: 1,
        staffCode: 'MO-ADMIN',
        displayName: 'Dr Muhammad Afif',
        rosterName: 'Dr Afif',
      },
      unapprovedReason: null,
      unapprovedEmail: null,
      errorMessage: null,
      retryBootstrap: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    };

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={authState}>
            <AdminRequestsRoute />
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Request Panel/i)).toBeInTheDocument();
  });
});

describe('Quota and Limit Domain Logic', () => {
  it('correctly calculates daily limit capping for OFF group', () => {
    const limitGroupById = buildLimitGroupById(DEFAULT_LIMIT_GROUPS);
    const limitGroupIdByShiftType = buildLimitGroupIdByShiftType(DEFAULT_SHIFT_TYPES);

    const testRequests = [
      { name: 'Dr A', date: '2026-12-10', request: 'OFF', status: 'active' },
      { name: 'Dr B', date: '2026-12-10', request: 'AL', status: 'active' },
      { name: 'Dr C', date: '2026-12-10', request: 'HKA', status: 'active' },
    ];

    const usage = buildUsageByDateAndGroup(testRequests, limitGroupIdByShiftType);

    const statusAtLimit = getLimitStatusForType({
      type: 'OFF',
      date: '2026-12-10',
      limitGroupIdByShiftType,
      limitGroupById,
      usageByDateAndGroup: usage,
    });

    expect(statusAtLimit.isLimited).toBe(true);
    expect(statusAtLimit.usage).toBe(3);
    expect(statusAtLimit.limit).toBe(3);
    expect(statusAtLimit.isAtLimit).toBe(true);

    const statusUncapped = getLimitStatusForType({
      type: 'AM',
      date: '2026-12-10',
      limitGroupIdByShiftType,
      limitGroupById,
      usageByDateAndGroup: usage,
    });

    expect(statusUncapped.isLimited).toBe(false);
  });

  it('counts monthly requests for staff', () => {
    const testRequests = [
      { name: 'Dr Afif', date: '2026-12-01', request: 'OFF', status: 'active' },
      { name: 'Dr Afif', date: '2026-12-05', request: 'AM', status: 'active' },
      { name: 'Dr Other', date: '2026-12-05', request: 'PM', status: 'active' },
    ];

    const count = getMonthlyRequestCount({
      requests: testRequests,
      targetName: 'Dr Afif',
      dateString: '2026-12-15',
    });

    expect(count).toBe(2);
  });

  it('normalizes ISO dates reliably', () => {
    expect(toIsoDate('2026-12-25')).toBe('2026-12-25');
    expect(toIsoDate(new Date(2026, 11, 25))).toBe('2026-12-25');
  });

  it('caps ON1 at 1/day and includes GHKA and COURSE inside the 3/day OFF group', () => {
    const limitGroupById = buildLimitGroupById(DEFAULT_LIMIT_GROUPS);
    const limitGroupIdByShiftType = buildLimitGroupIdByShiftType(DEFAULT_SHIFT_TYPES);

    const testRequests = [
      { name: 'Dr A', date: '2027-01-10', request: 'ON1', status: 'active' },
      { name: 'Dr B', date: '2027-01-10', request: 'OFF', status: 'active' },
      { name: 'Dr C', date: '2027-01-10', request: 'GHKA', status: 'active' },
      { name: 'Dr D', date: '2027-01-10', request: 'COURSE', status: 'active' },
    ];

    const usage = buildUsageByDateAndGroup(testRequests, limitGroupIdByShiftType);

    const on1Status = getLimitStatusForType({
      type: 'ON1',
      date: '2027-01-10',
      limitGroupIdByShiftType,
      limitGroupById,
      usageByDateAndGroup: usage,
    });
    expect(on1Status.isLimited).toBe(true);
    expect(on1Status.limit).toBe(1);
    expect(on1Status.usage).toBe(1);
    expect(on1Status.isAtLimit).toBe(true);

    const offGroupStatus = getLimitStatusForType({
      type: 'GHKA',
      date: '2027-01-10',
      limitGroupIdByShiftType,
      limitGroupById,
      usageByDateAndGroup: usage,
    });
    expect(offGroupStatus.isLimited).toBe(true);
    expect(offGroupStatus.limit).toBe(3);
    expect(offGroupStatus.usage).toBe(3);
    expect(offGroupStatus.isAtLimit).toBe(true);
  });
});

describe('NewRequestForm Fair Queue & Replacement Confirmation', () => {
  const baseRequests = [
    {
      id: 10,
      staff_id: 1,
      name: 'Dr Afif',
      date: '2026-12-15',
      request: 'OFF',
      comment: 'Initial note',
      status: 'active',
    },
  ];

  function renderForm(
    initialValues?: {
      id?: number | string;
      date?: string;
      request?: string;
      comment?: string | null;
      name?: string;
      staffId?: number;
    } | null,
    onSubmit = vi.fn().mockResolvedValue(undefined),
  ) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return {
      onSubmit,
      ...render(
        <QueryClientProvider client={queryClient}>
          <NewRequestForm
            selectedName="Dr Afif"
            selectedStaffId={1}
            initialValues={initialValues}
            requests={baseRequests}
            onSubmit={onSubmit}
          />
        </QueryClientProvider>,
      ),
    };
  }

  it('prompts for confirmation when creating a new request on a date with an existing request', async () => {
    const { onSubmit } = renderForm({ date: '2026-12-15' });

    fireEvent.click(screen.getByRole('button', { name: /^AM$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Request/i }));

    expect(await screen.findByText(/Replace Existing Request\?/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Replace/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id: undefined,
        staffId: 1,
        date: '2026-12-15',
        request: 'AM',
        comment: '',
      });
    });
  });

  it('submits comment-only edits immediately without a confirmation popup', async () => {
    const { onSubmit } = renderForm({
      id: 10,
      staffId: 1,
      date: '2026-12-15',
      request: 'OFF',
      comment: 'Initial note',
    });

    const textarea = screen.getByPlaceholderText(/Add context for this request/i);
    fireEvent.change(textarea, { target: { value: 'Updated comment only' } });
    fireEvent.click(screen.getByRole('button', { name: /Update Request/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id: 10,
        staffId: 1,
        date: '2026-12-15',
        request: 'OFF',
        comment: 'Updated comment only',
      });
    });
    expect(screen.queryByText(/Confirm Request Change/i)).not.toBeInTheDocument();
  });

  it('supports manual override after cutoff and auto-expires next month', async () => {
    const { isRequestWindowEffectivelyOpen } = await import('@/shared/ui');
    const nov26 = new Date('2026-11-26T10:00:00+08:00');
    const dec01 = new Date('2026-12-01T10:00:00+08:00');
    const nov15 = new Date('2026-11-15T10:00:00+08:00');

    expect(isRequestWindowEffectivelyOpen(true, 25, null, nov15)).toBe(true);
    expect(isRequestWindowEffectivelyOpen(false, 25, null, nov15)).toBe(false);
    expect(isRequestWindowEffectivelyOpen(true, 25, null, nov26)).toBe(false);
    expect(isRequestWindowEffectivelyOpen(true, 25, '2026-11', nov26)).toBe(true);
    expect(isRequestWindowEffectivelyOpen(true, 25, '2026-11', dec01)).toBe(true);
    expect(isRequestWindowEffectivelyOpen(true, 25, '2026-10', nov26)).toBe(false);
  });

  it('prompts for confirmation when changing the shift type of an existing request', async () => {
    const { onSubmit } = renderForm({
      id: 10,
      staffId: 1,
      date: '2026-12-15',
      request: 'OFF',
      comment: 'Initial note',
    });

    fireEvent.click(screen.getByRole('button', { name: /^PM$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Update Request/i }));

    expect(await screen.findByText(/Confirm Request Change/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Confirm Change/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id: 10,
        staffId: 1,
        date: '2026-12-15',
        request: 'PM',
        comment: 'Initial note',
      });
    });
  });
});

describe('Request Page Shift Pill Colour Coding', () => {
  it('keeps AM, ON1, and OFF colours unchanged', () => {
    expect(getRequestVariant('AM')).toBe('req--am');
    expect(getRequestPillClasses('AM')).toContain('bg-[#E5EED8]');

    expect(getRequestVariant('ON1')).toBe('req--night');
    expect(getRequestPillClasses('ON1')).toContain('bg-[#FCE7F1]');

    expect(getRequestVariant('OFF')).toBe('req--off');
    expect(getRequestPillClasses('OFF')).toContain('bg-[#F5F5F4]');
  });

  it('uses yellow for PM, orange for Course, and purple for other Leaves', () => {
    expect(getRequestVariant('PM')).toBe('req--pm');
    expect(getRequestPillClasses('PM')).toContain('bg-[#FEF9C3]');
    expect(getRequestPillClasses('PM')).toContain('text-[#854D0E]');

    for (const courseCode of ['COURSE', 'COURT', 'MEDSB']) {
      expect(getRequestVariant(courseCode)).toBe('req--course');
      expect(getRequestPillClasses(courseCode)).toContain('bg-[#FFEDD5]');
      expect(getRequestPillClasses(courseCode)).toContain('text-[#9A3412]');
    }

    for (const leaveCode of ['AL', 'EL', 'MC', 'HKA', 'GHKA', 'LEAVE']) {
      expect(getRequestVariant(leaveCode)).toBe('req--leave');
      expect(getRequestPillClasses(leaveCode)).toContain('bg-[#F3E8FF]');
      expect(getRequestPillClasses(leaveCode)).toContain('text-[#6B21A8]');
    }
  });

  it('applies the updated pill classes to rendered NewRequestForm shift buttons', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <NewRequestForm
          selectedName="Dr Afif"
          selectedStaffId={1}
          requests={[]}
          onSubmit={vi.fn().mockResolvedValue(undefined)}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: /^AM$/i })).toHaveClass('bg-[#E5EED8]');
    expect(screen.getByRole('button', { name: /^ON1$/i })).toHaveClass('bg-[#FCE7F1]');
    expect(screen.getByRole('button', { name: /^OFF$/i })).toHaveClass('bg-[#F5F5F4]');
    expect(screen.getByRole('button', { name: /^PM$/i })).toHaveClass('bg-[#FEF9C3]');
    expect(screen.getByRole('button', { name: /^COURSE$/i })).toHaveClass('bg-[#FFEDD5]');
    expect(screen.getByRole('button', { name: /^AL$/i })).toHaveClass('bg-[#F3E8FF]');
    expect(screen.getByRole('button', { name: /^HKA$/i })).toHaveClass('bg-[#F3E8FF]');
    expect(screen.getByRole('button', { name: /^GHKA$/i })).toHaveClass('bg-[#F3E8FF]');
  });
});
