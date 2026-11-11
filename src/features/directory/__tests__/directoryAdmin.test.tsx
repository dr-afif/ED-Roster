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
        start_date: null,
        end_date: null,
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
        start_date: null,
        end_date: null,
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
});
