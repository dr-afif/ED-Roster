import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyProfileRoute } from '../MyProfileRoute';
import { AuthContext, type AuthBoundaryState } from '@/platform/auth/authContext';

const mockMutateAsync = vi.fn().mockResolvedValue({});
let mockRegistrationNumber = 'MMC 88888';

vi.mock('../useMyProfile', () => ({
  useMyProfileQuery: () => ({
    data: {
      staff_id: 1,
      full_name: 'Dr Muhammad Afif',
      email: 'afif@example.com',
      phone: '+60123456789',
      registration_number: mockRegistrationNumber,
      staff_number: 'A05412',
      ic_number: '940512-10-5421',
      verification_status: 'verified',
      verified_at: '2026-11-03T09:00:00Z',
      directory: {
        staff_code: 'MO-ADMIN',
        roster_name: 'Dr Afif',
        display_name: 'Dr Muhammad Afif',
        staff_group: 'Emergency Physician',
        employment_status: 'active',
        active: true,
      },
    },
    isLoading: false,
    error: null,
  }),
  useUpdateMyProfileMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

function renderProfile() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const authState: AuthBoundaryState = {
    status: 'authenticated',
    user: {
      authUserId: 'test-user-id',
      email: 'afif@example.com',
      role: 'staff',
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
        <MyProfileRoute />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('MyProfileRoute', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockMutateAsync.mockClear();
  });

  it('renders operational directory details and editable contact fields', () => {
    renderProfile();

    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText('MO-ADMIN')).toBeInTheDocument();
    expect(screen.getByText('Emergency Physician')).toBeInTheDocument();

    const fullNameInput = screen.getByLabelText(/full registered name/i);
    expect(fullNameInput).toHaveValue('Dr Muhammad Afif');

    const phoneInput = screen.getByLabelText(/contact phone number/i);
    expect(phoneInput).toHaveValue('+60123456789');

    const mmcInput = screen.getByLabelText(/malaysian medical council/i);
    expect(mmcInput).toHaveValue('MMC 88888');

    const staffNumberInput = screen.getByLabelText(/staff number/i);
    expect(staffNumberInput).toHaveValue('A05412');
  });

  it('submits updated profile contact details', async () => {
    renderProfile();

    const phoneInput = screen.getByLabelText(/contact phone number/i);
    fireEvent.change(phoneInput, { target: { value: '+60199999999' } });

    const staffNumberInput = screen.getByLabelText(/staff number/i);
    fireEvent.change(staffNumberInput, { target: { value: 'A09999' } });

    const saveButton = screen.getByRole('button', { name: /save profile details/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        full_name: 'Dr Muhammad Afif',
        phone: '+60199999999',
        registration_number: 'MMC 88888',
        staff_number: 'A09999',
        ic_number: '940512-10-5421',
      });
    });

    expect(window.localStorage.getItem('resq.profile.v1.staffNumber.1')).toBe('A09999');
  });

  it('preserves trailing | TG tag in registration_number when saving profile changes', async () => {
    mockRegistrationNumber = 'MMC 88888 | TG';
    mockMutateAsync.mockClear();
    try {
      renderProfile();

      const mmcInput = screen.getByLabelText(/malaysian medical council/i);
      expect(mmcInput).toHaveValue('MMC 88888');
      fireEvent.change(mmcInput, { target: { value: 'MMC 99887' } });

      const saveButton = screen.getByRole('button', { name: /save profile details/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          full_name: 'Dr Muhammad Afif',
          phone: '+60123456789',
          registration_number: 'MMC 99887 | TG',
          staff_number: 'A05412',
          ic_number: '940512-10-5421',
        });
      });
    } finally {
      mockRegistrationNumber = 'MMC 88888';
    }
  });
});
