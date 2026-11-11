# Task Brief: TASK-006 Google Drive Catalog, Deterministic PDF Generator & Telegram Delivery (Wave F)

## Identity

- Task ID: TASK-006
- Workstream: Wave F — Google Drive Catalog, Deterministic Roster PDF Generator & Telegram Workflow
- Owner/agent: Antigravity
- Branch/worktree: `main`
- Dependencies: TASK-001 (Scaffold baseline), TASK-002 (Identity & RLS Foundation), TASK-003 (Workforce & Requests), TASK-004 (Rules Engine & Draft Grid), TASK-005 (Roster Lifecycle & Amendments)
- Target Environment: Supabase Staging (`hgrutigkgnrcjhcjxabs`)
- Production impact: NONE (Zero production changes, zero production keys)

## Objective

Deliver the complete production-grade Google Drive document catalog, immutable snapshot archive, deterministic landscape A4 PDF generator, and private Telegram notification workflow matching `MODULAR_APP_BLUEPRINT/06_GOOGLE_DRIVE_DOCUMENTS.md` and `MODULAR_APP_BLUEPRINT/07_PDF_TELEGRAM_WORKFLOW.md`:

1. **Database Schema & Migrations (`Wave F Schema`)**:
   - `public.document_records`: Metadata catalog tracking Google Drive files, SHA-256 integrity checksums, file sizes, categories, and RLS policies (`all_staff` vs `self_and_owner`).
   - `public.roster_snapshots`: Immutable frozen payload storage with SHA-256 checksums, versioning per revision, and Drive file ID linkage.
   - `public.roster_snapshot_deliveries`: Telegram dispatch ledger tracking timestamp, Telegram message ID, recipient user, and channel.
   - Postgres RPC `create_or_get_roster_snapshot`: Atomically provisions or retrieves snapshot for a period revision, registering document record and audit event.
   - Postgres RPC `record_snapshot_delivery`: Idempotently logs/updates Telegram notification dispatch.
2. **Deterministic PDF Generator (`src/features/rosters/domain/pdfGenerator.ts`)**:
   - Built on pure `pdf-lib` without browser canvas or native printer dependencies.
   - Landscape A4 geometry (`841.89 x 595.28` pt).
   - Department header: "HOSPITAL SULTAN ABDUL AZIZ SHAH (HSAAS) - EMERGENCY MEDICINE DEPARTMENT".
   - Subtitle: Roster period title, publication status, version, and generation date.
   - Roster grid table: Staff code & name, 28-31 day date headers with weekend tinting, color-coded shift cells.
   - Operational shift legend: AM, PM, ND, OFF, GOFF, AL, EL, MC, etc.
   - Footer: Official confidentiality notice and truncated SHA-256 cryptographic hash.
3. **Snapshot Archival & Telegram Dispatch Workflow**:
   - `RosterSnapshotBar.tsx`: Integrated snapshot bar for published/amended roster views.
   - Instant browser PDF preview (`Preview PDF`).
   - Deterministic freeze & archive (`Archive Snapshot`).
   - Private Telegram notification workflow with confirmation modal.
4. **Documents Catalog Route (`src/features/documents/DocumentsCatalogRoute.tsx`)**:
   - Document navigator with category filter pills (`All`, `Roster Schedules`, `Certifications`, `APC`, `Policies`, `Historical Archives`).
   - Real-time search query filtering.
   - Visual badges for document category, size, date, and SHA-256 checksum with one-click copy.
   - Direct Google Drive link launcher.

## Verification & Quality Gates

- TypeScript: 0 errors (`npm run typecheck`).
- Lint: 0 errors, 0 warnings (`npm run lint`).
- Format: 100% Prettier compliance (`npm run format:check`).
- Unit & integration tests: Full PDF generation, snapshot workflow, and document catalog test suite (`npm test -- --run`).
