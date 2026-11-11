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
| [`docs/05-test-report.md`](docs/05-test-report.md) | Results of every suite and accepted exceptions |
| [`docs/06-deployment.md`](docs/06-deployment.md) | Neon, GitHub and Netlify setup, step by step |

## Local setup

Requires Node.js 24.2+ (see `.nvmrc`) and Docker. The Docker Postgres listens on **127.0.0.1:5433**, so it never clashes with a Postgres already installed on 5432.

```bash
cp .env.example .env.local      # fill in the values (see below)
docker compose up -d            # local Postgres for dev and tests
npm install
npm run db:migrate
npm run dev                     # http://localhost:3000
```

To sign in locally, create a GitHub OAuth App with callback `http://localhost:3000/auth/github/callback` and put its id and secret, plus your numeric GitHub user id, in `.env.local`. On `http://localhost` cookies are named `worklog_session` (not `__Host-session`) and are not `Secure`, so Safari works locally too; any https `APP_URL` always gets `__Host-` Secure cookies.

Every screen can be seen with fixture data, without signing in, at `http://localhost:3000/preview` (development only; it returns 404 in production).

Deploying: see [`docs/06-deployment.md`](docs/06-deployment.md).

## Scripts

| Script | Purpose |
|---|---|
| `dev` | Run the app locally |
| `build` | Production build |
| `typecheck` | CSS module types up to date, `next typegen`, `tsc --noEmit` |
| `lint` | ESLint with type-aware rules, zero warnings allowed |
| `test` | Unit, integration and component tests |
| `test:unit` | Pure logic only, no database |
| `test:integration` | Repository and service tests against real Postgres |
| `test:ui` | Component tests in jsdom |
| `test:coverage` | `test` with coverage thresholds enforced |
| `test:rules` | Fails if any `BR-xx` / `R-xx` rule has no test naming it (`--with-nf` adds `NF-xx`) |
| `test:e2e` | Playwright end-to-end, Chromium (builds and starts the app on port 3100) |
| `test:e2e:all` | Playwright on Chromium, Firefox, WebKit and a phone viewport |
| `test:tz` | Unit + integration suites under four server time zones |
| `test:perf` | Performance suite: 10,000 entries, NF-01…NF-03, index use (nightly) |
| `test:bundle` | After `build`: fails if any secret could reach the browser (NF-06) |
| `css:types` | Regenerate the `*.module.d.css.ts` files after editing a CSS module |
| `check` | `typecheck` + `lint` + `test` — must pass before every commit |
| `db:migrate` | Apply pending migrations |

Test results and accepted exceptions: [`docs/05-test-report.md`](docs/05-test-report.md).
