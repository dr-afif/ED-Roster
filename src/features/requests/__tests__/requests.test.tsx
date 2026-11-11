import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffRequestsRoute, AdminRequestsRoute } from '../RequestsRoutes';
import { AuthContext, type AuthBoundaryState } from '@/platform/auth/authContext';

const mockCreateMutateAsync = vi.fn().mockResolvedValue({});
const mockWithdrawMutateAsync = vi.fn().mockResolvedValue({});
const mockDecideMutateAsync = vi.fn().mockResolvedValue({});

vi.mock('../useRequests', () => ({
  useRequestTypesQuery: () => ({
    data: [
      {
        id: 1,
        code: 'annual_leave',
        label: 'Annual Leave',
        description: 'Planned annual leave quota',
        category: 'leave',
        requires_dates: true,
        requires_shift_code: false,
        max_days_per_request: 14,
        min_lead_days: 14,
        sort_order: 10,
      },
      {
        id: 2,
        code: 'preferred_off',
        label: 'Preferred Day Off',
        description: 'Preferred rest day',
        category: 'shift_preference',
        requires_dates: true,
        requires_shift_code: false,
        max_days_per_request: 2,
        min_lead_days: 7,
        sort_order: 20,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useMyRequestsQuery: () => ({
    data: [
      {
        id: 10,
        public_id: 'req-uuid-1',
        staff_id: 1,
        request_type_id: 1,
        period_start_date: '2027-01-01',
        start_date: '2027-01-12',
        end_date: '2027-01-14',
        requested_shift_code: null,
        reason_category: 'personal',
        notes: 'Attending family wedding',
        status: 'submitted',
        decision_reason: null,
        decided_at: null,
        submitted_at: '2026-11-03T10:00:00Z',
        request_type: {
          code: 'annual_leave',
          label: 'Annual Leave',
          category: 'leave',
        },
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateRequestMutation: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useWithdrawRequestMutation: () => ({
    mutateAsync: mockWithdrawMutateAsync,
    isPending: false,
  }),
  useAllRequestsAdminQuery: () => ({
    data: [
      {
        id: 10,
        public_id: 'req-uuid-1',
        staff_id: 2,
        request_type_id: 1,
        period_start_date: '2027-01-01',
        start_date: '2027-01-15',
        end_date: '2027-01-18',
        requested_shift_code: null,
        reason_category: 'academic',
        notes: 'Ultrasound course',
        status: 'submitted',
        decision_reason: null,
        decided_at: null,
        submitted_at: '2026-11-03T10:00:00Z',
        request_type: {
          code: 'annual_leave',
          label: 'Annual Leave',
          category: 'leave',
        },
        staff: {
          id: 2,
          roster_name: 'Dr Sarah',
          display_name: 'Dr Sarah Jenkins',
          staff_code: 'MO-102',
          staff_group: 'Medical Officer',
        },
      },
    ],
    isLoading: false,
    error: null,
  }),
  useDecideRequestMutation: () => ({
    mutateAsync: mockDecideMutateAsync,
    isPending: false,
  }),
}));

function renderWithAuth(ui: React.ReactElement, isOwner = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const authState: AuthBoundaryState = {
    status: 'authenticated',
    user: {
      authUserId: 'test-user-id',
      email: 'user@example.com',
      role: isOwner ? 'owner' : 'staff',
      staffId: 1,
      staffCode: 'MO-101',
      displayName: 'Dr User',
      rosterName: 'Dr User',
    },
    unapprovedReason: null,
    unapprovedEmail: null,
    errorMessage: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    retryBootstrap: vi.fn(),
  };

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authState}>{ui}</AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('StaffRequestsRoute', () => {
  it('renders submitted requests list with status badge', () => {
    renderWithAuth(<StaffRequestsRoute />);

    expect(screen.getByText('Roster & Leave Requests')).toBeInTheDocument();
    expect(screen.getByText('Annual Leave')).toBeInTheDocument();
    expect(screen.getByText('Attending family wedding')).toBeInTheDocument();
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
  });

  it('opens submit request modal when clicking submit button', () => {
    renderWithAuth(<StaffRequestsRoute />);

    const submitBtn = screen.getByRole('button', { name: /submit request/i });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/request category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
  });
});

describe('AdminRequestsRoute', () => {
  it('renders staff requests review table for owner', () => {
    renderWithAuth(<AdminRequestsRoute />, true);

    expect(screen.getByText('Staff Request Review & Decisions')).toBeInTheDocument();
    expect(screen.getByText('Dr Sarah')).toBeInTheDocument();
    expect(screen.getByText('Ultrasound course')).toBeInTheDocument();

    const reviewBtn = screen.getByRole('button', { name: /review & decide/i });
    expect(reviewBtn).toBeInTheDocument();
  });

  it('opens review decision modal and allows approval', async () => {
    renderWithAuth(<AdminRequestsRoute />, true);

    const reviewBtn = screen.getByRole('button', { name: /review & decide/i });
    fireEvent.click(reviewBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/review staff request/i)).toBeInTheDocument();

    const approveBtn = screen.getByRole('button', { name: /approve request/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockDecideMutateAsync).toHaveBeenCalledWith({
        request_id: 10,
        decision: 'approved',
        reason: undefined,
      });
    });
  });

  it('denies access to non-owners via OwnerUxBoundary', () => {
    renderWithAuth(<AdminRequestsRoute />, false);

    expect(screen.getByText(/owner administration required/i)).toBeInTheDocument();
    expect(screen.queryByText('Staff Request Review & Decisions')).not.toBeInTheDocument();
  });
});
