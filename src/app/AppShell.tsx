import {
  Award,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DatabaseBackup,
  Download,
  FileSearch,
  FileText,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  Scale,
  Settings,
  Sparkles,
  User,
  UserCircle2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  getUserRoleSubtitle,
  isAdminPtpoUser,
  useAuthBoundary,
  type AuthenticatedUserContext,
} from '@/platform/auth';
import { supabase, useSupabaseMetadata } from '@/platform/supabase';
import { getSessionOrUpcomingRosterPath } from '@/shared/dates';
import { SkeletonPageFallback, useAppUiState, usePwaInstall, useToast } from '@/shared/ui';

const SIDEBAR_STORAGE_KEY = 'resq.ui.v1.sidebarCollapsed';

type NavItem = {
  readonly label: string;
  readonly emoji: string;
  readonly to: string;
  readonly icon: LucideIcon;
  readonly matchPrefix?: string;
};

const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Staff & Accounts', emoji: '👥', to: '/admin/staff', icon: Users },
  { label: 'Rules & Policies', emoji: '⚙️', to: '/admin/rules', icon: Scale },
  { label: 'Department Settings', emoji: '🛠️', to: '/admin/settings', icon: Settings },
  { label: 'Audit & Recovery', emoji: '📜', to: '/admin/audit', icon: FileSearch },
  { label: 'Sheets Migration', emoji: '🔄', to: '/admin/migration', icon: DatabaseBackup },
];

// Mobile bottom bar strictly capped at <= 5 items:
// Home, Roster, Requests (Hero Orb), Records, plus More sheet trigger.
function buildMobilePrimaryItems(rosterPath: string): readonly NavItem[] {
  return [
    { label: 'Home', emoji: '🏠', to: '/', icon: Home },
    {
      label: 'Roster',
      emoji: '📅',
      to: rosterPath,
      icon: CalendarDays,
      matchPrefix: '/rosters/',
    },
    { label: 'Requests', emoji: '📋', to: '/requests', icon: ClipboardCheck },
    { label: 'Records', emoji: '🏅', to: '/records', icon: Award, matchPrefix: '/holidays' },
  ];
}

function readInitialSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
  const cleanTo = item.to.split('?')[0] ?? item.to;
  if (cleanTo === '/') {
    return pathname === '/';
  }
  if (cleanTo === '/records' && (pathname === '/holidays' || pathname === '/ph-tracker')) {
    return true;
  }
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) {
    return true;
  }
  return pathname === cleanTo || pathname.startsWith(`${cleanTo}/`);
}

function getMobileHeaderTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/rosters/')) return 'Roster';
  if (pathname.startsWith('/requests') || pathname.startsWith('/admin/requests')) {
    return 'Shift Requests';
  }
  if (
    pathname.startsWith('/records') ||
    pathname.startsWith('/holidays') ||
    pathname.startsWith('/ph-tracker')
  ) {
    return 'Records & Credits';
  }
  if (pathname.startsWith('/documents')) return 'Drive Documents';
  if (pathname.startsWith('/updates')) return 'Department Updates';
  if (pathname.startsWith('/profile')) return 'My Profile';
  if (pathname.startsWith('/admin/staff')) return 'Staff & Accounts';
  if (pathname.startsWith('/admin/rules')) return 'Rules & Policies';
  if (pathname.startsWith('/admin/settings')) return 'Dept Settings';
  if (pathname.startsWith('/admin/audit')) return 'Audit & Recovery';
  if (pathname.startsWith('/admin/migration')) return 'Sheets Migration';
  return 'Dashboard';
}

export function AppShell() {
  const metadata = useSupabaseMetadata();
  const {
    user,
    signOut,
    canSwitchTestPersona,
    toggleTestMoPersona,
    previewUser,
    isViewingAsOtherUser,
    setPreviewUser,
  } = useAuthBoundary();
  const { unreadUpdatesCount } = useAppUiState();
  const showToast = useToast();
  const { canInstall, promptInstall } = usePwaInstall();

  const { data: previewStaffOptions = [] } = useQuery({
    queryKey: ['auth', 'preview-staff-options'],
    enabled: Boolean(canSwitchTestPersona),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_directory')
        .select('id, staff_code, roster_name, display_name, staff_group')
        .eq('active', true)
        .order('id', { ascending: true });
      if (error) return [];
      return data ?? [];
    },
  });

  const handleSelectPreviewStaff = (staffIdStr: string) => {
    if (!staffIdStr) {
      setPreviewUser?.(null);
      showToast('Returned to Super Admin view ✓');
      return;
    }
    const row = previewStaffOptions.find((s) => String(s.id) === staffIdStr);
    if (!row) return;
    const nextUser: AuthenticatedUserContext = {
      authUserId: user?.authUserId ?? `preview-${row.id}`,
      email: user?.email ?? null,
      role: 'staff',
      staffId: row.id,
      staffCode: row.staff_code ?? null,
      displayName: row.display_name || row.roster_name || 'Staff',
      rosterName: row.roster_name ?? row.display_name ?? null,
      staffGroup: row.staff_group ?? null,
    };
    setPreviewUser?.(nextUser);
    showToast(`Viewing as ${nextUser.rosterName || nextUser.displayName}`);
  };

  const handleInstallApp = async () => {
    const result = await promptInstall();
    if (result === 'accepted') {
      showToast('RESQ ED installed on your device ✓');
    } else if (result === 'ios-guide') {
      showToast('Tap Safari Share (□↑) → "Add to Home Screen" to install');
    }
  };
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(
    readInitialSidebarCollapsed,
  );
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);
  const isOwner = user?.role === 'owner';
  const isPtpoAdmin = isAdminPtpoUser(user);
  const roleSubtitle = getUserRoleSubtitle(user);
  const isTestingAsMo = Boolean(isViewingAsOtherUser);

  const mainRef = useRef<HTMLElement | null>(null);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const moreDialogRef = useRef<HTMLDivElement | null>(null);
  const moreCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreSheetTitleId = useId();

  const crestSrc = `${import.meta.env.BASE_URL}ed-crest.png`;
  const mobileTitle = getMobileHeaderTitle(location.pathname);
  const isOnRosterRoute = location.pathname.startsWith('/rosters/');
  const profilePillLabel =
    user?.rosterName?.trim() || user?.displayName?.trim() || (isOwner ? 'Dr. Afif' : 'Staff');

  const defaultRosterPath = getSessionOrUpcomingRosterPath();
  const mobilePrimaryItems = buildMobilePrimaryItems(defaultRosterPath).filter(
    (item) => !(isPtpoAdmin && item.to === '/requests'),
  );

  const staffNavItems: readonly NavItem[] = [
    { label: 'Home', emoji: '🏠', to: '/', icon: Home },
    {
      label: 'Roster',
      emoji: '📅',
      to: defaultRosterPath,
      icon: CalendarDays,
      matchPrefix: '/rosters/',
    },
    ...(!isPtpoAdmin
      ? [{ label: 'Requests', emoji: '📋', to: '/requests', icon: ClipboardCheck }]
      : []),
    { label: 'Records & PH', emoji: '🏅', to: '/records', icon: Award, matchPrefix: '/holidays' },
    {
      label: unreadUpdatesCount > 0 ? `Updates (${unreadUpdatesCount})` : 'Updates',
      emoji: '🔔',
      to: '/updates',
      icon: Bell,
    },
    { label: 'My Profile', emoji: '👤', to: '/profile/me', icon: UserCircle2 },
  ];

  const mobileMoreStaffItems: readonly NavItem[] = [
    { label: 'Public Holidays & GHKA', emoji: '✨', to: '/records?pane=ph', icon: Sparkles },
    { label: 'Documents', emoji: '📁', to: '/documents', icon: FolderKanban },
    {
      label:
        unreadUpdatesCount > 0
          ? `Department Updates (${unreadUpdatesCount})`
          : 'Department Updates',
      emoji: '🔔',
      to: '/updates',
      icon: Bell,
    },
    { label: 'My Profile', emoji: '👤', to: '/profile/me', icon: UserCircle2 },
  ];

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

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Accessible focus management and Escape key handling for mobile More dialog.
  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    moreCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMoreOpen(false);
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

  const isMoreRouteActive = [
    ...mobileMoreStaffItems.filter((item) => !item.to.startsWith('/records')),
    ...(isOwner ? ADMIN_NAV_ITEMS : []),
  ].some((item) => isNavItemActive(location.pathname, item));

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      <a
        href="#main-content"
        onClick={handleSkipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-xl focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-text-inverse"
      >
        Skip to main content
      </a>

      {/* Desktop dark navigation rail */}
      <aside
        aria-label="Primary desktop navigation"
        className={`hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:flex-col bg-[#18181B] text-[#E7E5E4] ${
          isSidebarCollapsed ? 'lg:w-20' : 'lg:w-[224px]'
        } transition-[width] duration-200 z-30`}
      >
        <div className="flex items-center justify-between gap-2 px-3.5 py-4">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={crestSrc}
              alt="Emergency Dept HSAAS crest"
              className="h-9 w-9 shrink-0 rounded-full bg-white object-cover shadow-md ring-1 ring-white/15"
            />
            {!isSidebarCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-extrabold text-white tracking-tight">
                  Emergency Dept
                </p>
                <p className="truncate text-[10px] font-semibold text-[#A8A29E]">HSAAS · UPM</p>
              </div>
            ) : null}
          </Link>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!isSidebarCollapsed}
            aria-label={
              isSidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'
            }
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-[#27272A] hover:text-white transition-colors cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>

        {!metadata.isProduction ? (
          <span className="sr-only">
            Non-prod · {metadata.appEnv} ({metadata.projectRef})
          </span>
        ) : null}

        <nav
          aria-label="Workspace sections"
          className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-1"
        >
          <div className="space-y-[3px]">
            {!isSidebarCollapsed ? (
              <p className="px-2.5 pb-1.5 text-[10px] font-extrabold tracking-[0.06em] text-[#71717A] uppercase">
                Workspace
              </p>
            ) : null}
            {staffNavItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(location.pathname, item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={isSidebarCollapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-[14px] px-3 py-[9px] text-[12.5px] transition-all duration-150 cursor-pointer ${
                    active
                      ? 'bg-[#E06D53] text-[#18181B] font-extrabold shadow-[0_4px_12px_rgba(224,109,83,0.35)]'
                      : 'text-[#A8A29E] font-bold hover:bg-[#27272A] hover:text-white'
                  } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                >
                  {isSidebarCollapsed ? (
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <span className="text-sm leading-none shrink-0" aria-hidden="true">
                      {item.emoji}
                    </span>
                  )}
                  {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                  {isSidebarCollapsed ? <span className="sr-only">{item.label}</span> : null}
                </NavLink>
              );
            })}
          </div>

          {isOwner ? (
            <div className="space-y-[3px] pt-2">
              {!isSidebarCollapsed ? (
                <p className="px-2.5 pb-1.5 text-[10px] font-extrabold tracking-[0.06em] text-[#5EEAD4] uppercase">
                  Owner Administration
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
                    className={`flex items-center gap-2.5 rounded-[14px] px-3 py-[9px] text-[12.5px] transition-all duration-150 cursor-pointer ${
                      active
                        ? 'bg-[#E06D53] text-[#18181B] font-extrabold shadow-[0_4px_12px_rgba(224,109,83,0.35)]'
                        : 'text-[#A8A29E] font-bold hover:bg-[#27272A] hover:text-white'
                    } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    {isSidebarCollapsed ? (
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <span className="text-sm leading-none shrink-0" aria-hidden="true">
                        {item.emoji}
                      </span>
                    )}
                    {!isSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                    {isSidebarCollapsed ? <span className="sr-only">{item.label}</span> : null}
                  </NavLink>
                );
              })}
            </div>
          ) : null}
        </nav>

        {/* Desktop Sidebar Footer */}
        <div className="border-t border-[#27272A] px-3 py-3 space-y-2.5">
          {canInstall ? (
            <button
              type="button"
              onClick={() => void handleInstallApp()}
              title="Install RESQ ED App"
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#3F3F46] bg-[#27272A] px-2.5 py-2 text-[11px] font-extrabold text-white transition-all hover:bg-[#3F3F46] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 shrink-0 text-[#5EEAD4]" aria-hidden="true" />
              {!isSidebarCollapsed ? <span className="truncate">Install App (PWA)</span> : null}
            </button>
          ) : null}
          {canSwitchTestPersona ? (
            <div className="space-y-1.5">
              {!isSidebarCollapsed ? (
                <label className="block space-y-1">
                  <span className="block text-[9.5px] font-extrabold uppercase tracking-[0.05em] text-[#5EEAD4]">
                    Test View As User
                  </span>
                  <select
                    aria-label="Test View As User"
                    value={previewUser?.staffId ? String(previewUser.staffId) : ''}
                    onChange={(e) => handleSelectPreviewStaff(e.target.value)}
                    className="w-full rounded-xl border border-[#3F3F46] bg-[#27272A] px-2.5 py-1.5 text-[11px] font-bold text-white focus:border-[#14B8A6] focus:outline-none cursor-pointer"
                  >
                    <option value="">👑 Super Admin (Default)</option>
                    {previewStaffOptions.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.roster_name || s.display_name} ({s.staff_code})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {isTestingAsMo ? (
                <button
                  type="button"
                  onClick={() => {
                    if (previewUser) {
                      setPreviewUser?.(null);
                    } else {
                      toggleTestMoPersona?.();
                    }
                  }}
                  title="Exit test user view and return to Super Admin"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-2.5 py-2 text-[11px] font-extrabold text-[#FCD34D] transition-all hover:bg-[#F59E0B]/25 cursor-pointer"
                >
                  <span aria-hidden="true">👑</span>
                  {!isSidebarCollapsed ? (
                    <span className="truncate">Exit Preview · Back to Admin</span>
                  ) : null}
                </button>
              ) : null}
            </div>
          ) : null}
          <div
            className={`flex items-center gap-2 ${
              isSidebarCollapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            {!isSidebarCollapsed && user ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-white">{user.displayName}</p>
                <p className="truncate text-[10px] font-medium text-[#A8A29E]">{roleSubtitle}</p>
              </div>
            ) : null}
            <div className="flex items-center gap-1 shrink-0">
              {!isSidebarCollapsed && !metadata.isProduction ? (
                <span className="rounded-lg bg-[#27272A] px-2 py-1 text-[10px] font-extrabold text-[#5EEAD4] uppercase">
                  {metadata.appEnv}
                </span>
              ) : null}
              <button
                type="button"
                onClick={signOut}
                title="Sign out of RESQ Workforce"
                aria-label="Sign out of RESQ Workforce"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-[#27272A] hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Dynamic Mobile Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[#E7E5E4]/65 bg-[#FAF8F5]/92 px-4 pt-2 pb-2.5 backdrop-blur-[10px] lg:hidden">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img
            src={crestSrc}
            alt="ED Logo"
            className="h-9 w-9 shrink-0 rounded-full bg-white object-cover shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
          />
          <div className="min-w-0 text-left">
            <p className="truncate text-[15.5px] font-extrabold text-[#1C1917] leading-[1.15] tracking-tight">
              {mobileTitle}
            </p>
            <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.05em] text-[#0F766E]">
              EMERGENCY DEPT · HSAAS
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5">
          {canSwitchTestPersona && isTestingAsMo ? (
            <button
              type="button"
              onClick={() => {
                if (previewUser) {
                  setPreviewUser?.(null);
                } else {
                  toggleTestMoPersona?.();
                }
              }}
              title="Exit test user view and return to Super Admin"
              aria-label="Exit test user view and return to Super Admin"
              className="inline-flex h-[34px] items-center gap-1 rounded-full border border-[#F59E0B] bg-[#FEF3C7] px-2.5 text-[10.5px] font-extrabold text-[#92400E] shadow-[0_2px_6px_rgba(0,0,0,0.03)] active:scale-[0.95] cursor-pointer"
            >
              <span aria-hidden="true">👑</span>
              <span>Back to Admin</span>
            </button>
          ) : null}

          {isOwner && isOnRosterRoute ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('resq:open-roster-pdf'))}
              title="PDF Export"
              aria-label="Open Roster PDF Export"
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[11px] border border-[#E7E5E4] bg-white text-[#1C1917] shadow-[0_2px_6px_rgba(0,0,0,0.03)] active:scale-[0.93] cursor-pointer"
            >
              <FileText className="h-[15px] w-[15px]" strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}

          <Link
            to="/profile/me"
            title="Profile"
            aria-label={`Open profile for ${profilePillLabel}`}
            className="inline-flex h-[34px] max-w-[116px] items-center gap-1.5 rounded-full border border-[#E7E5E4] bg-white pl-2 pr-2.5 text-[#1C1917] shadow-[0_2px_6px_rgba(0,0,0,0.03)] active:scale-[0.95]"
          >
            <User className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <span className="truncate text-[11px] font-extrabold">{profilePillLabel}</span>
          </Link>
        </div>
      </header>

      {/* Main content area — overflow-x-clip keeps position:sticky working on mobile subbars */}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 max-w-full overflow-x-clip px-3.5 py-3 pb-24 focus:outline-none sm:px-6 sm:py-5 lg:px-[26px] lg:py-5 lg:pb-8"
      >
        <div className="mx-auto w-full">
          {isViewingAsOtherUser && user ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2 text-xs font-bold text-[#92400E] shadow-2xs">
              <span>
                👁️ Viewing as{' '}
                <strong className="font-extrabold">{user.rosterName || user.displayName}</strong>{' '}
                {user.staffCode ? `(${user.staffCode})` : ''} — Test Preview Mode
              </span>
              <button
                type="button"
                onClick={() => {
                  if (previewUser) {
                    setPreviewUser?.(null);
                  } else {
                    toggleTestMoPersona?.();
                  }
                }}
                className="rounded-full bg-[#18181B] px-3 py-1 text-[11px] font-extrabold text-white hover:bg-stone-800 cursor-pointer"
              >
                Return to Super Admin
              </button>
            </div>
          ) : null}
          <Suspense fallback={<SkeletonPageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Grounded Obsidian Mobile Dock (OCTO-inspired top notch + 1/3 floating Requests orb) */}
      <nav
        aria-label="Primary mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 rounded-t-[24px] bg-[#18181B] px-2.5 pt-0 pb-[calc(14px+env(safe-area-inset-bottom))] text-white shadow-[0_-10px_30px_rgba(0,0,0,0.28)] lg:hidden"
      >
        <div className="grid w-full grid-cols-5 items-end justify-items-center">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(location.pathname, item);
            const isCenterOrb = item.to === '/requests';
            if (isCenterOrb) {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className="dock-btn relative flex h-[60px] w-[66px] flex-col items-center justify-end pb-[5px] cursor-pointer"
                >
                  <span
                    className={`absolute -top-4 left-1/2 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-[#18181B] transition-all duration-200 ${
                      active
                        ? 'scale-[1.06] bg-[linear-gradient(145deg,#F08066,#E06D53)] text-[#18181B]'
                        : 'bg-[linear-gradient(145deg,#14867D,#0F766E)] text-white'
                    }`}
                  >
                    <Icon className="h-[21px] w-[21px] stroke-[2.3]" aria-hidden="true" />
                  </span>
                  <span
                    className={`text-[9.5px] font-extrabold leading-none tracking-[0.01em] ${
                      active ? 'text-white' : 'text-[#D4D4D8]'
                    }`}
                  >
                    {item.label}
                  </span>
                </NavLink>
              );
            }
            const isRecords = item.to === '/records';
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`dock-btn ${isRecords ? 'dock-btn-records' : ''} relative flex h-[58px] w-[62px] flex-col items-center justify-end gap-1 pb-[5px] transition-colors duration-200 active:scale-[0.94] cursor-pointer ${
                  active ? 'active text-white' : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                {active ? (
                  <span className="absolute top-0 left-1/2 h-[3.5px] w-8 -translate-x-1/2 rounded-b-[4px] bg-[#E06D53]" />
                ) : null}
                <Icon className="h-[19px] w-[19px] stroke-[2]" aria-hidden="true" />
                <span className="text-[9.5px] font-extrabold leading-none tracking-[0.01em]">
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          <button
            ref={moreTriggerRef}
            type="button"
            title="More"
            aria-label="More"
            aria-expanded={isMoreOpen}
            aria-controls="mobile-more-sheet"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={`dock-btn relative flex h-[58px] w-[62px] flex-col items-center justify-end gap-1 pb-[5px] transition-colors duration-200 active:scale-[0.94] cursor-pointer ${
              isMoreOpen || isMoreRouteActive
                ? 'active text-white'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            {isMoreOpen || isMoreRouteActive ? (
              <span className="absolute top-0 left-1/2 h-[3.5px] w-8 -translate-x-1/2 rounded-b-[4px] bg-[#E06D53]" />
            ) : null}
            <Menu className="h-[19px] w-[19px] stroke-[2]" aria-hidden="true" />
            <span className="text-[9.5px] font-extrabold leading-none tracking-[0.01em]">More</span>
          </button>
        </div>
      </nav>

      {/* Accessible Obsidian Mobile More Sheet */}
      {isMoreOpen ? (
        <div
          onClick={() => setIsMoreOpen(false)}
          className="fixed inset-0 z-50 flex items-end bg-[#18181B]/55 backdrop-blur-[3px] lg:hidden"
        >
          <div
            id="mobile-more-sheet"
            ref={moreDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={moreSheetTitleId}
            onClick={(e) => e.stopPropagation()}
            className="no-scrollbar sheet-slide-up max-h-[78dvh] w-full overflow-y-auto rounded-t-[28px] bg-[#18181B] px-[18px] pt-3 pb-7 text-[#FAF8F5] shadow-[0_-12px_40px_rgba(0,0,0,0.35)]"
          >
            <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-[#3F3F46]" />

            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <h2
                id={moreSheetTitleId}
                className="text-base font-extrabold text-white tracking-tight"
              >
                More Destinations
              </h2>
              <button
                ref={moreCloseButtonRef}
                type="button"
                aria-label="Close more navigation menu"
                onClick={() => setIsMoreOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:bg-[#27272A] hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#A1A1AA]">
                  Workspace
                </p>
                <div className="space-y-2">
                  {mobileMoreStaffItems.map((item) => {
                    const active =
                      !item.to.startsWith('/records') && isNavItemActive(location.pathname, item);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsMoreOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between rounded-[16px] px-3.5 py-3 text-[13px] font-bold transition-all active:scale-[0.98] ${
                          active
                            ? 'bg-[#E06D53] text-[#18181B] font-extrabold'
                            : 'bg-[#27272A] text-[#F4F4F5] hover:bg-[#3F3F46]'
                        }`}
                      >
                        <span>
                          {item.emoji} {item.label}
                        </span>
                        <span className="opacity-70">›</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>

              {isOwner ? (
                <div className="border-t border-[#27272A] pt-3.5">
                  <p className="mb-2 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#5EEAD4]">
                    Owner Administration
                  </p>
                  <div className="space-y-2">
                    {ADMIN_NAV_ITEMS.map((item) => {
                      const active = isNavItemActive(location.pathname, item);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMoreOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center justify-between rounded-[16px] px-3.5 py-3 text-[13px] font-bold transition-all active:scale-[0.98] ${
                            active
                              ? 'bg-[#E06D53] text-[#18181B] font-extrabold'
                              : 'bg-[#27272A] text-[#F4F4F5] hover:bg-[#3F3F46]'
                          }`}
                        >
                          <span>
                            {item.emoji} {item.label}
                          </span>
                          <span className="opacity-70">›</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {user ? (
                <div className="border-t border-[#27272A] pt-3.5">
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-extrabold text-white">
                        {user.displayName}
                      </p>
                      <p className="truncate text-[10.5px] text-[#A1A1AA]">
                        {roleSubtitle}
                        {user.staffCode ? ` · ${user.staffCode}` : ''}
                      </p>
                    </div>
                    {!metadata.isProduction ? (
                      <span className="rounded-lg bg-[#27272A] px-2 py-1 text-[10px] font-extrabold text-[#5EEAD4] uppercase">
                        {metadata.appEnv}
                      </span>
                    ) : null}
                  </div>
                  {canInstall ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        void handleInstallApp();
                      }}
                      className="mb-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-[#3F3F46] bg-[#27272A] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#3F3F46] transition-colors cursor-pointer"
                    >
                      <Download className="h-4 w-4 shrink-0 text-[#5EEAD4]" aria-hidden="true" />
                      <span>Install ED Roster App</span>
                    </button>
                  ) : null}
                  {canSwitchTestPersona ? (
                    <div className="mb-2 space-y-2">
                      <label className="block space-y-1">
                        <span className="block text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#5EEAD4]">
                          Test View As User
                        </span>
                        <select
                          aria-label="Mobile Test View As User"
                          value={previewUser?.staffId ? String(previewUser.staffId) : ''}
                          onChange={(e) => {
                            handleSelectPreviewStaff(e.target.value);
                            setIsMoreOpen(false);
                          }}
                          className="w-full rounded-[14px] border border-[#3F3F46] bg-[#27272A] px-3 py-2 text-xs font-bold text-white focus:border-[#14B8A6] focus:outline-none cursor-pointer"
                        >
                          <option value="">👑 Super Admin (Default)</option>
                          {previewStaffOptions.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.roster_name || s.display_name} ({s.staff_code})
                            </option>
                          ))}
                        </select>
                      </label>
                      {isTestingAsMo ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (previewUser) {
                              setPreviewUser?.(null);
                            } else {
                              toggleTestMoPersona?.();
                            }
                            setIsMoreOpen(false);
                          }}
                          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-4 py-2.5 text-xs font-extrabold text-[#FCD34D] hover:bg-[#F59E0B]/25 transition-colors cursor-pointer"
                        >
                          <span aria-hidden="true">👑</span>
                          <span>Return to Super Admin</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      void signOut();
                    }}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs font-extrabold text-rose-300 hover:bg-red-500/20 transition-colors cursor-pointer"
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
