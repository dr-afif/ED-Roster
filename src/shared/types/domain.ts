/**
 * Cross-feature domain contract primitives.
 * Feature-specific models stay private inside src/features/<module>/.
 */
export type AppRole = 'owner' | 'staff';

export type AppEnvironment = 'local' | 'staging' | 'production' | 'test';

export type RosterLifecycleStatus = 'draft' | 'published' | 'amended' | 'closed';

export type DeliveryWave = 'Wave A' | 'Wave B' | 'Wave C' | 'Wave D' | 'Wave E';

export type OperationId = string;

export type EntityRevision = number;
