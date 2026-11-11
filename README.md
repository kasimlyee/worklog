# Worklog

> Working name. Rename freely — nothing in the specs depends on it.

A personal planning and reporting notebook for a technical lead who manages developers across several projects.

It is **not** a team tool and does not replace Jira, GitHub or Slack. The detail of issues and code lives there. Worklog holds the layer above them: what is planned, who is on it, what is due, what actually got done, and a clean report of it that can be sent to whoever needs it.

## What it does

- **Plans** work per project by day, week and month, with items assigned to developers.
- **Logs** what was done each day, linked to the GitHub PR it came from.
- **Tracks** issues as reminders: who has it, when it was assigned, and its deadline. The full issue description stays in Jira, GitHub or the testing document.
- **Records** releases and in-app notes.
- **Flags** anything overdue in red on the project dashboard until it is moved by hand.
- **Exports** daily, weekly and monthly reports per project as PDF or Markdown. Nobody else ever opens the app.

## Principles

1. **One user.** No organisations, no roles, no sharing inside the app.
2. **Entries are the source of truth.** Reports are generated, never written by hand.
3. **Reminder, not tracker.** Store a link and a short title, not a copy of somebody else's system.
4. **Three golden rules for all code:** performance, security, simplicity.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 6, strictest settings, no `any` |
| Database | Neon Postgres via Kysely (query builder, not an ORM) |
| Auth | GitHub OAuth, single allowed GitHub user |
| GitHub data | Fine-grained token, read-only pull requests |
| Hosting | Netlify |
| Tests | Vitest, Testing Library, Playwright |

See [`docs/02-architecture.md`](docs/02-architecture.md) for the reasoning behind every dependency.

## Documents

| Document | Contents |
|---|---|
| [`docs/01-product-spec.md`](docs/01-product-spec.md) | Features, business rules, reports |
| [`docs/02-architecture.md`](docs/02-architecture.md) | Stack, layers, database schema, auth, exports, security |
| [`docs/03-engineering-standards.md`](docs/03-engineering-standards.md) | Golden rules, TDD, TypeScript rules, testing, definition of done |
| [`docs/04-delivery-phases.md`](docs/04-delivery-phases.md) | The four build phases with exit criteria |

## Local setup

Requires Node.js 22.12+ and Docker (for the local and test Postgres).

```bash
cp .env.example .env.local      # fill in the values
docker compose up -d            # local Postgres for dev and tests
npm install
npm run db:migrate
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `dev` | Run the app locally |
| `build` | Production build |
| `typecheck` | `tsc --noEmit` across the whole project |
| `lint` | ESLint with type-aware rules, zero warnings allowed |
| `test` | All Vitest tests (unit and integration) |
| `test:unit` | Pure logic only, no database |
| `test:integration` | Repository and service tests against real Postgres |
| `test:ui` | Component tests in jsdom |
| `test:coverage` | Vitest with coverage thresholds enforced |
| `test:rules` | Fails if any `BR-xx` / `R-xx` rule in the spec has no test naming it |
| `test:e2e` | Playwright end-to-end, Chromium |
| `test:e2e:all` | Playwright on Chromium, Firefox, WebKit and a phone viewport |
| `check` | `typecheck` + `lint` + `test` — must pass before every commit |
| `db:migrate` | Apply pending migrations |

`npm run test` needs the integration test harness (`tests/setup/global-db.ts`, `tests/setup/worker-db.ts`), which is the first task of Phase 1. Until then, run `npm run test:unit` and `npm run test:ui`.
