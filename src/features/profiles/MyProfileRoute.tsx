import { useState } from 'react';
import { CheckCircle2, IdCard, Mail, Phone, ShieldAlert, User } from 'lucide-react';
import { useAuth } from '@/platform/auth';
import { Button, PageHeader, StatusBadge, SurfaceCard } from '@/shared/ui';
import { FormField } from '@/shared/forms';
import { useMyProfileQuery, useUpdateMyProfileMutation, type MyProfileData } from './useMyProfile';

function ProfileEditForm({ profile }: { profile: MyProfileData }) {
  const updateMutation = useUpdateMyProfileMutation();

  const [fullName, setFullName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [registrationNumber, setRegistrationNumber] = useState(profile.registration_number || '');
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

    try {
      await updateMutation.mutateAsync({
        full_name: fullName,
        phone,
        registration_number: registrationNumber,
      });
      setSuccessMessage('Your profile contact details have been updated.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  }

  return (
    <SurfaceCard className="p-6">
      <div className="pb-4 border-b border-border-subtle">
        <h2 className="text-base font-semibold text-text-primary">
          Personal Contact &amp; Clinical Registration
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Updates to these fields are isolated to your private staff profile protected by Postgres
          Row Level Security.
        </p>
      </div>

      {successMessage && (
        <div
          role="status"
          className="mt-4 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm font-medium text-success"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger"
        >
          <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
        <FormField
          id="profile-fullname"
          label="Full Registered Name"
          required
          hint="Your official legal name as registered with the hospital and council."
        >
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              id="profile-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-surface-solid py-2.5 pl-10 pr-3.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
            />
          </div>
        </FormField>

        <FormField
          id="profile-phone"
          label="Contact Phone Number"
          hint="Used for urgent operational contact during roster disruptions."
        >
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+6012-3456789"
              className="w-full rounded-xl border border-border-subtle bg-surface-solid py-2.5 pl-10 pr-3.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
            />
          </div>
        </FormField>

        <FormField
          id="profile-mmc"
          label="Malaysian Medical Council (MMC) Registration Number"
          hint="Official clinical license number for statutory roster validation."
        >
          <div className="relative">
            <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              id="profile-mmc"
              type="text"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="MMC 12345"
              className="w-full rounded-xl border border-border-subtle bg-surface-solid py-2.5 pl-10 pr-3.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
            />
          </div>
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
          <Button variant="primary" type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving Changes...' : 'Save Profile Details'}
          </Button>
        </div>
      </form>
    </SurfaceCard>
  );
}

export function MyProfileRoute() {
  const { user } = useAuth();
  const { data: profile, isLoading, error } = useMyProfileQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Staff Identity"
          title="My Profile"
          description="Loading personal staff records..."
        />
        <SurfaceCard className="p-12 text-center text-sm text-text-secondary">
          Fetching profile from database...
        </SurfaceCard>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Staff Identity"
          title="My Profile"
          description="View operational directory identity and maintain permitted personal contact fields."
        />
        <SurfaceCard className="p-8 text-center" role="alert">
          <p className="text-sm font-medium text-danger">
            {error ? error.message : 'No linked staff directory record found for your account.'}
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            Please contact the Roster Administrator to link your Google email to an operational
            staff code.
          </p>
        </SurfaceCard>
      </div>
    );
  }

  const isVerified = profile.verification_status === 'verified';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff Identity"
        title="My Profile"
        description="View your operational roster identity and maintain permitted personal contact details."
        actions={
          <StatusBadge
            label={isVerified ? 'Credentials Verified' : 'Unverified Credentials'}
            tone={isVerified ? 'success' : 'warning'}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Operational Directory Card (Read-Only) */}
        <div className="space-y-6 lg:col-span-1">
          <SurfaceCard className="p-6 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary font-bold text-lg">
                {profile.directory.roster_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {profile.directory.roster_name}
                </h2>
                <p className="text-xs text-text-secondary font-mono">
                  {profile.directory.staff_code}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-text-secondary">
                  Staff Group / Clinical Grade
                </p>
                <p className="mt-0.5 font-medium text-text-primary">
                  {profile.directory.staff_group}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-text-secondary">Employment Status</p>
                <div className="mt-1">
                  <StatusBadge
                    label={profile.directory.employment_status.toUpperCase()}
                    tone={profile.directory.active ? 'success' : 'warning'}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-text-secondary">Connected Google Identity</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-primary">
                  <Mail className="h-3.5 w-3.5 text-text-secondary shrink-0" />
                  <span>{user?.email ?? 'Unknown'}</span>
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-text-secondary">Credential Verification</p>
                <div className="mt-1">
                  <StatusBadge
                    label={profile.verification_status.toUpperCase()}
                    tone={isVerified ? 'success' : 'warning'}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border-subtle">
              <p className="text-xs text-text-secondary leading-relaxed">
                Operational roster fields and role permissions are managed by the Roster
                Administrator to preserve historical roster immutability.
              </p>
            </div>
          </SurfaceCard>
        </div>

        {/* Right Column: Editable Contact Information */}
        <div className="lg:col-span-2">
          <ProfileEditForm key={profile.staff_id} profile={profile} />
        </div>
      </div>
    </div>
  );
}
