import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DatabaseBackup,
  FileSearch,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  Scale,
  Settings,
  ShieldAlert,
  Sparkles,
  UserCircle2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthBoundary } from '@/platform/auth';
import { useSupabaseMetadata } from '@/platform/supabase';
import { FIRST_NATIVE_ROSTER_PERIOD } from '@/shared/dates';
import { StatusBadge } from '@/shared/ui';

const SIDEBAR_STORAGE_KEY = 'resq.ui.v1.sidebarCollapsed';
const DEFAULT_ROSTER_PATH = `/rosters/${FIRST_NATIVE_ROSTER_PERIOD.year}/${FIRST_NATIVE_ROSTER_PERIOD.month}`;

type NavItem = {
  readonly label: string;
  readonly to: string;
  readonly icon: LucideIcon;
  readonly matchPrefix?: string;
};

const STAFF_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Roster', to: DEFAULT_ROSTER_PATH, icon: CalendarDays, matchPrefix: '/rosters/' },
  { label: 'Requests', to: '/requests', icon: ClipboardList },
  { label: 'Records', to: '/records', icon: BookOpenCheck },
  { label: 'Public Holidays', to: '/holidays', icon: Sparkles },
  { label: 'Documents', to: '/documents', icon: FolderKanban },
  { label: 'Updates', to: '/updates', icon: Bell },
  { label: 'My Profile', to: '/profile/me', icon: UserCircle2 },
];

const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Staff & Allowlist', to: '/admin/staff', icon: Users },
  { label: 'Request Review', to: '/admin/requests', icon: ClipboardList },
  { label: 'Rules & Policies', to: '/admin/rules', icon: Scale },
  { label: 'System Settings', to: '/admin/settings', icon: Settings },
  { label: 'Audit & Recovery', to: '/admin/audit', icon: FileSearch },
  { label: 'Sheets Migration', to: '/admin/migration', icon: DatabaseBackup },
];

// Mobile bottom bar strictly capped at <= 5 items (08_FRONTEND_UX.md):
// Home, Roster, Requests, Records, plus More sheet trigger.
const MOBILE_PRIMARY_ITEMS: readonly NavItem[] = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Roster', to: DEFAULT_ROSTER_PATH, icon: CalendarDays, matchPrefix: '/rosters/' },
  { label: 'Requests', to: '/requests', icon: ClipboardList },
  { label: 'Records', to: '/records', icon: BookOpenCheck },
];

const MOBILE_MORE_STAFF_ITEMS: readonly NavItem[] = [
  { label: 'Public Holidays', to: '/holidays', icon: Sparkles },
  { label: 'Documents', to: '/documents', icon: FolderKanban },
  { label: 'Updates', to: '/updates', icon: Bell },
  { label: 'My Profile', to: '/profile/me', icon: UserCircle2 },
];

function readInitialSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.to === '/') {
    return pathname === '/';
  }
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) {
    return true;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function AppShell() {
  const metadata = useSupabaseMetadata();
  const { user, signOut } = useAuthBoundary();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(
    readInitialSidebarCollapsed,
  );
  const [moreOpenForPath, setMoreOpenForPath] = useState<string | null>(null);
  const isMoreOpen = moreOpenForPath === location.pathname;

  const mainRef = useRef<HTMLElement | null>(null);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const moreDialogRef = useRef<HTMLDivElement | null>(null);
  const moreCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreSheetTitleId = useId();

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage quota/privacy restrictions safely.
      }
      return next;
    });
  };

  // Accessible focus management and Escape key handling for mobile More dialog (08_FRONTEND_UX.md).
  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    moreCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMoreOpenForPath(null);
        moreTriggerRef.current?.focus();
        return;
      }

      if (event.key === 'Tab' && moreDialogRef.current) {
        const focusables = Array.from(
          moreDialogRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) {
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isMoreOpen]);

  const handleSkipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    // Prevent overwriting HashRouter's URL hash while moving keyboard focus to <main>.
    event.preventDefault();
    mainRef.current?.focus();
  };

  const isMoreRouteActive = [...MOBILE_MORE_STAFF_ITEMS, ...ADMIN_NAV_ITEMS].some((item) =>
    isNavItemActive(location.pathname, item),
  );

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      <a
        href="#main-content"
        onClick={handleSkipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-xl focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-text-inverse"
      >
        Skip to main content
      </a>

      {/* Desktop collapsible sidebar */}
      <aside
        aria-label="Primary desktop navigation"
        className={`surface-frosted hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:flex-col lg:border-r lg:border-border-subtle ${
          isSidebarCollapsed ? 'lg:w-20' : 'lg:w-68'
        } transition-[width] duration-200`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-sm font-bold text-text-inverse"
            >
              RQ
            </span>
            {!isSidebarCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">RESQ Workforce</p>
                <p className="truncate text-xs text-text-secondary">Emergency Department</p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!isSidebarCollapsed}
            aria-label={
              isSidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'
            }
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-muted hover:text-text-primary"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>

        {!metadata.isProduction ? (
          <div className="border-b border-border-subtle px-3 py-2.5">
            {isSidebarCollapsed ? (
              <span
                title={`Non-production environment: ${metadata.appEnv} (${metadata.projectRef})`}
                className="flex items-center justify-center rounded-lg bg-warning-soft py-1.5 text-[11px] font-semibold text-warning uppercase"
              >
                {metadata.appEnv.slice(0, 3)}
              </span>
            ) : (
              <StatusBadge
                label={`Non-prod · ${metadata.appEnv} (${metadata.projectRef})`}
                tone="warning"
                icon={ShieldAlert}
              />
            )}
          </div>
        ) : null}

        <nav aria-label="Workspace sections" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {!isSidebarCollapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">
                Operations
              </p>
            ) : null}
            {STAFF_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(location.pathname, item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={isSidebarCollapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-primary text-text-inverse'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                  {isSidebarCollapsed ? <span className="sr-only">{item.label}</span> : null}
                </NavLink>
              );
            })}
          </div>

          <div className="space-y-1 border-t border-border-subtle pt-4">
            {!isSidebarCollapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-text-secondary uppercase">
                Owner Admin
              </p>
            ) : null}
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(location.pathname, item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={isSidebarCollapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-brand-primary text-text-inverse'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                  {isSidebarCollapsed ? <span className="sr-only">{item.label}</span> : null}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* User Session & Sign Out in Desktop Sidebar */}
        <div className="border-t border-border-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            {!isSidebarCollapsed && user ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-text-primary">
                  {user.displayName}
                </p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      user.role === 'owner'
                        ? 'bg-brand-primary-soft text-brand-primary'
                        : 'bg-teal-soft text-teal'
                    }`}
                  >
                    {user.role}
                  </span>
                  {user.staffCode ? (
                    <span className="truncate text-[11px] text-text-muted">{user.staffCode}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={signOut}
              title="Sign out of RESQ Workforce"
              aria-label="Sign out of RESQ Workforce"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="surface-frosted sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5 lg:hidden">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary text-xs font-bold text-text-inverse"
          >
            RQ
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">RESQ Workforce</p>
            <p className="text-[11px] text-text-secondary">Emergency Department</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!metadata.isProduction ? (
            <StatusBadge label={metadata.appEnv.toUpperCase()} tone="warning" icon={ShieldAlert} />
          ) : null}
          <button
            type="button"
            onClick={signOut}
            title="Sign out of RESQ Workforce"
            aria-label="Sign out of RESQ Workforce"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Main content area */}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 px-4 py-6 pb-24 focus:outline-none sm:px-6 lg:px-8 lg:py-8 lg:pb-8"
      >
        <div className="mx-auto max-w-6xl">
          <Suspense
            fallback={
              <div
                role="status"
                aria-live="polite"
                className="surface-opaque min-h-48 animate-pulse rounded-2xl p-6 text-sm text-text-secondary"
              >
                Loading workspace view...
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Mobile bottom navigation (strictly 5 destinations: Home, Roster, Requests, Records, More) */}
      <nav
        aria-label="Primary mobile navigation"
        className="surface-frosted fixed right-0 bottom-0 left-0 z-30 border-t border-border-subtle px-2 py-1 lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(location.pathname, item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium ${
                  active ? 'bg-brand-primary-soft text-brand-primary' : 'text-text-secondary'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}

          <button
            ref={moreTriggerRef}
            type="button"
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-sheet"
            onClick={() =>
              setMoreOpenForPath((prev) => (prev === location.pathname ? null : location.pathname))
            }
            className={`flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium ${
              isMoreOpen || isMoreRouteActive
                ? 'bg-brand-primary-soft text-brand-primary'
                : 'text-text-secondary'
            }`}
          >
            <Menu className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Accessible mobile More sheet */}
      {isMoreOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-text-primary/35 lg:hidden">
          <div
            id="mobile-more-sheet"
            ref={moreDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={moreSheetTitleId}
            className="surface-frosted max-h-[82dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border-subtle p-4 pb-8"
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h2 id={moreSheetTitleId} className="text-base font-semibold text-text-primary">
                More Destinations
              </h2>
              <button
                ref={moreCloseButtonRef}
                type="button"
                aria-label="Close more navigation menu"
                onClick={() => setMoreOpenForPath(null)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <p className="px-2 text-xs font-semibold text-text-secondary uppercase">
                  Staff Workspace
                </p>
                {MOBILE_MORE_STAFF_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(location.pathname, item);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                        active
                          ? 'bg-brand-primary text-text-inverse'
                          : 'text-text-primary hover:bg-surface-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>

              <div className="space-y-1 border-t border-border-subtle pt-3">
                <p className="px-2 text-xs font-semibold text-text-secondary uppercase">
                  Owner Administration
                </p>
                {ADMIN_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(location.pathname, item);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                        active
                          ? 'bg-brand-primary text-text-inverse'
                          : 'text-text-primary hover:bg-surface-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>

              {user ? (
                <div className="border-t border-border-subtle pt-3">
                  <div className="mb-2 px-2">
                    <p className="truncate text-xs font-semibold text-text-primary">
                      {user.displayName}
                    </p>
                    <p className="truncate text-[11px] text-text-secondary capitalize">
                      {user.role} role {user.staffCode ? `· ${user.staffCode}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpenForPath(null);
                      void signOut();
                    }}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-danger/20 bg-danger-soft/20 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft/40"
                  >
                    <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
