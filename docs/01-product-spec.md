# 01 — Product Specification

Status: **Approved for build** · Owner: Kasim

This document defines *what* Worklog does. *How* it is built is in `02-architecture.md`. Every business rule has an ID (`BR-xx`) so tests can name the rule they prove.

---

## 1. Purpose

Worklog is a single user's notebook for running engineering work across several projects:

1. Plan work by day, week and month.
2. Assign plan items and issues to developers and track them against dates.
3. Log what was actually done, grouped by the PR it came from.
4. Keep releases and supporting notes next to the work.
5. Export a clean report for anyone who needs it, without giving them access.

## 2. Scope

### In scope
- Multiple projects, each fully separate (own dashboard, areas, reports).
- Developer names as plain labels (no accounts).
- GitHub PR titles and states fetched from a pasted link.
- Daily, weekly and monthly reports exported as PDF and Markdown.

### Out of scope (non-goals)
These are deliberate. A feature request that falls here needs this document changed first.

- Multiple users, organisations, roles, sharing or comments.
- Copying full issue descriptions — those stay in Jira, GitHub or the testing document. An issue may carry a short description (BR-27), not a copy of the original.
- File attachments or uploads of any kind.
- Saving exported reports. Exports are generated on demand, as often as needed.
- Time tracking in hours, story points, sprints, boards, custom fields.
- Notifications, email, or anything that contacts other people.
- Writing to GitHub. The app only reads.

## 3. Glossary

| Term | Meaning |
|---|---|
| **Project** | A product or engagement. Everything else belongs to exactly one project, except people. |
| **Area** | A section of a project's work, e.g. Frontend, Backend, Mobile, Infra. Defined per project. |
| **Person** | A developer's name, used as a label. Shared across projects. |
| **Plan** | A container of planned work for one period: a day, a week or a month. |
| **Plan item** | One planned piece of work with a due date and assignees. |
| **Entry** | One piece of work actually done, on a specific date. The source of all reports. |
| **Pull request (PR)** | A GitHub PR referenced by URL; its title and state are fetched and stored. |
| **Issue** | A reminder record for a problem reported elsewhere: short title, link, assignees, deadline. |
| **Release** | A version of the project with a date, status, notes and linked PRs. |
| **Note** | A Markdown page written in the app, optionally with external links. |
| **Report note** | An optional short paragraph Kasim writes at the top of a specific report. |
| **Working day** | Monday to Friday. |
| **Today** | The current calendar date in the app time zone (`Africa/Kampala`). |

## 4. Business rules

### 4.1 Time and calendar

- **BR-01** All business dates (work date, due date, deadline, release date) are **calendar dates without time**, interpreted in the app time zone `Africa/Kampala` (configured, not hard-coded).
- **BR-02** "Today" is always computed in the app time zone, never from the server's clock zone. Netlify runs in UTC; the difference matters between 21:00 and 00:00 UTC.
- **BR-03** Working days are Monday to Friday. Public holidays are not modelled.
- **BR-04** The *next working day* after a date is the first following Monday–Friday date. After Friday it is Monday; after Saturday it is Monday.

### 4.2 Projects, areas, people

- **BR-05** Project names are unique. Area names are unique within a project. Person names are unique.
- **BR-06** Projects, areas and people are **archived, never deleted**, so old reports keep their names. Archived items disappear from pickers but remain in history and reports.
- **BR-07** Areas have a display order chosen by the user. Reports list areas in that order.

### 4.3 Plans and plan items

- **BR-08** A plan belongs to one project and has a horizon: `day`, `week` or `month`.
  - A day plan covers one working day.
  - A week plan starts on a Monday and covers Monday–Friday.
  - A month plan starts on the 1st and covers the calendar month.
- **BR-09** At most one plan exists per project, horizon and period.
- **BR-10** A plan item has a title, an optional area, zero or more assignees, a due date and a status: `planned`, `in_progress`, `done` or `blocked`.
- **BR-11** A plan item's due date must fall inside its plan's period.
- **BR-12** A plan item may reference an issue it works on.
- **BR-13** **Overdue:** a plan item that is not `done` is overdue when *today* is on or after the next working day after its due date. Overdue is **calculated, never stored**.
  - Example: due Friday → overdue from Monday. Due Tuesday → overdue from Wednesday.
- **BR-14** **Due soon:** a plan item that is not `done` and not overdue is due soon when its due date is today or the next working day.
- **BR-15** **Carry-over is manual.** Nothing moves automatically. Moving an item:
  1. sets a new due date,
  2. moves it into the plan covering that date and horizon (creating that plan if missing),
  3. records the move (from-date, to-date, when) in the item's history.
- **BR-16** A plan item records `completed_on` when it becomes `done` and clears it if reopened.

### 4.4 Entries

- **BR-17** An entry has a work date, a description, an area, one or more people, and optionally a PR, a plan item it fulfils, and an issue it relates to.
- **BR-18** Entries are recorded on the **actual date the work was done**, including Saturday and Sunday.
- **BR-19** An entry's area, PR, plan item and issue must all belong to the entry's project.
- **BR-20** Linking an entry to a plan item does **not** change the plan item's status automatically. Marking done is a separate, explicit action. (One plan item may need several entries.)

### 4.5 Pull requests

- **BR-21** A PR is added by pasting its URL. The only accepted form is `https://github.com/{owner}/{repo}/pull/{number}`. Anything else is rejected with a clear message.
- **BR-22** `{owner}` must be in the configured allow-list of GitHub organisations.
- **BR-23** On add, the app fetches the PR's title and state (`open`, `closed`, `merged`) **once** and stores them. Reports never call GitHub.
- **BR-24** A "refresh" action re-fetches title and state on demand.
- **BR-25** A PR is stored once per project. Pasting the same URL again reuses the existing record.
- **BR-26** If GitHub is unreachable or the token lacks access, the PR is **not** created and the user sees why. No half-filled PR records.

### 4.6 Issues

- **BR-27** An issue has a short title, an optional short description (plain text, at most 2,000 characters), an optional external link, an optional area, one or more assignees, an assigned date, a deadline date, a priority (BR-37), and a status: `open`, `in_progress` or `resolved`.
- **BR-28** The deadline must be on or after the assigned date.
- **BR-29** When an issue becomes `resolved`, `resolved_on` is recorded (defaults to today, editable). Reopening clears it.
- **BR-30** An issue may reference the PR that resolved it.
- **BR-31** Deadline state of an issue, calculated, never stored:

  | Condition | State | Colour | Label example |
  |---|---|---|---|
  | Not resolved, overdue by the BR-13 rule applied to the deadline | `overdue` | Red | "3 days overdue" |
  | Not resolved, deadline today or next working day | `due_soon` | Yellow | "Due tomorrow" |
  | Not resolved, otherwise | `on_track` | Neutral | "Due in 6 days" |
  | Resolved on or before the deadline | `on_time` | Green | "Resolved on time" |
  | Resolved after the deadline | `late` | Red | "Resolved 2 days late" |

  Day counts in labels are **calendar days** between the two dates.

- **BR-37** An issue has a priority: `low`, `medium` (default), `high` or `urgent`. Priority is the user's judgement and is independent of the deadline state:
  - An unresolved `urgent` issue appears in the dashboard's *Urgent* section even when it is not overdue.
  - The Issues screen can filter by priority and sort by priority (urgent first, then by deadline).
  - Colours: `urgent` red, `high` yellow, `medium` and `low` neutral — always with the text label.
  - Reports show the priority of `high` and `urgent` issues next to the issue.

### 4.7 Releases and notes

- **BR-32** A release has a version (unique within the project), a status (`planned` or `released`), a target date, a released date (required when `released`), notes in Markdown and zero or more linked PRs.
- **BR-33** Notes are Markdown written in the app. Raw HTML in Markdown is **not** rendered — it shows as text.
- **BR-34** External links (on notes and issues) must be `https://` or `http://` URLs. Links open in a new tab without passing the referrer.
- **BR-35** A note may be attached to a release or a PR.

### 4.8 Deletion

- **BR-36** Entries, plan items, issues, releases and notes can be deleted after confirmation. Deleting a PR is only allowed when nothing references it.

## 5. Status colours

Colours are semantic and identical in the UI and in PDF exports. Colour is never the only signal — every coloured element also carries a text label (accessibility, and black-and-white printing).

| Token | Colour | Used for |
|---|---|---|
| `success` | Green | Done, merged, released, resolved on time |
| `warning` | Yellow | In progress, due soon |
| `danger` | Red | Overdue, blocked, resolved late, closed-unmerged PR |
| `neutral` | Grey | Planned, open, on track, not started |

## 6. Screens

| Screen | Contents |
|---|---|
| **Sign in** | One "Sign in with GitHub" button. |
| **Project switcher** | All active projects. Each shows a red count of overdue items + issues if any. |
| **Project dashboard** | Urgent (overdue plan items and issues, oldest first) · Due soon · Today's plan · Open issues by deadline · Recent entries. |
| **Plans** | Day / week / month view; create items; change status; move (carry-over) with history visible. |
| **Log** | Entries by date, newest first; quick-add form; filter by area, person, PR. |
| **Quick log** | Reachable from every project page. Fields: date (default today), description, area, people, PR URL, plan item, issue. Submits with keyboard only. |
| **Issues** | Table with priority, assignees, deadline state, link out; filter and sort by priority; resolve / reopen. |
| **Releases** | List and detail with linked PRs and notes. |
| **Notes** | List, editor, rendered view. |
| **Reports** | Choose type and period → preview → export PDF / Markdown. Report note editable here. |
| **Settings (per project)** | Name, description, areas (add, rename, reorder, archive), archive project. |
| **People** | Global list: add, rename, archive. |

## 7. Reports

### 7.1 Common rules
- **R-01** Each report covers exactly one project and one period.
- **R-02** The preview, the PDF and the Markdown are produced from **the same report model**. They must never differ in content.
- **R-03** Header: project name · report type · period (e.g. "Week of 9–13 Nov 2026") · "Prepared by {author name}" · generated date.
- **R-04** The optional **report note** appears directly under the header.
- **R-05** Areas appear in the project's area order. Entries with no area go in a final "General" section.
- **R-06** Inside an area, PR groups appear first (ordered by PR number), then entries without a PR (ordered by date, then creation time).
- **R-07** PR groups show `#{number} {title}` and the PR state with its colour.
- **R-08** Sections with no content are omitted, never shown empty. A report with no content at all still exports, with "No work recorded for this period."
- **R-09** People are shown by name after each item (e.g. "— Ali, Grace").
- **R-10** Status colours follow section 5 and always include the text label.

### 7.2 Daily report
1. Header and report note.
2. **Work done** — by area → PR → every entry.
3. **Releases** released that day.
4. **Issues** resolved that day (with on-time / late state) and issues that became overdue that day.
5. **Plan vs. actual** for that day's plan: done · not done (red) · unplanned work (entries not linked to any plan item).

### 7.3 Weekly report
Period: Monday–Friday. Saturday/Sunday are included **only if they have entries**, and labelled as weekend work.

1. Header and report note.
2. **Summary line** — counts: entries, PRs touched, PRs merged, releases, issues resolved.
3. **Work done** — by area → **one line per PR** (title, state, number of entries) → entries without a PR listed individually.
4. **Releases** in the week.
5. **Issues** — resolved (on time / late), still open and overdue.
6. **Per developer** — for each person: entries count, issues resolved on time vs. late, open overdue items.
7. **Plan vs. actual** for the week plan and its day plans: done, not done, carried over during the week (with count), unplanned work.

### 7.4 Monthly report
1. Header and report note.
2. **Summary line** — as weekly, for the month.
3. **Releases** in the month with their linked PRs.
4. **Merged PRs** per area (title and number only).
5. **Completed plan items** from week and month plans.
6. **Issues** — resolved on time vs. late, still open and overdue.
7. **Per developer** — as weekly, for the month.
8. **Plan vs. actual** for the month plan.

### 7.5 Export formats
- **Markdown:** CommonMark. Colours appear as text labels only, e.g. `**[Merged]**`.
- **PDF:** A4 portrait, plain typography, status labels as coloured tags. Page numbers in the footer. File name: `{project-slug}_{type}_{period-start}.pdf`.

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| **NF-01** | Dashboard server response < 300 ms at p95 with 10,000 entries in the project (Neon in the same region as the Netlify functions). |
| **NF-02** | Any report model builds in a **fixed number of queries** (no per-row queries), < 500 ms for a month with 2,000 entries. |
| **NF-03** | PDF export of a monthly report < 2 s. |
| **NF-04** | Pages are server-rendered; client JavaScript only where interaction needs it. |
| **NF-05** | Only the configured GitHub user can sign in. Every page, server action and route handler checks the session itself. |
| **NF-06** | No secret (GitHub token, OAuth secret, database URL) ever reaches the browser bundle. |
| **NF-07** | WCAG 2.2 AA for all screens. Keyboard-only use must work everywhere. |
| **NF-08** | Latest two versions of Chrome, Firefox, Safari and Edge. Usable on a phone for reading and quick logging. |

## 9. Possible later additions (not part of this build)
- Public holidays calendar.
- Bulk move of overdue items.
- Saving export snapshots.
- Upgrade to TypeScript 7 once the lint toolchain supports it.
