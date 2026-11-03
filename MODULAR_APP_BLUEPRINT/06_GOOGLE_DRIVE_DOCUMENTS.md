# Google Drive and Document Catalog

## Design decision

Google Drive stores document bytes; Supabase stores metadata, ownership, classification and searchable links. The app is a controlled navigator over Drive, not a replacement file system.

## Preferred authorization model

Use an organization-owned Shared Drive and a narrowly scoped service identity with access only to the application root. Google documents that service accounts do not have storage quota and cannot own files; they must upload into Shared Drives or act on behalf of a human through OAuth. See [Shared drives overview](https://developers.google.com/workspace/drive/api/guides/about-shareddrives).

Preferred order:

1. **Shared Drive + service account member** — best ownership continuity.
2. **Shared Drive + domain-wide delegated service account** — only if Workspace administration approves and impersonation is required; use least privilege.
3. **Dedicated Workspace user OAuth with offline refresh token** — fallback when Shared Drive/service account membership is unavailable.

Do not use the owner's normal browser Google OAuth token from Supabase Auth for background Drive operations. Sign-in identity and Drive integration credentials are separate concerns.

## Proposed folder structure

```text
ED Workforce Records/
  00 - Document Inbox/
  01 - Staff Records/
    <staff_code> - <roster_name>/
      2027/
        Courses/
        Annual Practicing Certificates/
        Other Approved Records/
  02 - Rosters/
    2027/
      01 - January/
      02 - February/
  03 - Department Policies/
    2027/
  04 - Templates/
    Roster PDF/
  99 - Archive/
```

Folder names help humans, but code uses stored Drive folder IDs. Renaming a folder must not break document links.

## Provisioning

Provision folders through an owner-only setup function or a one-time controlled script:

1. Verify credential and root access.
2. Create missing child folders idempotently.
3. Store purpose-to-folder-ID mappings in protected application configuration.
4. Record provisioning audit and credential identity.
5. Never create a second folder merely because a name changed; resolve by stored ID first.

## File naming

Names are readable and deterministic:

```text
<staff_code>_<record_type>_<issue-or-expiry-date>_<short-title>_v01.pdf
ED_Roster_2027-01_v01_Initial.pdf
ED_Roster_2027-01_v02_Amendment_2027-01-08.pdf
```

Sanitize reserved characters and cap length. Store original upload name separately.

## Upload flow

1. Client creates/updates Supabase metadata intent.
2. Owner-authorized Edge Function validates the destination and metadata.
3. Function obtains a Google access token from server-side credentials.
4. It uploads file bytes plus metadata using Drive `files.create`; small PDFs may use multipart upload. See [Drive upload guide](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
5. For Shared Drives, requests include `supportsAllDrives=true` where required. See [Shared Drive support](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives).
6. Function writes file ID, parent ID, MIME type, size and SHA-256 to Supabase.
7. Client receives the completed catalog record, not Drive credentials.

## Idempotency and retries

- Each upload intent has a UUID operation ID.
- Save a generated Drive file ID or application `snapshot_id` property before the upload where supported.
- A retry first checks the existing stored file ID/application property.
- Do not identify files solely by name.
- Database status transitions: `pending → uploading → complete` or `failed`.
- A failed metadata update after successful upload enters `reconcile_required`; do not upload a duplicate.

## Searching and navigation

Search Supabase metadata by staff, document type, year, status, issue/expiry date and title. On selection, retrieve or construct a permitted Drive view/download action from the stored file ID.

Do not crawl Drive on every page load. A scheduled or owner-triggered reconciliation may check for missing/moved files and update catalog status.

## Access and sharing

- Default Drive permission is restricted to the organization/approved account set.
- The application does not create public `anyone with link` permissions.
- Staff document access is owner plus subject staff member where institution policy permits.
- Roster PDFs may be visible to all approved staff in the app while the Drive folder remains controlled.
- Direct Drive links must not bypass institutional policy; test access using staff accounts.

## Document intake

For the first release, support an owner-controlled upload and optional staff self-submission into a pending record. Staff-submitted files are not considered verified until the owner reviews metadata and status.

The `00 - Document Inbox` is for human sorting/recovery, not the normal final upload destination.

## Failure and reconciliation cases

| Failure | Required response |
|---|---|
| Google token failure | Mark retryable, no duplicate metadata |
| Drive permission denied | Mark non-retryable until configuration is fixed |
| Upload timeout, outcome unknown | Look up by stored file ID/property before retry |
| File uploaded, DB update failed | Reconcile existing file; never blindly re-upload |
| File deleted manually | Mark catalog record `missing`, preserve history |
| File moved/renamed | Keep working through file ID; refresh cached parent/name |
| Duplicate legacy files | Keep separate evidence until owner approves merge/supersession |

## Backup and audit

- Drive is not the only audit index; Supabase preserves metadata and hashes.
- Roster canonical payload remains in Supabase even if a PDF is missing.
- Periodically export the document catalog and verify a sample of file IDs and checksums.
- Record who uploaded, verified, superseded or marked missing.

