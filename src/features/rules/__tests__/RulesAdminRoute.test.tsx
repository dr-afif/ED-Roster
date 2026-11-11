import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as RosterQueriesModule from '../../rosters/data/rosterQueries';
import { RulesAdminRoute } from '../RulesAdminRoute';
import { AuthContext, type AuthBoundaryState } from '@/platform/auth/authContext';

const mockMutateUpdate = vi.fn().mockResolvedValue({});
const mockMutateCreate = vi.fn().mockResolvedValue({});

vi.mock('../../rosters/data/rosterQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof RosterQueriesModule>();
  return {
    ...actual,
    useRuleVersionQuery: () => ({
      data: {
        id: 1,
        rule_set_id: 'ed_default',
        version: 1,
        status: 'active',
        effective_from: '2026-01-01',
        config: {
          weekly_off_policy: 'policy_b',
          max_consecutive_days: 6,
          min_rest_hours_after_night: 24,
        },
      },
      isLoading: false,
    }),
    useStaffingThresholdsQuery: () => ({
      data: [
        {
          id: 1,
          rule_version_id: 1,
          day_type: 'weekday',
          shift_bucket: 'AM',
          min_staff: 3,
          target_staff: 4,
        },
      ],
      isLoading: false,
    }),
    useShiftDefinitionsQuery: () => ({
      data: [
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
      ],
      isLoading: false,
    }),
    useShiftSemanticsQuery: () => ({
      data: [
        {
          shift_code: 'AM',
          semantic_class: 'worked',
          provides_coverage: true,
          night_policy_b_qualifying: false,
          displaces_off_earns_goff: false,
          modifier_inheritance: 'inherit',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          shift_code: 'PM',
          semantic_class: 'worked',
          provides_coverage: true,
          night_policy_b_qualifying: false,
          displaces_off_earns_goff: false,
          modifier_inheritance: 'inherit',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          shift_code: 'ON',
          semantic_class: 'worked',
          provides_coverage: true,
          night_policy_b_qualifying: true,
          displaces_off_earns_goff: false,
          modifier_inheritance: 'inherit',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      isLoading: false,
    }),
    useUpdateShiftDefinitionMutation: () => ({
      mutateAsync: mockMutateUpdate,
      isPending: false,
    }),
    useCreateShiftDefinitionMutation: () => ({
      mutateAsync: mockMutateCreate,
      isPending: false,
    }),
  };
});

function renderWithProviders(initialRoute = '/rules') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const authState: AuthBoundaryState = {
    status: 'authenticated',
    user: {
      authUserId: 'test-user-id',
      email: 'admin@example.com',
      role: 'owner',
      staffId: 1,
      staffCode: 'MO-ADMIN',
      displayName: 'Dr Muhammad Afif',
      rosterName: 'Dr Afif',
    },
    unapprovedReason: null,
    unapprovedEmail: null,
    errorMessage: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    retryBootstrap: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authState}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <RulesAdminRoute />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('RulesAdminRoute & Shift Timings Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders rules admin header and tabs', () => {
    renderWithProviders();
    expect(screen.getByText('Roster Rules & Thresholds')).toBeInTheDocument();
    expect(screen.getByText('Scheduling Policies & Limits')).toBeInTheDocument();
    expect(screen.getByText('Staffing Minimums')).toBeInTheDocument();
    expect(screen.getByText(/Shift Semantics/)).toBeInTheDocument();
  });

  it('switches to Shift Semantics tab and lists shift definitions with timings', () => {
    renderWithProviders();
    const semanticsTabBtn = screen.getByText(/Shift Semantics/);
    fireEvent.click(semanticsTabBtn);

    expect(screen.getByText('Shift Definitions, Timings & Semantics')).toBeInTheDocument();
    expect(screen.getByText('Morning Shift (08:00 - 16:00)')).toBeInTheDocument();
    expect(screen.getByText('Evening Shift (16:00 - 23:00)')).toBeInTheDocument();
    expect(screen.getByText('Night Duty (23:00 - 08:00)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Shift Definition/i })).toBeInTheDocument();
  });

  it('opens edit modal pre-filled with shift details and submits timing changes', async () => {
    renderWithProviders('/rules?tab=semantics');

    // Click Edit button for AM shift
    const editAmBtn = screen.getByRole('button', { name: 'Edit AM' });
    fireEvent.click(editAmBtn);

    expect(screen.getByText('Edit Shift Definition: AM')).toBeInTheDocument();

    const labelInput = screen.getByLabelText(/Shift Timing Window & Full Description/i);
    expect(labelInput).toHaveValue('Morning Shift (08:00 - 16:00)');

    // Change timing to 07:30 - 15:30
    fireEvent.change(labelInput, {
      target: { value: 'Morning Shift (07:30 - 15:30)' },
    });

    const submitBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateUpdate).toHaveBeenCalledTimes(1);
      expect(mockMutateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AM',
          label: 'Morning Shift (07:30 - 15:30)',
        }),
      );
    });
  });

  it('opens create modal and creates a new shift definition', async () => {
    renderWithProviders('/rules?tab=semantics');

    const addBtn = screen.getByRole('button', { name: /Add Shift Definition/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Create New Shift Definition')).toBeInTheDocument();

    const codeInput = screen.getByLabelText(/Shift Code/i);
    const labelInput = screen.getByLabelText(/Shift Timing Window & Full Description/i);
    const shortLabelInput = screen.getByLabelText(/Grid Short Label/i);

    fireEvent.change(codeInput, { target: { value: 'CLINIC' } });
    fireEvent.change(labelInput, { target: { value: 'Specialist Clinic (08:00 - 17:00)' } });
    fireEvent.change(shortLabelInput, { target: { value: 'CLN' } });

    const submitBtn = screen.getByRole('button', { name: /Create Shift Definition/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateCreate).toHaveBeenCalledTimes(1);
      expect(mockMutateCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CLINIC',
          label: 'Specialist Clinic (08:00 - 17:00)',
          shortLabel: 'CLN',
        }),
      );
    });
  });
});
