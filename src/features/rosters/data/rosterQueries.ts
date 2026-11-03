import { queryKeys } from '@/platform/query';

/**
 * Roster data layer boundary placeholder (02_TARGET_ARCHITECTURE.md).
 * Queries, atomic publish/amend RPC adapters, and DTO mappers mount here in Wave D.
 */
export function getRosterPeriodQueryKey(year: string, month: string) {
  return queryKeys.rosters.period(year, month);
}
