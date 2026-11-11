import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RosterPeriodRoute } from '../routes/RosterPeriodRoute';
import { AuthContext, type AuthBoundaryState } from '@/platform/auth/authContext';

const mockUpsertMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('../data/rosterQueries', () => ({
  useRosterPeriodQuery: () => ({
    data: {
      id: 1,
      period_start: '2027-01-01',
      period_end: '2027-01-31',
      status: 'draft',
      revision: 3,
      active_rule_version_id: 1,
    },
    isLoading: false,
    error: null,
  }),
  useRosterStaffQuery: () => ({
    data: [
      {
        id: 1,
        staffCode: 'MO-01',
        rosterName: 'Dr Afif',
        displayName: 'Dr Muhammad Afif',
        staffGroup: 'medical_officer',
        active: true,
      },
      {
        id: 2,
        staffCode: 'MO-02',
        rosterName: 'Dr Siti',
        displayName: 'Dr Siti Aminah',
        staffGroup: 'medical_officer',
        active: true,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useShiftDefinitionsQuery: () => ({
    data: [
      {
        code: 'AM',
        label: 'Morning Shift',
        short_label: 'AM',
        color_token: 'am',
        sort_order: 10,
        is_active: true,
      },
      {
        code: 'PM',
        label: 'Evening Shift',
        short_label: 'PM',
        color_token: 'pm',
        sort_order: 20,
        is_active: true,
      },
      {
        code: 'ON',
        label: 'Night Duty',
        short_label: 'ON',
        color_token: 'on',
        sort_order: 30,
        is_active: true,
      },
      {
        code: 'PN',
        label: 'Post Night',
        short_label: 'PN',
        color_token: 'pn',
        sort_order: 40,
        is_active: true,
      },
      {
        code: 'OFF',
        label: 'Weekly OFF',
        short_label: 'OFF',
        color_token: 'off',
        sort_order: 50,
        is_active: true,
      },
      {
        code: 'AL',
        label: 'Annual Leave',
        short_label: 'AL',
        color_token: 'al',
        sort_order: 60,
        is_active: true,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useShiftSemanticsQuery: () => ({
    data: [
      {
        shift_code: 'AM',
        semantic_class: 'worked',
        provides_coverage: true,
        night_policy_b_qualifying: false,
        displaces_off_earns_goff: false,
      },
      {
        shift_code: 'PM',
        semantic_class: 'worked',
        provides_coverage: true,
        night_policy_b_qualifying: false,
        displaces_off_earns_goff: false,
      },
      {
        shift_code: 'ON',
        semantic_class: 'worked',
        provides_coverage: true,
        night_policy_b_qualifying: true,
        displaces_off_earns_goff: false,
      },
      {
        shift_code: 'PN',
        semantic_class: 'transparent',
        provides_coverage: false,
        night_policy_b_qualifying: true,
        displaces_off_earns_goff: false,
      },
      {
        shift_code: 'OFF',
        semantic_class: 'reset',
        provides_coverage: false,
        night_policy_b_qualifying: false,
        displaces_off_earns_goff: false,
      },
      {
        shift_code: 'AL',
        semantic_class: 'reset',
        provides_coverage: false,
        night_policy_b_qualifying: false,
        displaces_off_earns_goff: false,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useRuleVersionQuery: () => ({
    data: {
      id: 1,
      version: 1,
      rule_set_id: 'ed_default',
      status: 'active',
      effective_from: '2026-01-01',
      config: {
        schema_version: 1,
        weekly_off_policy: 'policy_b',
        max_consecutive_days: 6,
        consecutive_warning_threshold: 7,
        night_qualifying_codes: ['ON', 'PN'],
        request_daily_off_limit: 3,
        request_monthly_limit: 10,
        request_weekend_limit: 4,
        min_rest_hours_after_night: 24,
      },
    },
    isLoading: false,
    error: null,
  }),
  useStaffingThresholdsQuery: () => ({
    data: [
      {
        id: 1,
        rule_version_id: 1,
        day_type: 'weekday',
        shift_bucket: 'am',
        min_staff: 1,
        target_staff: 2,
      },
      {
        id: 2,
        rule_version_id: 1,
        day_type: 'weekday',
        shift_bucket: 'pm',
        min_staff: 1,
        target_staff: 2,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useDraftAssignmentsQuery: () => ({
    data: [
      {
        id: 101,
        period_id: 1,
        staff_id: 1,
        duty_date: '2027-01-04',
        shift_code: 'AM',
        row_revision: 1,
      },
      {
        id: 102,
        period_id: 1,
        staff_id: 2,
        duty_date: '2027-01-04',
        shift_code: 'PM',
        row_revision: 1,
      },
    ],
    isLoading: false,
    isFetching: false,
    error: null,
  }),
  usePublicHolidaysQuery: () => ({
    data: [{ holiday_date: '2027-01-01', name: "New Year's Day" }],
    isLoading: false,
    error: null,
  }),
  useUpsertDraftAssignmentMutation: () => ({
    mutate: mockUpsertMutate,
    isPending: false,
  }),
  useDeleteDraftAssignmentMutation: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
  usePlannedAssignmentsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useAmendmentEventsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  usePublishRosterMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSubmitAmendmentMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useReverseAmendmentMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCloseRosterMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useReopenRosterMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function renderRosterWorkspace(userRole: 'owner' | 'staff' = 'owner') {
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
      staffCode: 'MO-01',
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
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/rosters/2027/01']}>
          <Routes>
            <Route path="rosters/:yyyy/:mm" element={<RosterPeriodRoute />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('RosterPeriodRoute (Draft Workspace & Rules Engine UI)', () => {
  it('renders January 2027 header, status badge, and policy info', () => {
    renderRosterWorkspace('owner');

    expect(screen.getByRole('heading', { level: 1, name: /January 2027 Roster/i })).toBeDefined();
    expect(screen.getByText('DRAFT')).toBeDefined();
    expect(screen.getByText(/Policy B \(Nights: 1 OFF \/ No Nights: 2 OFFs\)/i)).toBeDefined();
    expect(screen.getByText('Dr Afif')).toBeDefined();
    expect(screen.getByText('Dr Siti')).toBeDefined();
  });

  it('renders density switcher and search filter', () => {
    renderRosterWorkspace('owner');

    const searchInput = screen.getByPlaceholderText(/search staff/i);
    expect(searchInput).toBeDefined();

    // Filter to Dr Siti
    fireEvent.change(searchInput, { target: { value: 'Siti' } });
    expect(screen.getByText('Dr Siti')).toBeDefined();
    expect(screen.queryByText('Dr Afif')).toBeNull();

    // Clear filter
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByText('Dr Afif')).toBeDefined();
  });

  it('renders rules guidance panel with live issues', () => {
    renderRosterWorkspace('owner');

    expect(screen.getByText(/Rules Engine Guidance/i)).toBeDefined();
  });

  it('opens ShiftPickerModal when clicking a cell as owner and assigns a shift', () => {
    renderRosterWorkspace('owner');

    // Find the cell with 'AM'
    const amCell = screen.getByTitle(/Dr Afif on 2027-01-04: AM/i);
    fireEvent.click(amCell);

    // Modal opens
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: /Assign Shift/i })).toBeDefined();
    expect(screen.getByText(/Dr Afif \(MO-01\) · 2027-01-04/i)).toBeDefined();

    // Click 'PM' pill
    const pmButton = screen.getByRole('button', { name: /^PM/i });
    fireEvent.click(pmButton);

    expect(mockUpsertMutate).toHaveBeenCalledWith({
      staffId: 1,
      dutyDate: '2027-01-04',
      shiftCode: 'PM',
    });
  });

  it('renders Publish Roster button for owner in draft mode and opens PublishModal', () => {
    renderRosterWorkspace('owner');

    const publishBtn = screen.getByRole('button', { name: /Publish Roster/i });
    expect(publishBtn).toBeDefined();

    fireEvent.click(publishBtn);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: /Publish January 2027 Roster/i }),
    ).toBeDefined();
    expect(screen.getByText(/Atomic Publication Invariant/i)).toBeDefined();
  });
});
