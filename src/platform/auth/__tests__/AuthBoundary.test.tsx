import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AuthBoundaryState } from '../authContext';
import { AuthProvider } from '../AuthProvider';
import { OwnerUxBoundary } from '../OwnerUxBoundary';
import {
  createBrowserSupabaseClient,
  SupabaseProvider,
  validateSupabaseEnv,
  type SupabaseRuntimeBundle,
} from '@/platform/supabase';

function createSyntheticBundle(): SupabaseRuntimeBundle {
  const config = validateSupabaseEnv({
    VITE_SUPABASE_URL: 'https://syntheticstaging.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_ui_test_key_123456',
    BASE_URL: '/ED-Roster/',
    MODE: 'test',
    VITE_APP_ENV: 'staging',
  });

  return {
    client: createBrowserSupabaseClient(config),
    metadata: {
      appEnv: config.appEnv,
      projectRef: config.projectRef,
      supabaseOrigin: config.supabaseOrigin,
      basePath: config.basePath,
      isProduction: config.isProduction,
    },
  };
}

const SYNTHETIC_BUNDLE = createSyntheticBundle();

describe('AuthBoundary & Gates', () => {
  it('renders loading screen when auth status is loading', () => {
    const state: AuthBoundaryState = {
      status: 'loading',
      user: null,
      unapprovedReason: null,
      unapprovedEmail: null,
      errorMessage: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      retryBootstrap: vi.fn(),
    };

    render(
      <SupabaseProvider bundle={SYNTHETIC_BUNDLE}>
        <AuthProvider value={state}>
          <div>Protected Content</div>
        </AuthProvider>
      </SupabaseProvider>,
    );

    expect(screen.getByText(/Verifying Workforce Identity/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders sign-in screen when unauthenticated and triggers Google OAuth on click', async () => {
    const user = userEvent.setup();
    const signInWithGoogle = vi.fn();

    const state: AuthBoundaryState = {
      status: 'unauthenticated',
      user: null,
      unapprovedReason: null,
      unapprovedEmail: null,
      errorMessage: null,
      signInWithGoogle,
      signOut: vi.fn(),
      retryBootstrap: vi.fn(),
    };

    render(
      <SupabaseProvider bundle={SYNTHETIC_BUNDLE}>
        <AuthProvider value={state}>
          <div>Protected Content</div>
        </AuthProvider>
      </SupabaseProvider>,
    );

    expect(screen.getByRole('heading', { name: /RESQ Workforce/i })).toBeInTheDocument();
    expect(screen.getByText(/Approved Identity Access Only/i)).toBeInTheDocument();

    const signInBtn = screen.getByRole('button', { name: /Sign in with Google/i });
    await user.click(signInBtn);
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders unapproved screen with masked email and triggers sign-out on click', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn();

    const state: AuthBoundaryState = {
      status: 'unapproved',
      user: null,
      unapprovedReason: 'unapproved',
      unapprovedEmail: 'unapproved.doctor@hospital.internal',
      errorMessage: null,
      signInWithGoogle: vi.fn(),
      signOut,
      retryBootstrap: vi.fn(),
    };

    render(
      <SupabaseProvider bundle={SYNTHETIC_BUNDLE}>
        <AuthProvider value={state}>
          <div>Protected Content</div>
        </AuthProvider>
      </SupabaseProvider>,
    );

    expect(screen.getByRole('heading', { name: /Access Not Approved/i })).toBeInTheDocument();
    expect(screen.getByText(/unapproved.doctor@hospital.internal/i)).toBeInTheDocument();

    const signOutBtn = screen.getByRole('button', { name: /Sign Out \/ Switch Account/i });
    await user.click(signOutBtn);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders error screen when session bootstrap fails and triggers retry', async () => {
    const user = userEvent.setup();
    const retryBootstrap = vi.fn();

    const state: AuthBoundaryState = {
      status: 'error',
      user: null,
      unapprovedReason: null,
      unapprovedEmail: null,
      errorMessage: 'Network timeout during allowlist check.',
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      retryBootstrap,
    };

    render(
      <SupabaseProvider bundle={SYNTHETIC_BUNDLE}>
        <AuthProvider value={state}>
          <div>Protected Content</div>
        </AuthProvider>
      </SupabaseProvider>,
    );

    expect(
      screen.getByRole('heading', { name: /Session Verification Issue/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Network timeout during allowlist check/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Retry Connection/i });
    await user.click(retryBtn);
    expect(retryBootstrap).toHaveBeenCalledTimes(1);
  });

  it('renders children when authenticated', () => {
    const state: AuthBoundaryState = {
      status: 'authenticated',
      user: {
        authUserId: '00000000-0000-0000-0000-000000000001',
        email: 'staff1@hospital.internal',
        role: 'staff',
        staffId: 10,
        staffCode: 'MO-10',
        displayName: 'Dr. Active Staff',
        rosterName: 'Dr. Active',
      },
      unapprovedReason: null,
      unapprovedEmail: null,
      errorMessage: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      retryBootstrap: vi.fn(),
    };

    render(
      <SupabaseProvider bundle={SYNTHETIC_BUNDLE}>
        <AuthProvider value={state}>
          <div>Protected Roster Workspace</div>
        </AuthProvider>
      </SupabaseProvider>,
    );

    expect(screen.getByText('Protected Roster Workspace')).toBeInTheDocument();
  });
});

describe('OwnerUxBoundary', () => {
  it('blocks staff role from admin route with clear notice and return link', () => {
    const staffState: AuthBoundaryState = {
      status: 'authenticated',
      user: {
        authUserId: '00000000-0000-0000-0000-000000000001',
        email: 'staff@hospital.internal',
        role: 'staff',
        staffId: 10,
        staffCode: 'MO-10',
        displayName: 'Dr. Active Staff',
        rosterName: 'Dr. Active',
      },
      unapprovedReason: null,
      unapprovedEmail: null,
      errorMessage: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      retryBootstrap: vi.fn(),
    };

    render(
      <MemoryRouter>
        <SupabaseProvider bundle={SYNTHETIC_BUNDLE}>
          <AuthProvider value={staffState}>
            <OwnerUxBoundary areaName="Rules & Policies">
              <div>Secret Admin Panel</div>
            </OwnerUxBoundary>
          </AuthProvider>
        </SupabaseProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /Owner Administration Required — Rules & Policies/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your account is currently active with role/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Return to Operations Overview/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Secret Admin Panel')).not.toBeInTheDocument();
  });

  it('renders administrative children when role is owner', () => {
    const ownerState: AuthBoundaryState = {
      status: 'authenticated',
      user: {
        authUserId: '00000000-0000-0000-0000-000000000002',
        email: 'owner@hospital.internal',
        role: 'owner',
        staffId: null,
        staffCode: null,
        displayName: 'Roster Administrator',
        rosterName: null,
      },
      unapprovedReason: null,
      unapprovedEmail: null,
      errorMessage: null,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      retryBootstrap: vi.fn(),
    };

    render(
      <MemoryRouter>
        <SupabaseProvider bundle={SYNTHETIC_BUNDLE}>
          <AuthProvider value={ownerState}>
            <OwnerUxBoundary areaName="Rules & Policies">
              <div>Secret Admin Panel</div>
            </OwnerUxBoundary>
          </AuthProvider>
        </SupabaseProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Owner Administration Boundary — Rules & Policies/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Secret Admin Panel')).toBeInTheDocument();
  });
});
