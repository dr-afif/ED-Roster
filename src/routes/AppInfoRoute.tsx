import { Code2, Database, Globe, Info, ShieldCheck, UserCheck } from 'lucide-react';
import { useSupabaseMetadata } from '@/platform/supabase';

const APP_VERSION = '0.1.0';

export function AppInfoRoute() {
  const metadata = useSupabaseMetadata();
  const crestSrc = `${import.meta.env.BASE_URL}ed-crest.png`;
  const currentYear = new Date().getFullYear();

  const infoItems = [
    {
      icon: UserCheck,
      label: 'Created & Maintained By',
      value: 'Dr. Muhammad Afif',
      detail: 'Emergency Department · Hospital Sultan Abdul Aziz Shah (HSAAS), UPM',
    },
    {
      icon: Info,
      label: 'Current Version',
      value: `v${APP_VERSION}`,
      detail: `Environment: ${metadata.isProduction ? 'Production' : metadata.appEnv}`,
    },
    {
      icon: Globe,
      label: 'Hosting & Platform',
      value: 'GitHub Pages (PWA)',
      detail: 'Progressive Web App served via dr-afif.github.io/ED-Roster',
    },
    {
      icon: Database,
      label: 'Database & Backend',
      value: 'Supabase (PostgreSQL)',
      detail: 'Row-Level Security (RLS) & Google OAuth authentication',
    },
    {
      icon: Code2,
      label: 'Application Stack',
      value: 'React 19 · TypeScript · Vite',
      detail: 'Tailwind CSS · TanStack Query · Automated Roster Rules Engine',
    },
    {
      icon: ShieldCheck,
      label: 'Data & Privacy',
      value: 'Internal Departmental Use',
      detail: 'Restricted to authorized HSAAS Emergency Department personnel only',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="hidden lg:block">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
          Application Details
        </p>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#18181B]">App Info</h1>
        <p className="mt-0.5 text-[13px] font-medium text-[#78716C]">
          Version, infrastructure, authorship, and copyright information.
        </p>
      </div>

      {/* Hero Card */}
      <div className="rounded-[24px] border border-[#E7E5E4] bg-white p-5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={crestSrc}
              alt="Emergency Dept HSAAS crest"
              className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover shadow-sm ring-1 ring-[#E7E5E4]"
            />
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#18181B]">
                ED Roster &amp; Requests
              </h2>
              <p className="text-xs font-semibold text-[#57534E]">
                Emergency Department · HSAAS · UPM
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[#99F6E4] bg-[#F0FDFA] px-3 py-1 text-xs font-extrabold text-[#0F766E]">
            v{APP_VERSION}
          </span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {infoItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[20px] border border-[#E7E5E4] bg-white p-4 shadow-[0_2px_10px_rgba(28,25,23,0.03)]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FAF8F5] border border-[#EFECE6] text-[#0F766E]">
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#78716C]">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm font-extrabold text-[#18181B]">{item.value}</p>
                  <p className="mt-0.5 text-xs font-medium text-[#57534E] leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Copyright Card */}
      <div className="rounded-[20px] border border-[#E7E5E4] bg-[#FAF8F5] px-4 py-3.5 text-center">
        <p className="text-xs font-bold text-[#18181B]">
          &copy; {currentYear} Dr. Muhammad Afif &middot; Emergency Department, HSAAS UPM
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-[#78716C]">
          All rights reserved. Built for internal clinical scheduling, leave requests, and GHKA
          tracking.
        </p>
      </div>
    </div>
  );
}
