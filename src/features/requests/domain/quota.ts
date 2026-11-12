/**
 * Pure request quota, counting, and limit calculation utilities.
 * Ported directly from the live RESQ Request App specifications.
 */

export interface LimitGroup {
  ID: string;
  GroupName: string;
  DefaultLimit: number;
}

export interface ShiftTypeDefinition {
  ID: string;
  Name: string;
  GroupID: string | null;
  IsPublic: boolean;
}

export interface ShiftBlockOverride {
  ID?: string | number;
  Date: string; // YYYY-MM-DD
  ShiftType: string; // Group ID or Shift Type
  MaxSlots: number;
}

export interface RequestRecord {
  id?: number | string;
  public_id?: string;
  staff_id?: number | string;
  name: string;
  date: string; // YYYY-MM-DD
  request: string; // shift code (e.g., 'OFF', 'AM', 'PM', 'ON', 'AL', etc.)
  comment?: string | null;
  status: string; // 'active' | 'withdrawn' | etc.
  created_at?: string;
  isOptimistic?: boolean;
}

export interface LimitStatusResult {
  isLimited: boolean;
  groupName?: string;
  limit?: number;
  usage?: number;
  isAtLimit?: boolean;
}

export interface MonthlyStatsItem {
  key: string; // YYYY-MM
  label: string;
  count: number;
  limit: number;
  weekendCount: number;
  weekendLimit: number;
  weekendLabel: string;
}

export const DAILY_LIMIT = 3;
export const DEFAULT_MONTHLY_LIMIT = 10;
export const DEFAULT_MONTHLY_WEEKEND_LIMIT = 4;

export const DEFAULT_LIMIT_GROUPS: LimitGroup[] = [
  { ID: 'OFF', GroupName: 'OFF / Leave', DefaultLimit: DAILY_LIMIT },
];

export const DEFAULT_SHIFT_TYPES: ShiftTypeDefinition[] = [
  { ID: 'AM', Name: 'AM', GroupID: null, IsPublic: true },
  { ID: 'PM', Name: 'PM', GroupID: null, IsPublic: true },
  { ID: 'ON', Name: 'ON', GroupID: null, IsPublic: true },
  { ID: 'OFF', Name: 'OFF', GroupID: 'OFF', IsPublic: true },
  { ID: 'AL', Name: 'AL', GroupID: 'OFF', IsPublic: true },
  { ID: 'HKA', Name: 'HKA', GroupID: 'OFF', IsPublic: true },
  { ID: 'GHKA', Name: 'GHKA', GroupID: null, IsPublic: true },
  { ID: 'COURSE', Name: 'COURSE', GroupID: null, IsPublic: true },
];

export const ADMIN_ALL_SHIFT_TYPES: ShiftTypeDefinition[] = [
  { ID: 'AM', Name: 'AM', GroupID: null, IsPublic: true },
  { ID: 'PM', Name: 'PM', GroupID: null, IsPublic: true },
  { ID: 'ON', Name: 'ON', GroupID: null, IsPublic: true },
  { ID: 'ON1', Name: 'ON1', GroupID: null, IsPublic: false },
  { ID: 'ON2', Name: 'ON2', GroupID: null, IsPublic: false },
  { ID: 'NIGHT', Name: 'NIGHT', GroupID: null, IsPublic: false },
  { ID: 'ND', Name: 'ND', GroupID: null, IsPublic: false },
  { ID: 'PN', Name: 'PN', GroupID: null, IsPublic: false },
  { ID: 'OFF', Name: 'OFF', GroupID: 'OFF', IsPublic: true },
  { ID: 'GOFF', Name: 'GOFF', GroupID: 'OFF', IsPublic: false },
  { ID: 'AL', Name: 'AL', GroupID: 'OFF', IsPublic: true },
  { ID: 'MC', Name: 'MC', GroupID: 'OFF', IsPublic: false },
  { ID: 'EL', Name: 'EL', GroupID: 'OFF', IsPublic: false },
  { ID: 'HKA', Name: 'HKA', GroupID: 'OFF', IsPublic: true },
  { ID: 'GHKA', Name: 'GHKA', GroupID: null, IsPublic: true },
  { ID: 'COURSE', Name: 'COURSE', GroupID: null, IsPublic: true },
];

export function toIsoDate(dateLike: Date | string | null | undefined): string {
  if (!dateLike) return '';
  if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike.trim())) {
    return dateLike.trim();
  }
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildLimitGroupById(limitGroups: LimitGroup[] = []): Record<string, LimitGroup> {
  return (limitGroups.length ? limitGroups : DEFAULT_LIMIT_GROUPS).reduce<
    Record<string, LimitGroup>
  >((acc, group) => {
    acc[group.ID] = group;
    return acc;
  }, {});
}

export function buildLimitGroupIdByShiftType(
  shiftTypes: ShiftTypeDefinition[] = [],
): Record<string, string> {
  const types = shiftTypes.length ? shiftTypes : DEFAULT_SHIFT_TYPES;
  return types.reduce<Record<string, string>>((acc, shiftType) => {
    if (shiftType.GroupID) {
      acc[shiftType.Name.toUpperCase()] = shiftType.GroupID;
    }
    return acc;
  }, {});
}

export function buildLimitOverridesByDateAndGroup(
  shiftBlocks: ShiftBlockOverride[] = [],
): Record<string, Record<string, number>> {
  return shiftBlocks.reduce<Record<string, Record<string, number>>>((acc, block) => {
    const dateKey = toIsoDate(block.Date);
    if (!dateKey) return acc;
    if (!acc[dateKey]) acc[dateKey] = {};
    acc[dateKey][block.ShiftType] = block.MaxSlots;
    return acc;
  }, {});
}

export function buildUsageByDateAndGroup(
  requests: RequestRecord[] = [],
  limitGroupIdByShiftType: Record<string, string> = {},
): Record<string, Record<string, number>> {
  return (requests ?? []).reduce<Record<string, Record<string, number>>>((acc, request) => {
    const status = (request?.status ?? '').toLowerCase();
    if (status && status !== 'active') return acc;

    const requestType = (request?.request ?? '').toString().trim().toUpperCase();
    const groupId = limitGroupIdByShiftType[requestType];
    if (!groupId) return acc;

    const dateKey = toIsoDate(request?.date);
    if (!dateKey) return acc;

    if (!acc[dateKey]) acc[dateKey] = {};
    acc[dateKey][groupId] = (acc[dateKey][groupId] ?? 0) + 1;
    return acc;
  }, {});
}

export function getLimitStatusForType({
  type,
  date,
  limitGroupIdByShiftType = {},
  limitGroupById = {},
  limitOverridesByDateAndGroup = {},
  usageByDateAndGroup = {},
  initialValues,
}: {
  type: string;
  date: string;
  limitGroupIdByShiftType?: Record<string, string>;
  limitGroupById?: Record<string, LimitGroup>;
  limitOverridesByDateAndGroup?: Record<string, Record<string, number>>;
  usageByDateAndGroup?: Record<string, Record<string, number>>;
  initialValues?: { id?: number | string; date?: string; request?: string } | null;
}): LimitStatusResult {
  const groupId = limitGroupIdByShiftType[(type || '').toUpperCase()];
  if (!groupId) return { isLimited: false };

  const group = limitGroupById[groupId] || DEFAULT_LIMIT_GROUPS.find((g) => g.ID === groupId);
  if (!group) return { isLimited: false };

  const override = limitOverridesByDateAndGroup[date]?.[groupId];
  const limit = override !== undefined ? override : group.DefaultLimit;
  const usage = usageByDateAndGroup[date]?.[groupId] ?? 0;

  let effectiveUsage = usage;
  if (initialValues?.id) {
    const editingDateKey = toIsoDate(initialValues?.date);
    const editingType = (initialValues?.request ?? '').toUpperCase();
    const editingGroupId = limitGroupIdByShiftType[editingType];
    if (editingDateKey === date && editingGroupId === groupId) {
      effectiveUsage = Math.max(0, usage - 1);
    }
  }

  return {
    isLimited: true,
    groupName: group.GroupName,
    limit,
    usage: effectiveUsage,
    isAtLimit: effectiveUsage >= limit,
  };
}

export function getMonthlyRequestCount({
  requests = [],
  targetName,
  dateString,
  initialRequestId,
}: {
  requests?: RequestRecord[];
  targetName?: string;
  dateString?: string;
  initialRequestId?: number | string;
} = {}): number {
  if (!targetName || !dateString) return 0;
  const targetDate = new Date(dateString);
  if (Number.isNaN(targetDate.getTime())) return 0;

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const normalizedTargetName = targetName.trim().toLowerCase();

  const userActiveRequests = (requests ?? []).filter((request) => {
    const isUser = request.name && request.name.trim().toLowerCase() === normalizedTargetName;
    const isActive = (request.status ?? '').toLowerCase() === 'active';
    if (!isUser || !isActive || !request.date) return false;

    const requestDate = new Date(request.date);
    if (Number.isNaN(requestDate.getTime())) return false;

    return requestDate.getFullYear() === targetYear && requestDate.getMonth() === targetMonth;
  });

  let count = userActiveRequests.length;
  if (initialRequestId) {
    const isEditingInSameMonth = userActiveRequests.some(
      (request) => request.id === initialRequestId,
    );
    if (isEditingInSameMonth) {
      count = Math.max(0, count - 1);
    }
  }
  return count;
}

export function getMonthlyWeekendRequestCount({
  requests = [],
  targetName,
  dateString,
  weekendLimitGroupId = 'ALL',
  limitGroupIdByShiftType = {},
  initialRequestId,
}: {
  requests?: RequestRecord[];
  targetName?: string;
  dateString?: string;
  weekendLimitGroupId?: string;
  limitGroupIdByShiftType?: Record<string, string>;
  initialRequestId?: number | string;
} = {}): number {
  if (!targetName || !dateString) return 0;
  const targetDate = new Date(dateString);
  if (Number.isNaN(targetDate.getTime())) return 0;

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const normalizedTargetName = targetName.trim().toLowerCase();

  const userActiveWeekendRequests = (requests ?? []).filter((request) => {
    const isUser = request.name && request.name.trim().toLowerCase() === normalizedTargetName;
    const isActive = (request.status ?? '').toLowerCase() === 'active';
    if (!isUser || !isActive || !request.date) return false;

    const requestDate = new Date(request.date);
    if (Number.isNaN(requestDate.getTime())) return false;
    const day = requestDate.getDay();
    const isWeekend = day === 0 || day === 6;

    if (!isWeekend) return false;

    if (weekendLimitGroupId !== 'ALL') {
      const requestType = (request.request ?? '').toString().trim().toUpperCase();
      const requestGroupId = limitGroupIdByShiftType[requestType];
      if (requestGroupId !== weekendLimitGroupId) return false;
    }

    return requestDate.getFullYear() === targetYear && requestDate.getMonth() === targetMonth;
  });

  let count = userActiveWeekendRequests.length;
  if (initialRequestId) {
    const isEditingInSameMonth = userActiveWeekendRequests.some(
      (request) => request.id === initialRequestId,
    );
    if (isEditingInSameMonth) {
      count = Math.max(0, count - 1);
    }
  }
  return count;
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(yearMonthKey: string): string {
  if (!yearMonthKey) return '';
  const parts = yearMonthKey.split('-');
  const yearStr = parts[0];
  const monthStr = parts[1];
  if (!yearStr || !monthStr) return yearMonthKey;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (Number.isNaN(year) || Number.isNaN(month)) return yearMonthKey;
  const dateObj = new Date(year, month - 1, 1);
  return dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function getMonthlyStatsForUser({
  requests = [],
  selectedName,
  settings = {},
  shiftTypes = DEFAULT_SHIFT_TYPES,
  limitGroups = DEFAULT_LIMIT_GROUPS,
  calendarMonth,
}: {
  requests?: RequestRecord[];
  selectedName?: string;
  settings?: {
    monthly_request_limit?: number | string;
    monthly_weekend_limit?: number | string;
    weekend_limit_group_id?: string;
  };
  shiftTypes?: ShiftTypeDefinition[];
  limitGroups?: LimitGroup[];
  calendarMonth?: Date;
} = {}): MonthlyStatsItem[] {
  if (
    !selectedName ||
    selectedName.trim().toLowerCase() === 'admin' ||
    selectedName.trim().toLowerCase() === 'guest'
  ) {
    return [];
  }

  const targetName = selectedName.trim().toLowerCase();
  const userActiveRequests = (requests ?? []).filter((request) => {
    const isUser = request.name && request.name.trim().toLowerCase() === targetName;
    const isActive = (request.status ?? '').toLowerCase() === 'active';
    return isUser && isActive;
  });

  const limitGroupIdByShiftType = buildLimitGroupIdByShiftType(shiftTypes);
  const counts: Record<string, number> = {};
  const weekendCounts: Record<string, number> = {};
  const weekendLimitGroupId = settings?.weekend_limit_group_id || 'ALL';

  userActiveRequests.forEach((request) => {
    if (!request.date) return;
    const requestDate = new Date(request.date);
    if (Number.isNaN(requestDate.getTime())) return;

    const key = getMonthKey(requestDate);
    counts[key] = (counts[key] || 0) + 1;

    const day = requestDate.getDay();
    if (day === 0 || day === 6) {
      let applies = true;
      if (weekendLimitGroupId !== 'ALL') {
        const requestType = (request.request ?? '').toString().trim().toUpperCase();
        if (limitGroupIdByShiftType[requestType] !== weekendLimitGroupId) {
          applies = false;
        }
      }
      if (applies) {
        weekendCounts[key] = (weekendCounts[key] || 0) + 1;
      }
    }
  });

  const targetMonth =
    calendarMonth || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const targetKey = getMonthKey(targetMonth);
  const limit = Number(settings?.monthly_request_limit) || DEFAULT_MONTHLY_LIMIT;
  const weekendLimit =
    settings?.monthly_weekend_limit !== undefined
      ? Number(settings.monthly_weekend_limit)
      : DEFAULT_MONTHLY_WEEKEND_LIMIT;
  const weekendTargetName =
    weekendLimitGroupId === 'ALL'
      ? 'Weekend'
      : `Weekend ${limitGroups.find((g) => g.ID === weekendLimitGroupId)?.GroupName || ''}`.trim();

  return [
    {
      key: targetKey,
      label: getMonthLabel(targetKey),
      count: counts[targetKey] || 0,
      limit,
      weekendCount: weekendCounts[targetKey] || 0,
      weekendLimit,
      weekendLabel: weekendTargetName,
    },
  ];
}
