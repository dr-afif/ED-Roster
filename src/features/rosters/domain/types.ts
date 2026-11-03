import type { RosterLifecycleStatus } from '@/shared/types';

/**
 * Pure roster domain boundary placeholder (02_TARGET_ARCHITECTURE.md, 05_ROSTER_RULES_ENGINE.md).
 * Wave C/D ports deterministic weekly OFF, sequence, staffing, and GOFF calculations here
 * with zero network, clock, or browser dependencies.
 */
export type RosterPeriodShellDescriptor = {
  readonly year: string;
  readonly month: string;
  readonly lifecycleStatus: RosterLifecycleStatus;
};
