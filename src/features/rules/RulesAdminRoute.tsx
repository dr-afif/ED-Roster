import { OwnerUxBoundary } from '@/platform/auth';
import { ModulePlaceholderPanel } from '@/shared/ui';

export function RulesAdminRoute() {
  return (
    <OwnerUxBoundary areaName="Versioned Rules">
      <ModulePlaceholderPanel
        eyebrow="Owner Administration"
        title="Roster Rules & Thresholds"
        description="Configure effective-dated weekly OFF policies, shift semantic classifications, and minimum staffing thresholds."
        modulePath="src/features/rules"
        targetWave="Wave D"
        rlsContract="Staff read active public rule summaries; owner clones, previews impact, and activates immutable rule_versions under ADR-005 (no arbitrary JS/SQL formulas)."
        plannedCapabilities={[
          'Monday effective-date enforcement for Policy A / Policy B weekly OFF rules.',
          'Versioned shift semantic classification (worked, transparent PN, reset, unknown).',
          'Impact preview against regression corpus prior to activating a new immutable rule version.',
        ]}
      />
    </OwnerUxBoundary>
  );
}
