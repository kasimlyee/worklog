# 05 — Test report

Status: **Phase 4 complete** · Run on 2026-11-11, macOS (Apple silicon), Node 26, Postgres 17

## Results

| Suite | Command | Result |
|---|---|---|
| Unit | `npm run test:unit` | pass |
| Integration (real Postgres) | `npm run test:integration` | pass |
| Component (jsdom) | `npm run test:ui` | pass |
| All of the above, with coverage | `npm run test:coverage` | **526 tests pass**; thresholds met (domain 100 %) |
| Rule coverage | `node scripts/check-rule-coverage.ts --with-nf` | **54 / 54** (BR-01…BR-36, R-01…R-10, NF-01…NF-08) |
| Time zones | `npm run test:tz` | identical results under UTC, Africa/Kampala, America/Los_Angeles, Pacific/Kiritimati |
| Performance | `npm run test:perf` | pass (below) |
| End to end, Chromium | `npm run test:e2e` | pass: all ten journeys of docs/04 §3.3 plus security, accessibility, rendering |
| End to end, all browsers | `npm run test:e2e:all` | **all pass** on Chromium, Firefox, WebKit and Pixel 7 |
| Client bundle | `npm run test:bundle` | no secret names, token prefixes or values |
| Dependency audit | `npm audit --omit=dev` | **0 vulnerabilities** |

## Non-functional requirements

| ID | Check | Measured |
|---|---|---|
| NF-01 | `performance.perf.test.ts`: dashboard data, p95 of 30 runs, 10,000 entries | under 300 ms; 4 queries; every hot query index-served |
| NF-02 | Monthly report model, p95 of 10 runs | under 500 ms; 10 queries regardless of volume |
| NF-03 | Monthly PDF render, p95 of 5 runs | under 2 s |
| NF-04 | Every page renders with JavaScript off; one-click actions work before hydration; dashboard JS budget | 474,621 bytes uncompressed (budget 550,000) |
| NF-05 | Route inventory × {missing, unknown, expired} session; every Server Action enumerated; export handler | all redirect to sign-in, nothing changes |
| NF-06 | `scripts/scan-client-bundle.ts` after build | clean |
| NF-07 | axe-core, WCAG 2.2 A/AA, every page with data, empty states, dark mode, errors, dialog; keyboard-only journeys 4, 5, 9; forced colours | 0 violations |
| NF-08 | Full E2E suite on four browser projects; phone: no sideways scrolling, quick log works | pass |

Timings are from a laptop with Postgres on localhost. In production, Neon and the Netlify functions must be in the same region (docs/02 §13) for NF-01 to hold over the network.

## Defects found by the suites and fixed

| Found by | Defect | Fix |
|---|---|---|
| E2E journey 2 | The area reorder list kept stale areas after one was added | keyed on the set of areas |
| E2E journey 2 | "Archive" buttons were forms nested in the rename form, so they renamed instead | moved beside the form; component test forbids nested forms on every screen |
| Component tests | Opening Quick log did not put the cursor in the description | focus on open |
| Component tests | A note's `#` heading became a second `<h1>` | note headings start at h3 (D-5) |
| Injection suite | A NUL character in any text field caused a 500 | stripped at validation (D-6) |
| axe | Refresh button failed WCAG 2.5.3 (label in name) | accessible name starts with the visible text |
| WebKit E2E | Pages unstyled on http://localhost | CSP upgrade only on https (D-2) |
| WebKit E2E | Secure cookies refused on http://localhost | cookie names by scheme (D-1) |
| `EXPLAIN` suite | Report queries no index could serve | index-friendly predicates and migration 0002 (D-3) |

## Accepted exceptions

1. **axe is not run on the Quick log error state in Firefox.** Running axe-core there crashes Playwright's patched Firefox build; the same page without axe works (reproduced in isolation). That state is checked in Chromium and WebKit, and the page's behaviour is tested in Firefox.
2. **Visual baselines exist for macOS only** (`tests/e2e/__screenshots__/darwin`). Font rendering differs by platform, so on CI (Linux) the visual test skips until Linux baselines are generated once with `npx playwright test tests/e2e/14-visual.spec.ts --update-snapshots` on Linux and committed.
3. **Index checks price out sequential scans** (`enable_seqscan = off`). On a 500-row issues table Postgres rightly prefers a scan; the check verifies that an index *can* serve every hot query, which is what scales.
4. **Development-only audit findings:** 9 moderate advisories in `minimatch` used by tooling; none in production dependencies. Nightly CI fails on any high or critical production finding.
5. **Not verified here:** the deployed Netlify + Neon environment (no credentials available during the build). `docs/06-deployment.md` lists the steps and the post-deploy smoke test.
