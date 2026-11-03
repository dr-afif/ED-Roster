import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App, EnvironmentErrorScreen } from '@/app/App';
import { createTestAppRouter } from '@/app/router';
import {
  createBrowserSupabaseClient,
  EnvironmentConfigurationError,
  validateSupabaseEnv,
  type SupabaseRuntimeBundle,
} from '@/platform/supabase';

function createSyntheticStagingBundle(): SupabaseRuntimeBundle {
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

const SYNTHETIC_STAGING_BUNDLE = createSyntheticStagingBundle();

describe('AppShell & Placeholder Routes', () => {
  it('renders accessible shell, non-production indicator, and navigates across placeholder routes', async () => {
    const user = userEvent.setup();
    const router = createTestAppRouter(['/']);

    render(<App runtimeBundle={SYNTHETIC_STAGING_BUNDLE} router={router} />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Operations Overview/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Non-prod · staging/i)).toBeInTheDocument();

    // Skip link moves focus directly to #main-content without breaking router state.
    const skipLink = screen.getByRole('link', { name: /Skip to main content/i });
    await user.click(skipLink);
    expect(document.getElementById('main-content')).toHaveFocus();
    expect(router.state.location.pathname).toBe('/');

    // Navigate to January 2027 Roster placeholder.
    await user.click(screen.getByRole('link', { name: /Open Jan 2027 Roster Shell/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /January 2027 Roster/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send to My Telegram/i })).toBeDisabled();

    // Navigate via desktop sidebar to Owner Admin -> Rules & Policies.
    const desktopSidebar = screen.getByLabelText(/Primary desktop navigation/i);
    await user.click(within(desktopSidebar).getByRole('link', { name: /Rules & Policies/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Roster Rules & Thresholds/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Owner Administration UX Boundary/i)).toBeInTheDocument();
  });

  it('caps mobile bottom navigation at 5 controls and opens/closes the accessible More dialog', async () => {
    const user = userEvent.setup();
    const router = createTestAppRouter(['/requests']);

    render(<App runtimeBundle={SYNTHETIC_STAGING_BUNDLE} router={router} />);

    const mobileNav = screen.getByRole('navigation', { name: /Primary mobile navigation/i });
    const mobileLinks = within(mobileNav).getAllByRole('link');
    const moreButton = within(mobileNav).getByRole('button', { name: /More/i });

    expect(mobileLinks).toHaveLength(4);
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(moreButton);
    const dialog = screen.getByRole('dialog', { name: /More Destinations/i });
    expect(dialog).toBeInTheDocument();

    // Escape closes the dialog cleanly.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /More Destinations/i })).not.toBeInTheDocument();

    // Reopen and navigate to Documents Catalog.
    await user.click(moreButton);
    const reopenedDialog = screen.getByRole('dialog', { name: /More Destinations/i });
    await user.click(within(reopenedDialog).getByRole('link', { name: /Documents/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Documents Catalog/i }),
    ).toBeInTheDocument();
  });

  it('renders recovery states for invalid roster month URLs and unknown routes', async () => {
    const invalidMonthRouter = createTestAppRouter(['/rosters/2027/13']);
    const { unmount } = render(
      <App runtimeBundle={SYNTHETIC_STAGING_BUNDLE} router={invalidMonthRouter} />,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: /Invalid Roster Period URL/i }),
    ).toBeInTheDocument();
    unmount();

    const notFoundRouter = createTestAppRouter(['/unknown/path']);
    render(<App runtimeBundle={SYNTHETIC_STAGING_BUNDLE} router={notFoundRouter} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Page Not Found/i }),
    ).toBeInTheDocument();
  });

  it('renders an accessible diagnostic alert when environment configuration fails', () => {
    const error = new EnvironmentConfigurationError(['VITE_SUPABASE_URL is missing or empty.']);
    render(<EnvironmentErrorScreen error={error} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Environment Configuration Required/i);
    expect(alert).toHaveTextContent(/VITE_SUPABASE_URL is missing or empty/i);
  });
});
