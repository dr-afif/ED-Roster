import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  IdCard,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  User,
} from 'lucide-react';
import { useAuth } from '@/platform/auth';
import { ModuleBackBar, SkeletonProfileView, StatusBadge, useToast } from '@/shared/ui';
import { useMyProfileQuery, useUpdateMyProfileMutation, type MyProfileData } from './useMyProfile';

const DOB_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatMyIc(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

function parseIcBirthday(ic: string): string {
  const digits = ic.replace(/\D/g, '');
  if (digits.length < 6) return 'Auto from I.C.';
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (!Number.isFinite(mm) || mm < 1 || mm > 12 || !Number.isFinite(dd) || dd < 1 || dd > 31) {
    return 'Invalid I.C. date';
  }
  const year = yy <= 30 ? 2000 + yy : 1900 + yy;
  return `${dd} ${DOB_MONTHS[mm - 1]} ${year}`;
}

function formatMalaysiaPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('60')) {
      const rest = digits.slice(2, 12);
      if (rest.length <= 2) return `+60${rest}`;
      return `+60${rest.slice(0, 2)}-${rest.slice(2)}`;
    }
    return `+${digits.slice(0, 13)}`;
  }
  const digits = trimmed.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function splitRegistrationAndApc(raw?: string | null): {
  mmc: string;
  apc: string;
  hasTelegramTag: boolean;
} {
  if (!raw) return { mmc: '', apc: '', hasTelegramTag: false };
  const parts = raw
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  const hasTelegramTag = parts.some((p) => p.toUpperCase() === 'TG');
  const nonTgParts = parts.filter((p) => p.toUpperCase() !== 'TG');
  const mmc = nonTgParts.find((p) => !/^APC\b/i.test(p)) || '';
  const apcPart = nonTgParts.find((p) => /^APC\b/i.test(p)) || nonTgParts[1] || '';
  return {
    mmc,
    apc: apcPart.replace(/^APC\s*:?\s*/i, '').trim(),
    hasTelegramTag,
  };
}

function ProfileEditForm({
  profile,
  initialDisplayName,
}: {
  profile: MyProfileData;
  initialDisplayName: string;
}) {
  const updateMutation = useUpdateMyProfileMutation();
  const showToast = useToast();
  const parsedCreds = splitRegistrationAndApc(profile.registration_number);

  const [fullName, setFullName] = useState(profile.full_name || '');
  const [displayName, setDisplayName] = useState(
    initialDisplayName || profile.directory.roster_name,
  );
  const [icNumber, setIcNumber] = useState('940512-10-5421');
  const [phone, setPhone] = useState(profile.phone || '');
  const [registrationNumber, setRegistrationNumber] = useState(parsedCreds.mmc);
  const [apcNumber, setApcNumber] = useState(parsedCreds.apc);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    const segments: string[] = [];
    if (registrationNumber.trim()) {
      segments.push(registrationNumber.trim());
    }
    if (apcNumber.trim()) {
      segments.push(`APC ${apcNumber.trim().replace(/^APC\s*/i, '')}`);
    }
    if (parsedCreds.hasTelegramTag) {
      segments.push('TG');
    }
    const combinedRegistration = segments.join(' | ');

    try {
      await updateMutation.mutateAsync({
        full_name: fullName,
        phone,
        registration_number: combinedRegistration,
      });
      setSuccessMessage('Your profile contact details have been updated.');
      showToast('Profile details saved ✓');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  }

  return (
    <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-6 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
      <div className="pb-3.5 border-b border-[#EFECE6]">
        <h2 className="text-[15px] font-extrabold text-[#18181B]">Personal Information</h2>
        <p className="mt-1 text-xs italic text-[#78716C]">
          For use in official roster and GHKA memo.
        </p>
      </div>

      {successMessage && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-[16px] border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-[16px] border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-700"
        >
          <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5">
        <div>
          <label
            htmlFor="profile-fullname"
            className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#57534E] mb-1"
          >
            Full Registered Name <span className="text-rose-500">*</span>
          </label>
          <p className="text-[10.5px] italic text-[#78716C] mb-1.5">
            For use in official roster and GHKA memo
          </p>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
            <input
              id="profile-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white py-2.5 pl-10 pr-3.5 text-sm font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>

        {/* Display Name | Roster Name (2 columns even on mobile) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="profile-displayname"
              className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#57534E] mb-1"
            >
              Display Name
            </label>
            <input
              id="profile-displayname"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white py-2.5 px-3 text-xs sm:text-sm font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="profile-rostername"
              className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#57534E] mb-1"
            >
              Roster Name
            </label>
            <input
              id="profile-rostername"
              type="text"
              value={profile.directory.roster_name}
              disabled
              className="w-full rounded-[12px] border-[1.5px] border-[#EFECE6] bg-[#FAF8F5] py-2.5 px-3 text-xs sm:text-sm font-bold text-[#78716C]"
            />
          </div>
        </div>

        {/* MMC # | APC # (2 columns even on mobile) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="profile-mmc"
              className="block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#57534E] mb-1"
            >
              Malaysian Medical Council (MMC) Registration Number
            </label>
            <div className="relative">
              <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
              <input
                id="profile-mmc"
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="MMC 12345"
                className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white py-2.5 pl-9 pr-2.5 text-xs sm:text-sm font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="profile-apc"
              className="block text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#57534E] mb-1"
            >
              Annual Practicing Certificate (APC) Number
            </label>
            <div className="relative">
              <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
              <input
                id="profile-apc"
                type="text"
                value={apcNumber}
                onChange={(e) => setApcNumber(e.target.value)}
                placeholder="APC 2027-44102"
                className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white py-2.5 pl-9 pr-2.5 text-xs sm:text-sm font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* I.C. | Birthday (Auto) (2 columns even on mobile) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="profile-ic"
              className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#57534E] mb-1"
            >
              I.C. Number
            </label>
            <input
              id="profile-ic"
              type="tel"
              inputMode="numeric"
              value={icNumber}
              onChange={(e) => setIcNumber(formatMyIc(e.target.value))}
              placeholder="940512-10-5421"
              className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white py-2.5 px-3 text-xs sm:text-sm font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="profile-dob"
              className="block text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#57534E] mb-1"
            >
              Birthday (Auto)
            </label>
            <input
              id="profile-dob"
              type="text"
              value={parseIcBirthday(icNumber)}
              disabled
              className="w-full rounded-[12px] border-[1.5px] border-[#EFECE6] bg-[#FAF8F5] py-2.5 px-3 text-xs sm:text-sm font-extrabold text-[#0F766E]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="profile-phone"
            className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#57534E] mb-1"
          >
            Contact Phone Number
          </label>
          <p className="text-[10.5px] text-[#78716C] mb-1.5">
            Used for urgent operational contact during roster disruptions (10 or 11 digits).
          </p>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
            <input
              id="profile-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setPhone((prev) => formatMalaysiaPhone(prev))}
              placeholder="+6012-3456789"
              className="w-full rounded-[12px] border-[1.5px] border-[#E7E5E4] bg-white py-2.5 pl-10 pr-3.5 text-sm font-semibold text-[#18181B] focus:border-[#0F766E] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EFECE6]">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full sm:w-auto rounded-full bg-[#0F766E] px-5 py-2.5 text-[13px] font-extrabold text-white shadow-[0_2px_10px_rgba(15,118,110,0.22)] transition hover:bg-[#0D655E] disabled:opacity-60 cursor-pointer"
          >
            {updateMutation.isPending ? 'Saving Changes...' : 'Save Profile Details'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function MyProfileRoute() {
  const { user, signOut } = useAuth();
  const { data: profile, isLoading, error } = useMyProfileQuery();
  const [shiftRemindersEnabled, setShiftRemindersEnabled] = useState(true);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ModuleBackBar title="My Profile" />
        <div>
          <p className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
            Staff Identity
          </p>
          <h1 className="sr-only lg:not-sr-only text-[26px] font-extrabold tracking-tight text-[#18181B]">
            My Profile
          </h1>
          <p className="hidden lg:block mt-0.5 text-[13px] font-medium text-[#78716C]">
            Loading personal staff records...
          </p>
        </div>
        <SkeletonProfileView />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <ModuleBackBar title="My Profile" />
        <div>
          <p className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
            Staff Identity
          </p>
          <h1 className="sr-only lg:not-sr-only text-[26px] font-extrabold tracking-tight text-[#18181B]">
            My Profile
          </h1>
        </div>
        <div
          className="rounded-[22px] border border-[#E7E5E4] bg-white p-8 text-center"
          role="alert"
        >
          <p className="text-sm font-semibold text-rose-600">
            {error ? error.message : 'No linked staff directory record found for your account.'}
          </p>
          <p className="mt-2 text-xs text-[#78716C]">
            Please contact the Roster Administrator to link your Google email to an operational
            staff code.
          </p>
        </div>
      </div>
    );
  }

  const isVerified = profile.verification_status === 'verified';
  const parsedCreds = splitRegistrationAndApc(profile.registration_number);
  const telegramLinked = parsedCreds.hasTelegramTag || isVerified;
  const rawName = (profile.full_name || profile.directory.roster_name).replace(/^Dr\.?\s+/i, '');
  const initials =
    rawName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || profile.directory.roster_name.slice(0, 2).toUpperCase();
  const isOwner = user?.role === 'owner';

  return (
    <div className="space-y-4 sm:space-y-5">
      <ModuleBackBar title="My Profile" />

      {/* Desktop Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.08em] text-[#0F766E]">
            Staff Identity
          </p>
          <h1 className="sr-only lg:not-sr-only text-[26px] font-extrabold tracking-tight text-[#18181B]">
            My Profile
          </h1>
          <p className="hidden lg:block mt-0.5 text-[13px] font-medium text-[#78716C]">
            View your operational roster identity and maintain permitted personal contact details.
          </p>
        </div>
        <div className="hidden lg:block">
          <StatusBadge
            label={isVerified ? 'Credentials Verified' : 'Unverified Credentials'}
            tone={isVerified ? 'success' : 'warning'}
          />
        </div>
      </div>

      {/* 1. Identity Hero Card */}
      <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#0F766E] text-white text-base font-extrabold">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-[15.5px] font-extrabold text-[#18181B] leading-tight truncate">
                {profile.full_name || profile.directory.roster_name}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-[#57534E] truncate">
                <Mail className="h-3 w-3 shrink-0 text-[#78716C]" />
                <span className="truncate">{user?.email ?? 'Unknown'}</span>
              </p>
              <p className="mt-0.5 text-[11px] font-extrabold text-[#0F766E]">
                <span>{profile.directory.staff_code}</span> &middot;{' '}
                <span>{profile.directory.staff_group}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-extrabold ${
                isOwner
                  ? 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
                  : 'border-[#C7D8AF] bg-[#E5EED8] text-[#365314]'
              }`}
            >
              {isOwner ? 'Owner' : 'MO'}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile: Personal Info -> Notifications & Telegram -> Account Session/Sign Out at bottom */}
      {/* Desktop: 2-Column Layout (Left: Notifications & Telegram + Session, Right: Personal Info) */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 lg:grid-cols-12 items-start">
        <div className="order-2 lg:order-1 space-y-4 lg:col-span-4">
          {/* Notifications & Telegram Card */}
          <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-5 space-y-3.5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#0F766E]" />
                <h3 className="text-[14px] font-extrabold text-[#18181B]">
                  Notifications &amp; Telegram
                </h3>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${
                  telegramLinked
                    ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                    : 'border-[#E7E5E4] bg-[#F5F5F4] text-[#78716C]'
                }`}
              >
                {telegramLinked ? '✓ Linked' : 'Not Linked'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#EFECE6] bg-[#FAF8F5] px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-[#18181B]">Telegram Duty Alerts</div>
                    <div className="text-[10.5px] font-semibold text-[#78716C]">
                      Roster publications &amp; amendment pings
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shiftRemindersEnabled}
                  aria-label="Toggle Telegram Duty Alerts"
                  onClick={() => setShiftRemindersEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    shiftRemindersEnabled ? 'bg-[#0F766E]' : 'bg-[#D6D3D1]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                      shiftRemindersEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl border border-[#EFECE6] bg-[#FAF8F5] px-3 py-2">
                  <div className="text-[10px] font-bold uppercase text-[#78716C]">Status</div>
                  <div className="mt-0.5 font-extrabold text-[#18181B]">
                    {profile.directory.employment_status.toUpperCase()}
                  </div>
                </div>
                <div className="rounded-xl border border-[#EFECE6] bg-[#FAF8F5] px-3 py-2">
                  <div className="text-[10px] font-bold uppercase text-[#78716C]">Verification</div>
                  <div className="mt-0.5 font-extrabold text-[#0F766E]">
                    {profile.verification_status.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Session / Sign Out Card */}
          <div className="rounded-[22px] border border-[#E7E5E4] bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(28,25,23,0.03)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13.5px] font-extrabold text-[#18181B]">Account Session</p>
                <p className="text-[11px] font-medium text-[#78716C]">
                  Signed in via Supabase Auth
                </p>
              </div>
              <button
                type="button"
                onClick={() => void signOut?.()}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-extrabold text-rose-700 transition hover:bg-rose-100 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (First after Hero on Mobile): Personal Info Form */}
        <div className="order-1 lg:order-2 lg:col-span-8">
          <ProfileEditForm
            key={profile.staff_id}
            profile={profile}
            initialDisplayName={user?.displayName || profile.directory.roster_name}
          />
        </div>
      </div>
    </div>
  );
}
