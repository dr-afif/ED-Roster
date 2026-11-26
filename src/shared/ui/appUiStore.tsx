import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface DepartmentUpdateItem {
  id: number;
  title: string;
  body: string;
  tag: 'Roster' | 'GHKA' | 'Policy' | 'Urgent';
  pinned: boolean;
  unread: boolean;
  date: string;
  author: string;
}

export interface DeptSettingsState {
  departmentName: string;
  hospitalName: string;
  cutoffDay: number;
  isWindowOpen: boolean;
  autoEnforceQuotas: boolean;
  telegramEnabled: boolean;
  driveSyncEnabled: boolean;
}

export interface SharedTallyThresholds {
  amMin: number;
  pmMin: number;
  nightMin: number;
  nightMax: number;
  totalLeaveMax: number;
}

const UPDATES_STORAGE_KEY = 'resq.ui.v1.updates';
const SETTINGS_STORAGE_KEY = 'resq.ui.v1.deptSettings';
const THRESHOLDS_STORAGE_KEY = 'resq.ui.v1.tallyThresholds';

export const INITIAL_UPDATES: DepartmentUpdateItem[] = [
  {
    id: 1,
    title: 'January 2027 Roster Published (v3)',
    body: 'The official January 2027 ED roster is live. Please check for any post-publication amendments before swapping shifts.',
    tag: 'Roster',
    pinned: true,
    unread: true,
    date: 'Today · 09:30',
    author: 'Dr. Afif (Admin MO)',
  },
  {
    id: 2,
    title: 'Thaipusam GHKA Claim Window Open',
    body: 'Officers who worked on Thaipusam (25 Jan) can submit signed replacement memo PDFs via Records & PH.',
    tag: 'GHKA',
    pinned: false,
    unread: true,
    date: 'Yesterday',
    author: 'HSAAS Roster Office',
  },
  {
    id: 3,
    title: 'Request Rules Updated: ON1 Cap 1/Day',
    body: 'ON1 night request is strictly limited to 1 officer/day; GHKA and COURSE count toward the 3/day OFF group limit.',
    tag: 'Policy',
    pinned: false,
    unread: false,
    date: '14 Nov',
    author: 'Dr. Afif (Admin MO)',
  },
];

export const DEFAULT_DEPT_SETTINGS: DeptSettingsState = {
  departmentName: 'Emergency Department',
  hospitalName: 'Hospital Sultan Abdul Aziz Shah (HSAAS)',
  cutoffDay: 25,
  isWindowOpen: true,
  autoEnforceQuotas: true,
  telegramEnabled: true,
  driveSyncEnabled: true,
};

export const DEFAULT_TALLY_THRESHOLDS: SharedTallyThresholds = {
  amMin: 4,
  pmMin: 4,
  nightMin: 2,
  nightMax: 4,
  totalLeaveMax: 3,
};

export function formatOrdinalDay(day: number): string {
  const n = Math.max(1, Math.min(28, Number(day) || 25));
  if (n % 10 === 1 && n !== 11) return `${n}st`;
  if (n % 10 === 2 && n !== 12) return `${n}nd`;
  if (n % 10 === 3 && n !== 13) return `${n}rd`;
  return `${n}th`;
}

export function getMalaysiaDayOfMonth(now = new Date()): number {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(now);
  const parsed = parseInt(formatted, 10);
  return Number.isFinite(parsed) ? parsed : now.getDate();
}

export function isRequestWindowEffectivelyOpen(
  isWindowOpen: boolean,
  cutoffDay: number,
  now = new Date(),
): boolean {
  if (!isWindowOpen) return false;
  return getMalaysiaDayOfMonth(now) <= cutoffDay;
}

export function buildRequestWindowSummary(isWindowOpen: boolean, cutoffDay: number): string {
  const now = new Date();
  const thisMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthLabel = nextMonthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  if (!isWindowOpen) {
    return `Request CLOSED for ${nextMonthLabel}`;
  }
  if (getMalaysiaDayOfMonth(now) > cutoffDay) {
    return `Request CLOSED for ${nextMonthLabel} (cutoff passed: ${formatOrdinalDay(cutoffDay)} ${thisMonthLabel})`;
  }
  return `Request OPEN for ${nextMonthLabel} (until the ${formatOrdinalDay(cutoffDay)} ${thisMonthLabel})`;
}

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface AppUiStateContextValue {
  updates: DepartmentUpdateItem[];
  unreadUpdatesCount: number;
  addUpdate: (input: {
    title: string;
    body: string;
    tag: DepartmentUpdateItem['tag'];
    pinned?: boolean;
    author?: string;
  }) => void;
  toggleUpdateRead: (id: number) => void;
  markAllUpdatesRead: () => void;
  toggleUpdatePin: (id: number) => void;
  deleteUpdate: (id: number) => void;
  deptSettings: DeptSettingsState;
  setDeptSettings: (
    next: DeptSettingsState | ((prev: DeptSettingsState) => DeptSettingsState),
  ) => void;
  requestWindowSummary: string;
  tallyThresholds: SharedTallyThresholds;
  setTallyThresholds: (
    next: SharedTallyThresholds | ((prev: SharedTallyThresholds) => SharedTallyThresholds),
  ) => void;
  showToast: (message: string) => void;
}

const NOOP = () => {};

const FALLBACK_CONTEXT: AppUiStateContextValue = {
  updates: INITIAL_UPDATES,
  unreadUpdatesCount: INITIAL_UPDATES.filter((u) => u.unread).length,
  addUpdate: NOOP,
  toggleUpdateRead: NOOP,
  markAllUpdatesRead: NOOP,
  toggleUpdatePin: NOOP,
  deleteUpdate: NOOP,
  deptSettings: DEFAULT_DEPT_SETTINGS,
  setDeptSettings: NOOP,
  requestWindowSummary: buildRequestWindowSummary(
    DEFAULT_DEPT_SETTINGS.isWindowOpen,
    DEFAULT_DEPT_SETTINGS.cutoffDay,
  ),
  tallyThresholds: DEFAULT_TALLY_THRESHOLDS,
  setTallyThresholds: NOOP,
  showToast: NOOP,
};

const AppUiStateContext = createContext<AppUiStateContextValue>(FALLBACK_CONTEXT);

export function AppUiStateProvider({ children }: { children: ReactNode }) {
  const [updates, setUpdates] = useState<DepartmentUpdateItem[]>(() =>
    readStoredJson(UPDATES_STORAGE_KEY, INITIAL_UPDATES),
  );
  const [deptSettings, setDeptSettingsState] = useState<DeptSettingsState>(() => ({
    ...DEFAULT_DEPT_SETTINGS,
    ...readStoredJson<Partial<DeptSettingsState>>(SETTINGS_STORAGE_KEY, {}),
  }));
  const [tallyThresholds, setTallyThresholdsState] = useState<SharedTallyThresholds>(() => ({
    ...DEFAULT_TALLY_THRESHOLDS,
    ...readStoredJson<Partial<SharedTallyThresholds>>(THRESHOLDS_STORAGE_KEY, {}),
  }));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      window.localStorage?.setItem(UPDATES_STORAGE_KEY, JSON.stringify(updates));
    } catch {
      // Ignore storage restrictions safely
    }
  }, [updates]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(deptSettings));
    } catch {
      // Ignore storage restrictions safely
    }
  }, [deptSettings]);

  useEffect(() => {
    try {
      window.localStorage?.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(tallyThresholds));
    } catch {
      // Ignore storage restrictions safely
    }
  }, [tallyThresholds]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);

  const addUpdate = useCallback(
    (input: {
      title: string;
      body: string;
      tag: DepartmentUpdateItem['tag'];
      pinned?: boolean;
      author?: string;
    }) => {
      setUpdates((prev) => [
        {
          id: Date.now(),
          title: input.title,
          body: input.body,
          tag: input.tag,
          pinned: Boolean(input.pinned),
          unread: true,
          date: 'Just now',
          author: input.author ?? 'Dr. Afif (Admin MO)',
        },
        ...prev,
      ]);
    },
    [],
  );

  const toggleUpdateRead = useCallback((id: number) => {
    setUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, unread: !u.unread } : u)));
  }, []);

  const markAllUpdatesRead = useCallback(() => {
    setUpdates((prev) => prev.map((u) => ({ ...u, unread: false })));
  }, []);

  const toggleUpdatePin = useCallback((id: number) => {
    setUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, pinned: !u.pinned } : u)));
  }, []);

  const deleteUpdate = useCallback((id: number) => {
    setUpdates((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const setDeptSettings = useCallback(
    (next: DeptSettingsState | ((prev: DeptSettingsState) => DeptSettingsState)) => {
      setDeptSettingsState((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const setTallyThresholds = useCallback(
    (next: SharedTallyThresholds | ((prev: SharedTallyThresholds) => SharedTallyThresholds)) => {
      setTallyThresholdsState((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const unreadUpdatesCount = useMemo(() => updates.filter((u) => u.unread).length, [updates]);
  const requestWindowSummary = useMemo(
    () => buildRequestWindowSummary(deptSettings.isWindowOpen, deptSettings.cutoffDay),
    [deptSettings.isWindowOpen, deptSettings.cutoffDay],
  );

  const value = useMemo<AppUiStateContextValue>(
    () => ({
      updates,
      unreadUpdatesCount,
      addUpdate,
      toggleUpdateRead,
      markAllUpdatesRead,
      toggleUpdatePin,
      deleteUpdate,
      deptSettings,
      setDeptSettings,
      requestWindowSummary,
      tallyThresholds,
      setTallyThresholds,
      showToast,
    }),
    [
      updates,
      unreadUpdatesCount,
      addUpdate,
      toggleUpdateRead,
      markAllUpdatesRead,
      toggleUpdatePin,
      deleteUpdate,
      deptSettings,
      setDeptSettings,
      requestWindowSummary,
      tallyThresholds,
      setTallyThresholds,
      showToast,
    ],
  );

  return (
    <AppUiStateContext.Provider value={value}>
      {children}
      {toastMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-14 left-1/2 z-[80] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#18181B] px-3.5 py-2 text-[11.5px] font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)] animate-in"
        >
          {toastMessage}
        </div>
      ) : null}
    </AppUiStateContext.Provider>
  );
}

export function useAppUiState(): AppUiStateContextValue {
  return useContext(AppUiStateContext);
}

export function useToast(): (message: string) => void {
  return useContext(AppUiStateContext).showToast;
}
