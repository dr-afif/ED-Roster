# Product Vision and Scope

## Vision

Create a dependable workforce operations application for the Emergency Department that combines roster planning, staff requests, personal professional records, editable operational policy, and searchable document navigation without relying on Google Sheets as the live application database.

The application should feel calm, modern and trustworthy. It should reduce administrative effort without making clinical or staffing decisions automatically.

## Primary users

### Owner / sole roster administrator

At launch, one approved owner account is responsible for:

- managing the approved email list;
- maintaining the staff directory;
- composing, publishing, amending, closing and reopening rosters;
- configuring typed rules, thresholds and effective dates;
- managing requests and leave records;
- maintaining professional records and document metadata;
- archiving roster PDF snapshots to Drive;
- sending archived PDFs to the owner's private Telegram chat;
- running migration, reconciliation and audit reports.

### Staff member

An approved staff user can:

- sign in using their Google account and retain a normal persistent session;
- see the roster and operational updates allowed to all staff;
- view and maintain approved parts of their own profile;
- submit and review their own requests;
- view their own course, certificate and practicing-certificate records;
- navigate to documents they are permitted to access.

Staff cannot edit roster lifecycle state, policy versions, other users' private records, Drive integration settings, Telegram settings, or audit history.

## January 2027 minimum release

### Must have

- Google sign-in with a database-backed approved-email gate.
- Persistent sessions with explicit sign-out and account-disabled handling.
- Owner and staff permission model enforced by RLS/server functions.
- Staff directory and personal profile pages.
- Basic professional record types: courses and annual practicing certificates.
- Document metadata catalog linked to Google Drive.
- Roster request submission and administration.
- Supabase-native roster drafting, publication, amendment and audit flow.
- Versioned rule settings with effective dates.
- Historical Sheets import and reconciliation.
- Read-only access to historical rosters from Supabase.
- Manual immutable roster PDF archive to Drive.
- Manual private Telegram send for an archived PDF.
- Responsive, accessible interface for desktop and phone.
- Automated test and deployment pipelines.

### Should have if time permits

- Expiry reminders for professional records.
- Rich staff record filters and saved searches.
- Advanced analytics migrated from the legacy app.
- PWA installation and carefully bounded read-only offline behavior.
- Realtime invalidation when two sessions view the same roster.

### After cutover

- Additional record types and configurable renewal workflows.
- More advanced reporting and exports.
- Optional delegate roles only if the owner explicitly changes the single-administrator decision.
- Automated notifications through channels other than the owner's Telegram inbox.

## Explicit non-goals for the first release

- Payroll, overtime calculation or attendance clocking.
- Diagnosis or detailed medical information.
- General-purpose file storage in Supabase Storage.
- A Telegram chatbot for staff or a Telegram broadcast channel.
- Automatic WhatsApp sending.
- Automatically changing a roster to resolve warnings.
- Executing administrator-authored JavaScript or SQL formulas.
- Rewriting or recalculating accepted historical roster outcomes.
- Using Google Sheets as a dual-write or fallback operational database after cutover.

## Success measures

- An approved staff member can sign in and reach their profile without choosing a name manually.
- An unapproved Google account can authenticate with Google but cannot read application data and is signed out with a clear message.
- January 2027 can be drafted, validated, published and amended entirely in Supabase.
- The migrated historical row counts and business totals reconcile with source exports.
- Every privileged roster change has actor, time, reason, revision and idempotency information.
- The owner can archive a PDF, find it in Drive, send it to private Telegram, and share it from a phone.
- A failed Drive or Telegram call can be retried without duplicating the snapshot or delivery record.
- The live legacy application remains available until the replacement passes cutover gates.

## Product principles

1. Auditability before convenience.
2. Advisory automation, human staffing decisions.
3. Clear current state and recovery path for every save.
4. Least privilege and minimum necessary personal data.
5. Version rules rather than rewriting history.
6. Preserve source evidence during migration.
7. Mobile access is essential; complex roster construction remains desktop-first.

