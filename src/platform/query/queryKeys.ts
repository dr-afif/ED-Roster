/**
 * Canonical hierarchical query keys (02_TARGET_ARCHITECTURE.md).
 * Mutations invalidate exact affected slices — never refresh the entire dataset.
 */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    allowlistBinding: () => [...queryKeys.auth.all, 'allowlist-binding'] as const,
  },
  directory: {
    all: ['directory'] as const,
    activeList: () => [...queryKeys.directory.all, 'active'] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    me: () => [...queryKeys.profiles.all, 'me'] as const,
    detail: (staffId: number) => [...queryKeys.profiles.all, 'detail', staffId] as const,
  },
  professionalRecords: {
    all: ['professional-records'] as const,
    byStaff: (staffId: number | 'me') =>
      [...queryKeys.professionalRecords.all, 'staff', staffId] as const,
  },
  requests: {
    all: ['requests'] as const,
    mine: () => [...queryKeys.requests.all, 'mine'] as const,
    period: (yearMonth: string) => [...queryKeys.requests.all, 'period', yearMonth] as const,
  },
  rosters: {
    all: ['rosters'] as const,
    period: (year: string, month: string) =>
      [...queryKeys.rosters.all, 'period', year, month] as const,
    draftAssignments: (periodId: number) =>
      [...queryKeys.rosters.all, 'draft-assignments', periodId] as const,
    plannedAssignments: (periodId: number) =>
      [...queryKeys.rosters.all, 'planned-assignments', periodId] as const,
    publications: (periodId: number) =>
      [...queryKeys.rosters.all, 'publications', periodId] as const,
    amendmentEvents: (periodId: number) =>
      [...queryKeys.rosters.all, 'amendment-events', periodId] as const,
    amendmentLines: (periodId: number) =>
      [...queryKeys.rosters.all, 'amendment-lines', periodId] as const,
    goffLedger: (staffId?: number) =>
      [...queryKeys.rosters.all, 'goff-ledger', staffId ?? 'all'] as const,
    staffList: () => [...queryKeys.rosters.all, 'staff-list'] as const,
    shiftDefinitions: () => [...queryKeys.rosters.all, 'shift-definitions'] as const,
    snapshots: (year: string, month: string) =>
      [...queryKeys.rosters.all, 'snapshots', year, month] as const,
  },
  rules: {
    all: ['rules'] as const,
    activeSets: () => [...queryKeys.rules.all, 'active-sets'] as const,
    version: (versionId: number) => [...queryKeys.rules.all, 'version', versionId] as const,
    thresholds: (versionId: number) => [...queryKeys.rules.all, 'thresholds', versionId] as const,
  },
  documents: {
    all: ['documents'] as const,
    catalog: (filters?: Record<string, string>) =>
      [...queryKeys.documents.all, 'catalog', filters ?? {}] as const,
  },
  audit: {
    all: ['audit'] as const,
    recent: () => [...queryKeys.audit.all, 'recent'] as const,
  },
} as const;
