# Frontend Architecture and UX System

## Stack baseline

- React with TypeScript and Vite.
- React Router with a GitHub Pages-compatible routing strategy decided during scaffold (HashRouter is the simplest initial option; BrowserRouter requires a tested 404 fallback).
- `@supabase/supabase-js` with generated database types.
- TanStack Query for server state.
- React Hook Form and Zod for forms/contracts.
- Tailwind CSS with semantic design tokens.
- Accessible primitive components such as Radix/shadcn-style source components, reviewed rather than accepted blindly.
- Lucide SVG icons with one consistent stroke style.
- Vitest, Testing Library, MSW and Playwright.

Pin package versions and commit the lockfile when implementation begins.

## Route map

```text
/
/rosters/:yyyy/:mm
/requests
/profile/me
/records
/documents
/updates

/admin/staff
/admin/requests
/admin/rules
/admin/settings
/admin/audit
/admin/migration
```

Admin routes still rely on server/RLS authorization. Route guards improve UX but are not security.

## Navigation

Desktop:

- collapsible left sidebar with icons and labels;
- preserve collapsed preference locally;
- collapse by default in roster Focus Mode;
- clear environment/status indicator in non-production.

Mobile:

- top header plus no more than five bottom destinations: Home, Roster, Requests, Records and More;
- owner administration appears inside More, not as overcrowded tabs;
- no hover-only interactions.

## Visual direction

Use restrained frosted glass, not translucent decoration everywhere.

- Background: soft cool neutral with subtle gradient/texture.
- Navigation, dialogs and summary cards: semi-opaque surfaces with blur and visible borders.
- Dense tables, roster cells and forms: more opaque surfaces for legibility.
- Provide a solid-color fallback where backdrop blur is unsupported.
- Do not place glass over busy imagery.

Initial semantic palette:

| Token | Light value/direction | Use |
|---|---|---|
| `surface-canvas` | cool gray near `#F4F7FB` | page background |
| `surface-glass` | white at approximately 82–92% opacity | shell/cards |
| `surface-solid` | white | grids/forms |
| `text-primary` | slate near `#0F172A` | primary text |
| `text-secondary` | slate near `#475569` | secondary text |
| `brand-primary` | indigo near `#4F46E5` | primary actions/focus |
| `brand-secondary` | teal near `#0F766E` | supporting emphasis |
| `success` | accessible emerald | confirmed/saved |
| `warning` | accessible amber/brown | warnings |
| `danger` | accessible red | destructive/error |

Final tokens must be contrast-tested. Components consume semantic tokens, never ad hoc hex values.

Typography:

- self-hosted Inter variable or a tested system sans-serif stack;
- 16 px default body text;
- 12/14/16/18/24/32 scale;
- tabular numerals for roster counts and audit tables;
- roster cells may use a separately approved compact scale but never below 10 px in fit modes.

Spacing and shape:

- 4/8 px spacing rhythm;
- 12–16 px card radius, smaller radius for dense cells;
- 44×44 CSS-pixel minimum primary touch target;
- consistent shadow/elevation scale;
- 150–300 ms meaningful transitions, disabled under reduced motion.

## Page responsibilities

### Dashboard

- current/upcoming roster summary;
- own pending requests and record expiries;
- owner-only operational issues and migration/cutover notices;
- no vanity charts before essential actions.

### Roster workspace

- desktop-first editing grid with sticky staff and date headers;
- Fit Month, Fit Entire Roster and Comfortable modes;
- selected row/column emphasis;
- keyboard navigation using a documented roving focus model;
- staff search, current-week focus and compact legend;
- persistent save/revision status;
- collapsible issues/guidance panel;
- mobile uses selected person/day context and controlled horizontal scroll rather than unreadable full fit.

### Profile and records

- profile summary, editable sections and verification badges;
- courses/certificates in a searchable list or timeline;
- expiry status shown with text and icon, not color alone;
- Drive document actions only when authorized.

### Rules/settings

- group by business area;
- show active version/effective date and draft changes;
- typed controls with helper text;
- impact preview before activation;
- audit link and rollback by creating a new version, not editing old versions.

## Loading, empty and error states

- Reserve layout to avoid cumulative shift.
- Use skeletons for loads over approximately 300 ms.
- Every empty state explains why and offers a permitted next action.
- Errors state cause in plain language and offer Retry/Edit/Revert where applicable.
- One persistent save-status surface replaces repetitive success toasts.
- Toasts use `aria-live=polite`, never steal focus, and are not the only record of failure.

## Forms

- Visible labels; placeholders are examples only.
- Validation on blur/submit rather than disruptive per-keystroke errors.
- Error message beneath the field and summary with links for multi-error forms.
- Focus the first invalid field after submit.
- Mark required fields and distinguish read-only from disabled.
- Confirm dismissal when a modal/sheet has unsaved changes.
- Destructive actions are separated and require confirmation proportional to risk.

## Accessibility

Target WCAG 2.2 AA:

- 4.5:1 normal text contrast and 3:1 large/graphical contrast;
- browser zoom enabled;
- full keyboard support and visible 2–4 px focus indicator;
- skip link and logical headings;
- accessible names for icon-only controls;
- table/grid row and column semantics;
- color never carries state alone;
- focus trap/restore for dialogs and sheets;
- reduced-motion support;
- 44×44 minimum key mobile controls;
- screen-reader announcements for save/conflict state;
- test at 375, 768, 1024 and 1440 CSS px plus 200% zoom.

## Performance

- Route-level code splitting.
- Fetch narrow period/profile slices, not all data.
- Avoid virtualizing the roster until measured; a 31-day moderate staff grid may be simpler and more accessible as a real table/grid.
- If virtualization becomes necessary, preserve keyboard and screen-reader alternatives.
- Debounce search and rapid draft edits.
- Reserve dimensions for logos/icons.
- No third-party script in the critical path.

## PWA/offline boundary

PWA support is optional for January if it threatens correctness. If included:

- cache shell and last-confirmed read data only;
- clearly label stale/offline data;
- safe draft outbox may persist with encryption/privacy review;
- never show publish/amend/ledger actions as confirmed offline;
- generate/version the service worker through build tooling, not a hand-edited cache list;
- clear old caches safely after deployment/path changes.

