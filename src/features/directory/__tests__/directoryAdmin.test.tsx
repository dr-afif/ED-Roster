import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffDirectoryAdminRoute } from '../StaffDirectoryAdminRoute';
import { AuthContext, type AuthBoundaryState } from '@/platform/auth/authContext';

// Mock the query hook
vi.mock('../useDirectoryAdmin', () => ({
  useStaffDirectoryQuery: () => ({
    data: [
      {
        id: 1,
        staff_code: 'MO-ADMIN',
        roster_name: 'Dr Afif',
        display_name: 'Dr Muhammad Afif',
        staff_group: 'Emergency Physician',
        employment_status: 'active',
        active: true,
        start_date: '2025-01-01',
        end_date: null,
        service_periods: [
          {
            id: 101,
            staff_id: 1,
            start_date: '2022-05-01',
            end_date: '2024-04-30',
            end_reason: 'switched_department',
            end_comment: 'ICU rotation',
          },
          {
            id: 102,
            staff_id: 1,
            start_date: '2025-01-01',
            end_date: null,
            end_reason: null,
            end_comment: null,
          },
        ],
        allowed_user: {
          id: 1,
          email: 'admin@example.com',
          role: 'owner',
          status: 'active',
          activated_at: '2026-11-03T09:00:00Z',
          revoked_at: null,
          revocation_reason: null,
        },
        staff_profile: {
          phone: '+60123456789',
          registration_number: 'MMC 99999',
          verification_status: 'verified',
        },
      },
      {
        id: 2,
        staff_code: 'MO-102',
        roster_name: 'Dr Sarah',
        display_name: 'Dr Sarah Jenkins',
        staff_group: 'Medical Officer',
        employment_status: 'active',
        active: true,
        start_date: '2025-01-01',
        end_date: null,
        service_periods: [
          {
            id: 101,
            staff_id: 1,
            start_date: '2022-05-01',
            end_date: '2024-04-30',
            end_reason: 'switched_department',
            end_comment: 'ICU rotation',
          },
          {
            id: 102,
            staff_id: 1,
            start_date: '2025-01-01',
            end_date: null,
            end_reason: null,
            end_comment: null,
          },
        ],
        allowed_user: {
          id: 2,
          email: 'sarah@example.com',
          role: 'staff',
          status: 'invited',
          activated_at: null,
          revoked_at: null,
          revocation_reason: null,
        },
        staff_profile: null,
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCreateStaffMemberMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateAllowlistStatusMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateStaffMemberMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function renderWithProviders(ui: React.ReactElement, isOwner = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const authState: AuthBoundaryState = {
    status: 'authenticated',
    user: {
      authUserId: 'test-user-id',
      email: 'admin@example.com',
      role: isOwner ? 'owner' : 'staff',
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
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authState}>{ui}</AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('StaffDirectoryAdminRoute', () => {
  it('renders directory heading and staff entries for owner', () => {
    renderWithProviders(<StaffDirectoryAdminRoute />);

    expect(screen.getByText('Staff Directory & Approved Emails')).toBeInTheDocument();
    expect(screen.getByText('Dr Afif')).toBeInTheDocument();
    expect(screen.getByText('Dr Sarah')).toBeInTheDocument();
    expect(screen.getByText('MO-ADMIN')).toBeInTheDocument();
    expect(screen.getByText('MO-102')).toBeInTheDocument();
  });

  it('opens invite staff modal when clicking invite button', () => {
    renderWithProviders(<StaffDirectoryAdminRoute />);

    const inviteButton = screen.getByRole('button', { name: /invite staff member/i });
    fireEvent.click(inviteButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/google account email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/staff code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/roster short name/i)).toBeInTheDocument();
  });

  it('opens edit staff modal when clicking edit button', () => {
    renderWithProviders(<StaffDirectoryAdminRoute />);

    const [firstEditBtn] = screen.getAllByRole('button', { name: /edit/i });
    expect(firstEditBtn).toBeDefined();
    if (!firstEditBtn) throw new Error('Edit button not found');
    fireEvent.click(firstEditBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/edit staff: dr muhammad afif/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dr Afif')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dr Muhammad Afif')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MO-ADMIN')).toBeInTheDocument();
  });

  it('filters staff by search query', () => {
    renderWithProviders(<StaffDirectoryAdminRoute />);

    const searchInput = screen.getByPlaceholderText(/search name, code, email/i);
    fireEvent.change(searchInput, { target: { value: 'Sarah' } });

    expect(screen.getByText('Dr Sarah')).toBeInTheDocument();
    expect(screen.queryByText('Dr Afif')).not.toBeInTheDocument();
  });

  it('denies access to non-owners via OwnerUxBoundary', () => {
    renderWithProviders(<StaffDirectoryAdminRoute />, false);

    expect(screen.getByText(/owner administration required/i)).toBeInTheDocument();
    expect(screen.queryByText('Invite Staff Member')).not.toBeInTheDocument();
  });

  it('displays separate service periods, active duration, and end-date reason controls in edit modal', () => {
    renderWithProviders(<StaffDirectoryAdminRoute />);

    expect(screen.getAllByText(/Jan 2025 – Current/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/May 2022 – Apr 2024/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Switched Department/i).length).toBeGreaterThanOrEqual(1);

    const [firstEditBtn] = screen.getAllByRole('button', { name: /edit/i });
    if (!firstEditBtn) throw new Error('Edit button not found');
    fireEvent.click(firstEditBtn);

    expect(screen.getByRole('button', { name: /\+ Add Period/i })).toBeInTheDocument();
    const endReasonSelect = screen.getByLabelText(/Period 2 End Reason/i);
    expect(endReasonSelect).toBeInTheDocument();
    fireEvent.change(endReasonSelect, { target: { value: 'masters_program' } });
    expect((endReasonSelect as HTMLSelectElement).value).toBe('masters_program');
    expect(screen.getByRole('option', { name: /Quit Hospital/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Masters Program/i })).toBeInTheDocument();
  });
});
