import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RosterPeriodRoute } from '../routes/RosterPeriodRoute';
import { AuthContext, type AuthBoundaryState } from '@/platform/auth/authContext';
import type { AmendmentEvent } from '../domain/types';

const mockSubmitAmendment = vi.fn();
const mockReverseAmendment = vi.fn();
const mockCloseRoster = vi.fn();
const mockReopenRoster = vi.fn();

const mockActiveEvents: AmendmentEvent[] = [
  {
    id: 1,
    periodId: 1,
    category: 'absence_plus_replacement',
    reason: 'Medical Leave covered by Dr Siti',
    status: 'active',
    createdAt: '2027-01-10T08:00:00Z',
    lines: [
      {
        staffId: 1,
        dutyDate: '2027-01-12',
        lineAction: 'absent',
        fromShiftCode: 'AM',
        toShiftCode: 'MC',
        notes: 'MC day 1',
      },
      {
        staffId: 2,
        dutyDate: '2027-01-12',
        lineAction: 'replace',
        fromShiftCode: 'OFF',
        toShiftCode: 'AM',
        notes: 'Covering Dr Afif',
      },
    ],
  },
];

vi.mock('../data/rosterQueries', () => ({
  useRosterPeriodQuery: () => ({
    data: {
      id: 1,
      period_start: '2027-01-01',
      period_end: '2027-01-31',
      status: 'published',
      revision: 5,
      active_rule_version_id: 1,
    },
    isLoading: false,
    error: null,
  }),
  useAllRosterPeriodsQuery: () => ({
    data: [
      {
        id: 1,
        period_start: '2027-01-01',
        period_end: '2027-01-31',
        status: 'published',
        revision: 5,
        legacy_read_only: false,
      },
    ],
    isLoading: false,
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
        code: 'MC',
        label: 'Medical Leave',
        short_label: 'MC',
        color_token: 'mc',
        sort_order: 60,
        is_active: true,
      },
      {
        code: 'EL',
        label: 'Emergency Leave',
        short_label: 'EL',
        color_token: 'el',
        sort_order: 70,
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
        shift_code: 'MC',
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
      status: 'active',
      config: {
        schema_version: 1,
        weekly_off_policy: 'policy_b',
        max_consecutive_days: 6,
        consecutive_warning_threshold: 7,
      },
    },
    isLoading: false,
    error: null,
  }),
  useStaffingThresholdsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useDraftAssignmentsQuery: () => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
  }),
  usePlannedAssignmentsQuery: () => ({
    data: [
      {
        id: 1,
        publication_id: 'pub-1',
        period_id: 1,
        staff_id: 1,
        duty_date: '2027-01-12',
        shift_code: 'AM',
        cell_note: null,
        created_at: '2027-01-01',
      },
      {
        id: 2,
        publication_id: 'pub-1',
        period_id: 1,
        staff_id: 2,
        duty_date: '2027-01-12',
        shift_code: 'OFF',
        cell_note: null,
        created_at: '2027-01-01',
      },
    ],
    isLoading: false,
    error: null,
  }),
  useAmendmentEventsQuery: () => ({
    data: mockActiveEvents,
    isLoading: false,
    error: null,
  }),
  usePublicHolidaysQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useUpsertDraftAssignmentMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useDeleteDraftAssignmentMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  usePublishRosterMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSubmitAmendmentMutation: () => ({
    mutateAsync: mockSubmitAmendment,
    isPending: false,
  }),
  useReverseAmendmentMutation: () => ({
    mutateAsync: mockReverseAmendment,
    isPending: false,
  }),
  useCloseRosterMutation: () => ({
    mutateAsync: mockCloseRoster,
    isPending: false,
  }),
  useReopenRosterMutation: () => ({
    mutateAsync: mockReopenRoster,
    isPending: false,
  }),
  useRosterEpAssignmentsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useUpsertEpAssignmentMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useBatchUpsertEpAssignmentsMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

function renderPublishedWorkspace(userRole: 'owner' | 'staff' = 'owner') {
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

describe('Roster Operational Lifecycle & Amendments Integration', () => {
  it('renders published roster with three operational view tabs and owner actions', () => {
    renderPublishedWorkspace('owner');

    expect(screen.getByText('PUBLISHED')).toBeDefined();
    expect(screen.getByRole('button', { name: /Live Schedule \(Current\)/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Original Planned/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Changes & Audit/i })).toBeDefined();

    expect(screen.getByRole('button', { name: /Amend Roster/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Close Period/i })).toBeDefined();
  });

  it('switches between Current, Planned, and Changes views', () => {
    renderPublishedWorkspace('owner');

    // Switch to Changes & Audit
    const changesTab = screen.getByRole('button', { name: /Changes & Audit/i });
    fireEvent.click(changesTab);

    expect(screen.getByRole('heading', { level: 2, name: /Audit Trail/i })).toBeDefined();
    expect(screen.getByText(/Event #1/i)).toBeDefined();
    expect(screen.getByText(/Medical Leave covered by Dr Siti/i)).toBeDefined();

    // Switch back to Live Schedule
    const liveTab = screen.getByRole('button', { name: /Live Schedule \(Current\)/i });
    fireEvent.click(liveTab);

    expect(screen.getByText(/January 2027 Roster/i)).toBeDefined();
  });

  it('opens AmendRosterModal and submits an operational amendment', async () => {
    mockSubmitAmendment.mockResolvedValueOnce(2);
    renderPublishedWorkspace('owner');

    const amendBtn = screen.getByRole('button', { name: /Amend Roster/i });
    fireEvent.click(amendBtn);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: /Submit Operational Roster Amendment/i }),
    ).toBeDefined();

    // Select Absence Only tab
    const absenceOnlyTab = screen.getByRole('button', { name: /Absence Only/i });
    fireEvent.click(absenceOnlyTab);

    // Type mandatory reason
    const reasonInput = screen.getByPlaceholderText(/e\.g\. Acute gastroenteritis/i);
    fireEvent.change(reasonInput, { target: { value: 'High grade fever with positive flu swab' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Submit Amendment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmitAmendment).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'absence_only',
          reason: 'High grade fever with positive flu swab',
        }),
      );
    });
  });

  it('allows owner to reverse an active amendment from the audit log', async () => {
    mockReverseAmendment.mockResolvedValueOnce(3);
    renderPublishedWorkspace('owner');

    // Switch to Changes & Audit view
    const changesTab = screen.getByRole('button', { name: /Changes & Audit/i });
    fireEvent.click(changesTab);

    // Click reverse amendment link
    const reverseBtn = screen.getByRole('button', { name: /Reverse this amendment/i });
    fireEvent.click(reverseBtn);

    // Reversal confirmation modal opens
    expect(screen.getByRole('heading', { level: 2, name: /Reverse Amendment #1/i })).toBeDefined();

    // Provide mandatory reason
    const reasonArea = screen.getByPlaceholderText(/e\.g\. Doctor cleared to return/i);
    fireEvent.change(reasonArea, {
      target: { value: 'Erroneous shift swap entry reversed by MO IC' },
    });

    // Confirm reversal
    const confirmBtn = screen.getByRole('button', { name: /Confirm Reversal/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockReverseAmendment).toHaveBeenCalledWith({
        eventId: 1,
        reason: 'Erroneous shift swap entry reversed by MO IC',
      });
    });
  });

  it('opens CloseReconcileModal and reconciles GOFF accruals upon period close', async () => {
    mockCloseRoster.mockResolvedValueOnce(undefined);
    renderPublishedWorkspace('owner');

    const closeBtn = screen.getByRole('button', { name: /Close Period/i });
    fireEvent.click(closeBtn);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: /Finalize & Close January 2027 Roster/i }),
    ).toBeDefined();

    // Accrual detection check (Dr Siti replaced Dr Afif from scheduled OFF -> AM)
    expect(screen.getByText(/Compensatory Rest Accruals/i)).toBeDefined();
    expect(screen.getAllByText(/\+1 GOFF/i).length).toBeGreaterThan(0);

    // Confirm close
    const finalizeBtn = screen.getByRole('button', { name: /Finalize & Close/i });
    fireEvent.click(finalizeBtn);

    await waitFor(() => {
      expect(mockCloseRoster).toHaveBeenCalled();
    });
  });
});
