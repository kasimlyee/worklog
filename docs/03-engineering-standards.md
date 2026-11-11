# 03 — Engineering Standards

Status: **Mandatory** · Applies to every line of code, every phase, every contributor (human or AI)

---

## 1. The three golden rules

Every change is judged against these three. A reviewer can reject any change that breaks one.

### 1.1 Performance
- Do the least work per request: fixed query counts, no per-row queries, indexes for every filter used on a hot path.
- Server-render; send client JavaScript only where interaction needs it.
- Measure before optimising. Targets are in the product spec (`NF-01`…`NF-04`); meeting them is required, beating them is not.

### 1.2 Security
- Every input from outside the process is untrusted: forms, URLs, cookies, GitHub responses, environment variables. Validate at the boundary, then work with typed values.
- Every adapter (page, layout, Server Action, Route Handler) checks the session itself.
- Secrets live only in `server/env.ts` and never reach logs or the browser.

### 1.3 Simplicity
- The simplest code that satisfies the spec and the tests. No speculative abstraction, configuration or generality.
- Plain functions and data. A class only when something genuinely has identity and lifecycle (in practice: error subclasses, if any).
- Fewer dependencies (see `02-architecture.md` §2). Before adding one, write down why the platform is not enough.
- If a reviewer needs an explanation to understand it, it is too clever — or it needs a comment saying *why*.

### 1.4 When they conflict
1. **Security is never traded away.**
2. Then **simplicity**.
3. Then **performance** — complexity for speed is accepted only when a measured `NF-xx` target is missed.

## 2. Test-driven development

TDD is the working method, not a phase at the end.

### 2.1 The cycle
1. **Red** — write one failing test describing the next small behaviour. Run it; see it fail for the right reason.
2. **Green** — write the minimum production code to pass it.
3. **Refactor** — clean up code and test with all tests green. No new behaviour during refactor.
4. Repeat. Commit at green.

### 2.2 Rules
- **No production code without a failing test that needed it.** Configuration and pure type declarations are the exception.
- **Bugs start with a test.** Reproduce the bug as a failing test first; the fix is the green step.
- **Test names state the rule**, and reference its ID where one exists:
  `it('BR-13: item due Friday is overdue from the following Monday', …)`
- **One behaviour per test.** Arrange–Act–Assert, visibly separated.
- **Tests are deterministic.** Time, randomness and the network are injected; no test depends on the real clock, the real GitHub, test order or another test's data.
- **Test behaviour through public interfaces**, not private helpers or internal call order.

### 2.3 What gets mocked
| Boundary | In tests |
|---|---|
| Postgres | **Real** Postgres (Docker locally, service container in CI). Never mocked. |
| GitHub API | `fetch` is a parameter of the GitHub client; tests pass a fake that returns recorded responses. |
| Clock | `now` / `today` passed as parameters. |
| Randomness | Token generator passed as a parameter where tests need fixed values. |
| Next.js runtime | Not mocked. Services do not depend on it; adapters are covered by end-to-end tests. |

## 3. Test types, locations, commands

| Type | File pattern | Location | Runs against | Command |
|---|---|---|---|---|
| Unit | `*.test.ts` | Next to the source | Nothing external | `npm run test:unit` |
| Integration | `*.int.test.ts` | Next to the source | Real Postgres | `npm run test:integration` |
| Component | `*.ui.test.tsx` | Next to the component | jsdom | `npm run test:ui` |
| End-to-end | `*.spec.ts` | `tests/e2e/` | Built app + Postgres | `npm run test:e2e` |

### 3.1 Database tests
- Each Vitest worker gets its **own database** (`worklog_test_{workerId}`), created from a migrated template once per run. Workers never share data.
- Tables are truncated before each test. No test relies on data from another.
- Test data comes from **builders** in `tests/fixtures/` (`aProject()`, `anEntry({ workDate: … })`) with sensible defaults and overrides — never from large shared seed files.

### 3.2 Coverage thresholds (enforced in CI)
| Scope | Lines | Branches |
|---|---|---|
| `src/server/domain/**` | 100% | 100% |
| `src/server/reports/**` | 95% | 90% |
| `src/server/services/**` | 90% | 85% |
| Everything else in `src/` | 80% | 75% |

Coverage is a floor, not a goal. A test that executes code without asserting behaviour is a defect.

### 3.3 Speed budgets
- Unit suite: under 10 seconds.
- Integration suite: under 60 seconds.
- A slow test is a bug to fix, not a test to skip.

## 4. TypeScript rules

The compiler configuration is the strictest practical (`tsconfig.json`). On top of it:

| Rule | Detail | Enforced by |
|---|---|---|
| **No `any`** | Not explicit, not implicit, not through `as any`, not in tests. | `noImplicitAny`, `@typescript-eslint/no-explicit-any` and the `no-unsafe-*` family |
| **`unknown` at boundaries** | Untrusted data enters as `unknown` and becomes typed only through a zod schema. | Review + `no-unsafe-*` |
| **No non-null assertions** | `value!` is banned. Handle `undefined` explicitly. | `no-non-null-assertion` |
| **Type assertions are rare** | `as T` only inside a brand constructor after validation, and `as const`. Anywhere else needs a comment justifying why the type system cannot express it. Object-literal assertions are banned. | `consistent-type-assertions` + review |
| **No `@ts-ignore`, no `@ts-nocheck`** | `@ts-expect-error` only in tests that check a type error, with a description. | `ban-ts-comment` |
| **Exhaustive switches** | Every `switch` on a union handles all members; `default` calls `assertNever(x)`. | `switch-exhaustiveness-check` |
| **No enums, no namespaces** | Use string-literal unions and `as const` objects. | `erasableSyntaxOnly` |
| **Explicit boundary types** | Exported functions declare parameter and return types. | `explicit-module-boundary-types` |
| **Readonly by default** | Parameters and returned data are `readonly` / `ReadonlyArray` unless mutation is the point. | Review |
| **Handle every promise** | No floating promises; no async functions where a sync value is expected. | `no-floating-promises`, `no-misused-promises` |
| **Optional means optional** | `exactOptionalPropertyTypes` is on: `{ a?: string }` does not accept `{ a: undefined }`. Model "explicitly empty" as `string \| null`. | Compiler |
| **Indexed access may be missing** | `noUncheckedIndexedAccess` is on: `arr[0]` is `T \| undefined`. | Compiler |

## 5. Code style

### 5.1 Naming
| Thing | Convention | Example |
|---|---|---|
| Files and folders | kebab-case | `pull-request-url.ts` |
| Types, components | PascalCase | `PlanItem`, `StatusTag` |
| Functions, variables | camelCase, verbs for functions | `nextWorkingDay`, `isOverdue` |
| Constants | camelCase; UPPER_CASE only for true compile-time configuration | `maxDescriptionLength` |
| Booleans | `is`/`has`/`can` prefix | `hasPullRequest` |
| Database | snake_case (Kysely `CamelCasePlugin` maps it) | `work_date` → `workDate` |

### 5.2 Structure
- **Named exports only.** Default exports only where Next.js requires them (`page.tsx`, `layout.tsx`, config files).
- One responsibility per module. If a file's name needs "and", split it.
- Functions do one thing; a function over ~40 lines is a signal to split.
- No barrel files (`index.ts` re-exports). Import from the module that defines the thing.
- Relative imports only within the same folder, always with the file extension (`./calendar.ts`). Anything in another folder is imported through `#src/…` — never `../`. Both are lint-enforced, and they are what makes the layer rules reliable.
- Comments explain **why**, never **what**. Rule IDs in comments link code to the spec: `// BR-15: carry-over records history`.

### 5.3 Errors
- Expected failures return `Result<T, E>` with a discriminated error `code`. Callers must handle every code (exhaustive switch).
- Exceptions are for bugs and infrastructure failure only. Caught once in the adapter, logged with an error code, and shown as a generic message.
- Never swallow an error. Never `catch` just to re-throw unchanged.
- User-facing messages are written in the service error mapping, not scattered through components.

## 6. Security practices (checklist for every change)

- [ ] New input is validated with zod at the boundary; lengths are bounded.
- [ ] The adapter calls `requireSession()` before anything else.
- [ ] Any ID from the URL or a form is checked to belong to the project in the URL.
- [ ] No `sql.raw` with non-constant input.
- [ ] No new `dangerouslySetInnerHTML`.
- [ ] External URLs are `https?://` only and rendered with `rel="noopener noreferrer"`.
- [ ] Nothing secret is logged, returned to the client, or prefixed `NEXT_PUBLIC_`.
- [ ] New server modules import `server-only`.

## 7. Performance practices (checklist for every change)

- [ ] No query inside a loop. Lists of children come from `jsonArrayFrom` or one `WHERE … IN` query.
- [ ] New filters or sorts on large tables have an index, with a test asserting the query count.
- [ ] Client Components are leaf-level and justified.
- [ ] No new runtime dependency (or the dependency table is updated with a justification).

## 8. Version control and CI

- **Small changes.** One behaviour or one refactor per pull request.
- **Conventional commits:** `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.
- `main` is always deployable. Netlify deploys previews for pull requests and production from `main`.
- **CI pipeline, in order, each step blocking:**
  1. `npm ci`
  2. `npm run typecheck`
  3. `npm run lint` (zero warnings)
  4. `npm run test:unit`
  5. `npm run test:integration` (Postgres service container)
  6. `npm run test:ui`
  7. `npm run test:coverage` thresholds
  8. `npm run test:rules` — every spec rule has a named test (from the end of Phase 1)
  9. `npm run build`
  10. `npm run test:e2e` (from Phase 3)
- Dependencies are pinned to exact versions (`.npmrc` `save-exact=true`) and updated deliberately, one at a time, with the full suite.

## 9. Definition of done

A change is done only when **all** are true:

1. Behaviour matches the product spec, and every touched rule ID has a test naming it.
2. Tests were written first and are green; coverage thresholds hold.
3. `npm run check` passes with zero type errors and zero lint warnings.
4. The security and performance checklists (§6, §7) are satisfied.
5. No new dependency without an updated justification table.
6. Docs are updated if behaviour, schema or configuration changed.
