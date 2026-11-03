import { Layers, Lock } from 'lucide-react';
import type { DeliveryWave } from '@/shared/types';
import { PageHeader } from './PageHeader';
import { StatusBadge } from './StatusBadge';
import { SurfaceCard } from './SurfaceCard';

type ModulePlaceholderPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  modulePath: string;
  targetWave: DeliveryWave;
  rlsContract: string;
  plannedCapabilities: readonly string[];
};

export function ModulePlaceholderPanel({
  eyebrow,
  title,
  description,
  modulePath,
  targetWave,
  rlsContract,
  plannedCapabilities,
}: ModulePlaceholderPanelProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<StatusBadge label={`Planned · ${targetWave}`} tone="brand" icon={Layers} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SurfaceCard variant="glass" className="space-y-2.5">
          <h2 className="text-sm font-semibold text-text-primary">Module Boundary</h2>
          <p className="text-xs leading-relaxed text-text-secondary">
            Owned by <code className="font-mono text-text-primary">{modulePath}</code>. Internals
            remain private to this feature folder; cross-feature contracts pass exclusively through
            typed platform queries and shared schemas.
          </p>
        </SurfaceCard>

        <SurfaceCard variant="glass" className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-brand-secondary" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="text-sm font-semibold text-text-primary">Authorization &amp; RLS</h2>
          </div>
          <p className="text-xs leading-relaxed text-text-secondary">{rlsContract}</p>
        </SurfaceCard>
      </div>

      <SurfaceCard variant="solid" className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">
          Deferred Operational Scope (Not Implemented in Foundation Scaffold)
        </h2>
        <p className="text-sm text-text-secondary">
          This route intentionally renders an architectural placeholder during Wave A so module
          routing, focus management, and responsive layout can be verified before database schemas
          and RLS policies are approved.
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-text-secondary">
          {plannedCapabilities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SurfaceCard>
    </div>
  );
}
