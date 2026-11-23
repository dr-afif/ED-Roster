import { Component, useState, type ReactNode } from 'react';
import { CheckCircle2, Lock, Save, Settings } from 'lucide-react';
import { OwnerUxBoundary } from '@/platform/auth';
import { useSupabaseMetadata } from '@/platform/supabase';
import {
  buildRequestWindowSummary,
  ModuleBackBar,
  StatusBadge,
  useAppUiState,
  useToast,
} from '@/shared/ui';

class MetadataErrorBoundary extends Component<
  { fallback: string; children: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return <span className="font-mono">{this.props.fallback}</span>;
    }
    return this.props.children;
  }
}

function SupabaseProjectRefValue() {
  const { projectRef } = useSupabaseMetadata();
  return <span className="font-mono">{projectRef}</span>;
}

function ToggleSwitch({
  checked,
  onToggle,
  openLabel = 'Enabled',
  closedLabel = 'Disabled',
  ariaLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  openLabel?: string;
  closedLabel?: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onToggle}
      className="inline-flex min-h-[44px] shrink-0 items-center gap-2 cursor-pointer"
    >
      <span className={`text-xs font-extrabold ${checked ? 'text-[#0F766E]' : 'text-[#78716C]'}`}>
        {checked ? openLabel : closedLabel}
      </span>
      <span
        className={`relative inline-block h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-[#0F766E]' : 'bg-[#D6D3D1]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function clampCutoffDay(raw: string, fallback = 25): number {
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(28, parsed));
}

export function SettingsAdminRoute() {
  const { deptSettings, setDeptSettings } = useAppUiState();
  const showToast = useToast();

  const [departmentName, setDepartmentName] = useState(deptSettings.departmentName);
  const [hospitalName, setHospitalName] = useState(deptSettings.hospitalName);
  const [cutoffDayInput, setCutoffDayInput] = useState(String(deptSettings.cutoffDay));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  const resolvedCutoff = clampCutoffDay(cutoffDayInput, deptSettings.cutoffDay);
  const autoWindowLabel = buildRequestWindowSummary(deptSettings.isWindowOpen, resolvedCutoff);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const clamped = clampCutoffDay(cutoffDayInput, deptSettings.cutoffDay);
    setCutoffDayInput(String(clamped));
    setDeptSettings((prev) => ({
      ...prev,
      departmentName: departmentName.trim() || prev.departmentName,
      hospitalName: hospitalName.trim() || prev.hospitalName,
      cutoffDay: clamped,
    }));
    setSaveStatus('saved');
    showToast('Department settings saved ✓');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  return (
    <OwnerUxBoundary areaName="System & Settings">
      <div className="max-w-[1040px] space-y-4">
        <ModuleBackBar title="Dept Settings" />

        {/* Desktop Header */}
        <div className="hidden lg:flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
              Owner Administration
            </p>
            <h1 className="sr-only lg:not-sr-only text-[26px] font-extrabold tracking-tight text-[#18181B]">
              Dept Settings
              <span className="sr-only"> — System Settings &amp; Request Quotas</span>
            </h1>
            <p className="mt-0.5 text-[13px] font-medium text-[#78716C]">
              Configure department identity, monthly request submission cutoffs, and automation
              integrations.
            </p>
          </div>
          <StatusBadge label="Configuration Active" tone="teal" icon={Settings} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* Left (7 cols): Department & Request Window */}
          <div className="lg:col-span-7">
            <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-6 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#EFECE6]">
                <div>
                  <h2 className="text-[15px] font-extrabold text-[#18181B]">
                    Department &amp; Request Window
                  </h2>
                  <p className="text-xs font-medium text-[#78716C]">
                    Identity, monthly submission cutoff &amp; open/close lock
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-extrabold ${
                    deptSettings.isWindowOpen
                      ? 'border-[#A7F3D0] bg-[#D1FAE5] text-[#065F46]'
                      : 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
                  }`}
                >
                  {deptSettings.isWindowOpen ? '● Currently Open' : '🔒 Currently Closed'}
                </span>
              </div>

              <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
                {/* Stacked Full-Width Department Name & Hospital */}
                <div className="grid grid-cols-1 gap-3.5">
                  <div>
                    <label
                      htmlFor="dept-name"
                      className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#57534E] mb-1"
                    >
                      Department Name
                    </label>
                    <input
                      id="dept-name"
                      type="text"
                      value={departmentName}
                      onChange={(e) => setDepartmentName(e.target.value)}
                      className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2 text-sm font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="hosp-name"
                      className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#57534E] mb-1"
                    >
                      Hospital / Institution
                    </label>
                    <input
                      id="hosp-name"
                      type="text"
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-[#FAF8F5] px-3 py-2 text-sm font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Warm Nested Request Submission Cutoff Box */}
                <div className="rounded-[16px] border border-[#EFECE6] bg-[#FAF8F5] p-4 space-y-3">
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#0F766E]">
                    Request Submission Cutoff
                  </p>

                  <div className="grid gap-3 sm:grid-cols-12 items-start">
                    <div className="sm:col-span-4">
                      <label
                        htmlFor="cutoff-day"
                        className="block text-[11px] font-bold text-[#57534E] mb-1 whitespace-nowrap"
                      >
                        Cutoff Day (1–28)
                      </label>
                      <input
                        id="cutoff-day"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={28}
                        value={cutoffDayInput}
                        onChange={(e) => setCutoffDayInput(e.target.value)}
                        onBlur={() => {
                          const clamped = clampCutoffDay(cutoffDayInput, deptSettings.cutoffDay);
                          setCutoffDayInput(String(clamped));
                          setDeptSettings((prev) => ({ ...prev, cutoffDay: clamped }));
                        }}
                        className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white px-3 py-2 text-center text-sm font-extrabold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-8">
                      <p className="text-[11px] font-bold text-[#57534E] mb-1">
                        Submission Window (Auto-Generated)
                      </p>
                      <div className="rounded-[12px] border border-[#E7E5E4] bg-[#F4F1EA] px-3 py-2 text-xs font-extrabold text-[#18181B] whitespace-normal leading-snug">
                        {autoWindowLabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-[#EFECE6] pt-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#18181B]">
                        {deptSettings.isWindowOpen ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#0F766E]" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-rose-600" />
                        )}
                        <span>MO Request Submission Window</span>
                      </div>
                      <p className="text-[11px] text-[#78716C]">
                        Allow MOs to submit or edit upcoming month requests
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={deptSettings.isWindowOpen}
                      onToggle={() =>
                        setDeptSettings((prev) => ({
                          ...prev,
                          isWindowOpen: !prev.isWindowOpen,
                        }))
                      }
                      openLabel="Open"
                      closedLabel="Closed"
                      ariaLabel="MO Request Submission Window"
                    />
                  </div>
                </div>

                {saveStatus === 'saved' && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E]">
                    <CheckCircle2 className="h-4 w-4" />
                    Settings updated successfully
                  </p>
                )}

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0F766E] px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_2px_10px_rgba(15,118,110,0.22)] transition hover:bg-[#0D655E] cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Department Settings</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right (5 cols): Automation & Integrations */}
          <div className="lg:col-span-5">
            <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-5 space-y-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
              <div className="border-b border-[#EFECE6] pb-3">
                <h2 className="text-[15px] font-extrabold text-[#18181B]">
                  Automation &amp; Integrations
                </h2>
                <p className="text-xs font-medium text-[#78716C]">
                  Toggle active department automations
                </p>
              </div>

              <div className="divide-y divide-[#F4EFE6]">
                <div className="flex items-center justify-between gap-3 pb-2">
                  <div>
                    <p className="text-xs font-extrabold text-[#18181B]">
                      Auto-Enforce Request Quotas
                    </p>
                    <p className="text-[11px] text-[#78716C]">
                      Apply ON1 &amp; OFF-group caps to MOs
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={deptSettings.autoEnforceQuotas}
                    onToggle={() =>
                      setDeptSettings((prev) => ({
                        ...prev,
                        autoEnforceQuotas: !prev.autoEnforceQuotas,
                      }))
                    }
                    ariaLabel="Auto-Enforce Request Quotas"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-xs font-extrabold text-[#18181B]">
                      Telegram Roster &amp; GHKA Alerts
                    </p>
                    <p className="text-[11px] font-bold text-[#0F766E]">● Bot Webhook Connected</p>
                  </div>
                  <ToggleSwitch
                    checked={deptSettings.telegramEnabled}
                    onToggle={() =>
                      setDeptSettings((prev) => ({
                        ...prev,
                        telegramEnabled: !prev.telegramEnabled,
                      }))
                    }
                    ariaLabel="Telegram Roster & GHKA Alerts"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div>
                    <p className="text-xs font-extrabold text-[#18181B]">
                      Google Drive Snapshot Sync
                    </p>
                    <p className="text-[11px] text-[#78716C]">Archive published PDFs to Drive</p>
                  </div>
                  <ToggleSwitch
                    checked={deptSettings.driveSyncEnabled}
                    onToggle={() =>
                      setDeptSettings((prev) => ({
                        ...prev,
                        driveSyncEnabled: !prev.driveSyncEnabled,
                      }))
                    }
                    ariaLabel="Google Drive Snapshot Sync"
                  />
                </div>
              </div>

              {/* Supabase Backend Health Card */}
              <div className="flex items-center justify-between rounded-[14px] border border-[#EFECE6] bg-[#FAF8F5] px-3.5 py-3">
                <div>
                  <p className="text-xs font-extrabold text-[#18181B]">
                    Supabase Backend &amp; RLS
                  </p>
                  <p className="text-[10.5px] font-medium text-[#78716C]">
                    Singapore (ap-southeast-1) &middot;{' '}
                    <MetadataErrorBoundary fallback="env-configured">
                      <SupabaseProjectRefValue />
                    </MetadataErrorBoundary>
                  </p>
                </div>
                <span className="rounded-full border border-[#A7F3D0] bg-[#D1FAE5] px-2.5 py-0.5 text-[10px] font-extrabold text-[#065F46]">
                  ✓ Healthy
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OwnerUxBoundary>
  );
}
