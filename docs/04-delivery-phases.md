# 04 — Delivery Phases

Status: **Approved for build**

The build runs in four phases. Each phase ends with explicit exit criteria; the next phase does not start until they are met. TDD (standards §2) applies inside every phase — "with tests" means tests are written first, not added at the end.

| Phase | Builds | Proves |
|---|---|---|
| **1 — Backend** | Database, domain rules, services, auth, GitHub, reports, exports | Every business rule works without any UI |
| **2 — Frontend** | Every screen and component, against fixture data | Every screen renders every state correctly and accessibly |
| **3 — Integration** | Server Actions, page wiring, proxy, end-to-end journeys | The real app works end to end |
| **4 — Advanced testing** | Property, security, accessibility, performance, time-zone, cross-browser suites | It stays correct under edge cases, attack and load |

---

## Phase 1 — Backend (with tests)

**Goal:** All behaviour in `01-product-spec.md` is implemented and tested below the UI. At the end, every rule could be exercised from a test without a browser.

### 1.0 Foundation
- Repository set up with the provided configs (`tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `package.json`, `compose.yaml`).
- CI pipeline (standards §8) running steps 1–8.
- `lib/result.ts`, `lib/brand.ts`, `assertNever`.
- `server/env.ts` with zod schema and tests for missing and invalid values.
- `server/db/client.ts` including the `date` type parser — **test first:** a `date` column round-trips as the exact same `YYYY-MM-DD` string with the process in `TZ=America/Los_Angeles`.
- Migration `0001_initial` (architecture §5.3) and `scripts/migrate.ts`.
- Test database harness: `tests/setup/global-db.ts` (migrated template database once per run) and `tests/setup/worker-db.ts` (per-worker copy, truncation), plus builders in `tests/fixtures/`. `vitest.config.ts` already points at these two files, so the integration project — and therefore `npm run test` — runs only once they exist. Build them first.
- **Schema contract test:** `db/types.ts` matches `information_schema`.
- **Constraint tests:** each `CHECK`, `UNIQUE` and composite foreign key rejects bad data (e.g. an entry pointing at another project's PR fails at the database).

### 1.1 Domain (pure, 100% coverage)
- `calendar.ts`: `IsoDate` parsing, `today(now, zone)`, add days, weekday, `nextWorkingDay` (BR-03, BR-04), week/month period start and end, period labels.
- `deadlines.ts`: plan-item overdue and due-soon (BR-13, BR-14); issue deadline states and labels (BR-31).
- `pull-request-url.ts`: parsing and org allow-list (BR-21, BR-22).
- `plans.ts`: period validity (BR-08), due date inside period (BR-11), target plan for a carry-over (BR-15).

### 1.2 Authentication
- Session repository and service: create (hashed token, expiry), look up, delete, purge expired.
- OAuth service with injected `fetch`: state generation and verification (timing-safe), code exchange, user fetch, allow-list check.
- Route Handlers `GET /auth/github` and `GET /auth/github/callback`, tested by calling the exported handlers with `Request` objects: cookie flags, state mismatch → 400, wrong user → 403, success → session row + cookie + redirect.
- `requireSession()` behaviour for missing, unknown, and expired tokens.

### 1.3 Projects, areas, people
- Create, rename, archive (BR-05, BR-06); area reorder in one transaction (BR-07); slug generation.

### 1.4 Pull requests
- GitHub client (injected `fetch`, recorded fixtures for open, closed, merged, 404, 401, 403, timeout, malformed JSON).
- Service: add by URL with reuse of existing record (BR-25), refresh (BR-24), no record on failure (BR-26), delete only when unreferenced (BR-36).

### 1.5 Entries
- Create, edit, delete, list by date range with keyset pagination; project-consistency validation (BR-17…BR-20).

### 1.6 Plans
- Get-or-create plan for a period; plan items CRUD; status changes with `completed_on` (BR-16); carry-over with history (BR-15); assignees.

### 1.7 Issues
- Create, edit, resolve, reopen (BR-27…BR-30); assignees; list with computed deadline state.

### 1.8 Releases, notes, report notes
- Releases with linked PRs (BR-32); notes with links and Markdown rendering — **XSS tests** with script tags, `javascript:` links and HTML attributes (BR-33, BR-34); report notes upsert.

### 1.9 Dashboard data
- One service call returning urgent, due-soon, today's plan, open issues and recent entries for a project, plus the overdue counts for the project switcher. Query count asserted.

### 1.10 Reports and exports
- Loaders per report kind with a **fixed query count** asserted regardless of data volume (NF-02).
- `buildReportModel` for daily, weekly, monthly — every rule `R-01`…`R-10` and every section in product spec §7 has a named test. Weekend inclusion (BR-18, §7.3) tested explicitly.
- Markdown renderer with snapshot tests.
- PDF layout module (wrapping, page breaks, footers) unit-tested; PDF renderer smoke-tested (valid PDF header, page count); character sanitiser tested.
- Export Route Handler: session required, input validation, content type, file name, `Cache-Control: no-store`.

### Phase 1 exit criteria
- [ ] Every `BR-xx` and `R-xx` has at least one test whose name contains its ID (a script lists any missing ID and fails CI).
- [ ] Coverage thresholds met (standards §3.2).
- [ ] `npm run check` green; CI green.
- [ ] Migrations apply cleanly to an empty Neon branch.
- [ ] Only `src/server/auth/next-session.ts` (and, from Phase 3, `src/server/actions/`) import `next/*` inside `src/server` (lint-enforced).

---

## Phase 2 — Frontend (with tests)

**Goal:** Every screen in product spec §6 exists as presentational components, built and tested against fixture view-models. No database, no services, no Server Actions yet.

### 2.1 Contracts
- `ui/view-models/*` types for every screen (the shapes components accept), reviewed against the Phase 1 service outputs so the Phase 3 mapping is straightforward.
- `ui/fixtures/*` with realistic data for every state: empty, normal, long text, many items, every status and deadline state.

### 2.2 Foundations
- `tokens.css`: colours (including `success`, `warning`, `danger`, `neutral`), spacing, type scale, radius; light and dark.
- App shell: header, project switcher with overdue counts, project navigation.
- Shared components: `StatusTag`, `DeadlineLabel`, `PersonList`, `EmptyState`, `ConfirmDialog`, `FormField`, `ErrorSummary`.

### 2.3 Screens
Sign in · Project switcher · Dashboard · Plans (day/week/month, move dialog, history) · Log + Quick log · Issues · Releases · Notes (editor + rendered view) · Reports (selector + preview) · Project settings (areas reorder) · People.

Forms receive their action as a prop typed as `(state, formData) => Promise<State>`, so Phase 2 tests can pass a fake and Phase 3 passes the real Server Action.

### 2.4 Dev-only preview routes
- `app/(dev)/preview/…` renders each screen with fixtures for visual review. These routes return 404 when `NODE_ENV === 'production'` — with a test proving it.

### 2.5 Component tests
For every component and screen:
- Renders each fixture state; empty states show their message.
- Status and deadline states show **both** the colour class and the text label (product spec §5).
- Accessible names, roles, headings order, form labels, error messages linked to fields.
- Keyboard: quick log submits with keyboard only; dialogs trap and return focus; reorder works without a mouse.
- Form error states display the messages the action returns.

### Phase 2 exit criteria
- [ ] Every screen in product spec §6 has a component and a preview route.
- [ ] Component tests cover every fixture state; coverage thresholds met.
- [ ] No component imports anything under `src/server` (lint-enforced).
- [ ] Client Components listed with a one-line justification each.
- [ ] `npm run check` green.

---

## Phase 3 — Backend–frontend integration (with tests)

**Goal:** The real application, end to end, on Netlify.

### 3.1 Wiring
- **Mappers** from service outputs to view-models (`server/…` → `ui/view-models`), unit-tested.
- **Server Actions** in `server/actions/`: `requireSession` → parse `FormData` with zod → call service → map `Result` to form state → `revalidatePath` / `redirect`. Each action has an integration test calling it directly.
- **Pages and layouts** in `app/`: session check, project ownership check, service call, mapper, component. No logic beyond that.
- `proxy.ts`: nonce-based CSP and cookie-presence redirect; static security headers in `next.config.ts`.
- `error.tsx`, `not-found.tsx`, and the sign-in page wired to OAuth.

### 3.2 End-to-end environment
- Playwright starts the built app against a test Postgres.
- **Authentication in E2E:** a test helper inserts a session row and sets the cookie directly; GitHub OAuth itself is covered by Phase 1 handler tests.
- **GitHub in E2E:** `GITHUB_API_URL` points to a small local fake server (`tests/e2e/fake-github/server.ts`, plain `node:http`) started by Playwright that serves recorded PR responses. `env.ts` accepts only `https://` URLs or `http://localhost:{port}` for this variable.

### 3.3 End-to-end journeys
1. Sign-in redirect: unauthenticated visit to any page lands on sign-in.
2. Set up: create project, add and reorder areas, add people.
3. Plan the week: create week and day plan items with assignees.
4. Log work: quick-log three entries across two PRs by pasting PR links; titles appear.
5. Carry over: an item due yesterday shows red on the dashboard and switcher; move it; history shows the move; red clears.
6. Issues: create with deadline; due-soon yellow; resolve late → red "late"; resolve on time → green.
7. Release: create, link PRs, mark released.
8. Notes: write Markdown with a link; renders; HTML is shown as text.
9. Reports: daily, weekly and monthly preview; export PDF and Markdown; downloaded Markdown matches the preview content.
10. Sign out: session is gone; back button does not show data.

### 3.4 Deployment
- Netlify site connected; environment variables set; production deploy from `main`; preview deploys for pull requests against a **Neon branch per preview**.
- Production smoke test after deploy: sign-in page loads, security headers present.

### Phase 3 exit criteria
- [ ] All ten journeys pass in CI.
- [ ] Every Server Action and Route Handler has an unauthenticated-access test.
- [ ] Production deploy works; Kasim can sign in and nobody else can.
- [ ] `npm run check` and full CI green.

---

## Phase 4 — Advanced testing

**Goal:** Confidence beyond the happy path. Each suite below is added to CI (nightly where noted).

### 4.1 Property-based tests (`fast-check`)
- Calendar: for any date, `nextWorkingDay` is a weekday, strictly later, and at most 3 days later; week start is always a Monday ≤ the date; month periods tile the year with no gaps or overlaps.
- Deadlines: overdue and due-soon are mutually exclusive; a done item is never overdue; moving a due date later never makes an item *more* overdue.
- Report grouping: every entry in the period appears exactly once in the daily report; no entry outside the period appears; area and PR ordering rules always hold.
- PDF sanitiser: any Unicode string produces renderable output without throwing.
- PR URL parser: never accepts a URL whose host is not exactly `github.com`.

### 4.2 Time-zone and clock suite
- Full unit and integration suites run under `TZ=UTC`, `TZ=Africa/Kampala`, `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati`; results must be identical.
- Clock scenarios around Kampala midnight (20:59, 21:00, 21:01 UTC), Friday evening → Monday, month and year ends, leap day.

### 4.3 Security suite
- **Route inventory test:** enumerates every page, Route Handler and Server Action and asserts each rejects a missing, unknown and expired session.
- **Tampering:** every mutation with an ID from another project is rejected.
- **XSS payloads** in every text field: escaped in UI, Markdown export and PDF.
- **Injection strings** round-trip unchanged through every text field.
- **Headers:** CSP with nonce, HSTS, nosniff, frame-ancestors on every response; cookies have `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`.
- **OAuth:** replayed state, missing state, mismatched state, wrong user id, open-redirect attempts.
- **Secrets:** the production client bundle is scanned for the token prefix and env variable names; none present.
- `npm audit --omit=dev` with zero high or critical findings (nightly).

### 4.4 Accessibility suite
- `@axe-core/playwright` on every page in every main state: zero violations at WCAG 2.2 AA.
- Keyboard-only versions of journeys 4, 5 and 9.
- Status information is readable with colours disabled (forced-colors mode screenshot check).

### 4.5 Performance suite (nightly)
- Seed script: 1 project, 10,000 entries, 1,500 PRs, 500 issues, 2 years of plans.
- Assert `NF-01` (dashboard), `NF-02` (report model), `NF-03` (PDF export).
- Query counts per page and per report kind are fixed.
- `EXPLAIN` for dashboard and report queries uses the intended indexes — no sequential scans on `entries`, `plan_items`, `issues`.
- Client JavaScript budget per route recorded from the build output; regression above the agreed budget fails.

### 4.6 Cross-browser and visual
- Playwright projects: Chromium, Firefox, WebKit, plus a phone viewport for dashboard, quick log and reports.
- Screenshot comparisons (`toHaveScreenshot`) for dashboard, plans and report preview in light and dark themes.

### 4.7 Export fidelity
- The PDF layout module and the Markdown renderer consume the same `ReportModel`; a test asserts both produce the same sequence of headings, item texts and status labels for every fixture report.

### Phase 4 exit criteria
- [ ] All suites above in CI (performance, audit and cross-browser nightly; the rest on every PR).
- [ ] Zero accessibility violations; zero high/critical audit findings.
- [ ] `NF-01`…`NF-08` each have an automated check.
- [ ] A short test report documenting results and any accepted exceptions.
