import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffRequestsRoute, AdminRequestsRoute } from '../RequestsRoutes';
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

  it('renders personal request history with edit and delete options', async () => {
    renderStaffRequests();

    expect(screen.getByText(/Request History/i)).toBeInTheDocument();
    expect(screen.getAllByText(/OFF/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Family event/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
  });

  it('opens DateDetailPanel and submits a request when clicking a date cell', async () => {
    renderStaffRequests('owner');

    // Find date cell button
    const calendarCells = screen.getAllByRole('button', {
      name: /\d{1,2} [A-Z][a-z]+ \d{4}/i,
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
});
