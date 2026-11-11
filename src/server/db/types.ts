import type { ColumnType, Generated } from 'kysely';

/*
 * Hand-written to match migrations (docs/02 §5.2). The schema contract test
 * (types.int.test.ts) compares `schemaContract` below with information_schema.
 */

/** Postgres `date`, returned by our type parser as the raw `YYYY-MM-DD` string. */
type DateColumn = string;
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type CreatedAt = ColumnType<Date, Date | string | undefined, never>;

export type PlanHorizon = 'day' | 'week' | 'month';
export type PlanItemStatus = 'planned' | 'in_progress' | 'done' | 'blocked';
export type IssueStatus = 'open' | 'in_progress' | 'resolved';
export type PrState = 'open' | 'closed' | 'merged';
export type ReleaseStatus = 'planned' | 'released';
export type ReportKind = 'daily' | 'weekly' | 'monthly';

export type SessionsTable = {
  tokenHash: Buffer;
  githubUserId: ColumnType<string, number | string, never>;
  createdAt: CreatedAt;
  expiresAt: ColumnType<Date, Date, Date>;
};

export type ProjectsTable = {
  id: Generated<string>;
  slug: string;
  name: string;
  description: Generated<string>;
  archivedAt: Timestamp | null;
  createdAt: CreatedAt;
  updatedAt: Generated<Timestamp>;
};

export type AreasTable = {
  id: Generated<string>;
  projectId: string;
  name: string;
  position: number;
  archivedAt: Timestamp | null;
  createdAt: CreatedAt;
};

export type PeopleTable = {
  id: Generated<string>;
  name: string;
  archivedAt: Timestamp | null;
  createdAt: CreatedAt;
};

export type PullRequestsTable = {
  id: Generated<string>;
  projectId: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: PrState;
  fetchedAt: ColumnType<Date, Date, Date>;
  createdAt: CreatedAt;
};

export type IssuesTable = {
  id: Generated<string>;
  projectId: string;
  areaId: string | null;
  resolvedByPrId: string | null;
  title: string;
  externalUrl: string | null;
  status: Generated<IssueStatus>;
  assignedOn: DateColumn;
  deadline: DateColumn;
  resolvedOn: DateColumn | null;
  createdAt: CreatedAt;
  updatedAt: Generated<Timestamp>;
};

export type IssueAssigneesTable = {
  issueId: string;
  personId: string;
};

export type PlansTable = {
  id: Generated<string>;
  projectId: string;
  horizon: PlanHorizon;
  periodStart: DateColumn;
  createdAt: CreatedAt;
};

export type PlanItemsTable = {
  id: Generated<string>;
  projectId: string;
  planId: string;
  areaId: string | null;
  issueId: string | null;
  title: string;
  status: Generated<PlanItemStatus>;
  dueDate: DateColumn;
  completedOn: DateColumn | null;
  position: Generated<number>;
  createdAt: CreatedAt;
  updatedAt: Generated<Timestamp>;
};

export type PlanItemAssigneesTable = {
  planItemId: string;
  personId: string;
};

export type PlanItemMovesTable = {
  id: Generated<string>;
  planItemId: string;
  fromPlanId: string;
  toPlanId: string;
  fromDue: DateColumn;
  toDue: DateColumn;
  movedAt: CreatedAt;
};

export type EntriesTable = {
  id: Generated<string>;
  projectId: string;
  workDate: DateColumn;
  description: string;
  areaId: string | null;
  pullRequestId: string | null;
  planItemId: string | null;
  issueId: string | null;
  createdAt: CreatedAt;
  updatedAt: Generated<Timestamp>;
};

export type EntryPeopleTable = {
  entryId: string;
  personId: string;
};

export type ReleasesTable = {
  id: Generated<string>;
  projectId: string;
  version: string;
  status: Generated<ReleaseStatus>;
  targetDate: DateColumn | null;
  releasedOn: DateColumn | null;
  notes: Generated<string>;
  createdAt: CreatedAt;
  updatedAt: Generated<Timestamp>;
};

export type ReleasePullRequestsTable = {
  projectId: string;
  releaseId: string;
  pullRequestId: string;
};

export type NotesTable = {
  id: Generated<string>;
  projectId: string;
  releaseId: string | null;
  pullRequestId: string | null;
  title: string;
  body: Generated<string>;
  createdAt: CreatedAt;
  updatedAt: Generated<Timestamp>;
};

export type NoteLinksTable = {
  id: Generated<string>;
  noteId: string;
  label: string;
  url: string;
  position: Generated<number>;
};

export type ReportNotesTable = {
  projectId: string;
  kind: ReportKind;
  periodStart: DateColumn;
  body: string;
  updatedAt: Generated<Timestamp>;
};

export type Database = {
  sessions: SessionsTable;
  projects: ProjectsTable;
  areas: AreasTable;
  people: PeopleTable;
  pullRequests: PullRequestsTable;
  issues: IssuesTable;
  issueAssignees: IssueAssigneesTable;
  plans: PlansTable;
  planItems: PlanItemsTable;
  planItemAssignees: PlanItemAssigneesTable;
  planItemMoves: PlanItemMovesTable;
  entries: EntriesTable;
  entryPeople: EntryPeopleTable;
  releases: ReleasesTable;
  releasePullRequests: ReleasePullRequestsTable;
  notes: NotesTable;
  noteLinks: NoteLinksTable;
  reportNotes: ReportNotesTable;
};

type ColumnSpec = { readonly type: string; readonly nullable: boolean };

/*
 * The column list of every table, written to mirror the types above. Kept as data so the
 * contract test can compare it with information_schema; the `satisfies` clause makes the
 * compiler reject any table or column that exists here but not in `Database`, and vice versa.
 */
const date = { type: 'date', nullable: false } as const;
const dateNull = { type: 'date', nullable: true } as const;
const uuid = { type: 'uuid', nullable: false } as const;
const uuidNull = { type: 'uuid', nullable: true } as const;
const text = { type: 'text', nullable: false } as const;
const textNull = { type: 'text', nullable: true } as const;
const int = { type: 'integer', nullable: false } as const;
const tz = { type: 'timestamp with time zone', nullable: false } as const;
const tzNull = { type: 'timestamp with time zone', nullable: true } as const;
const userEnum = (nullable = false): ColumnSpec => ({ type: 'USER-DEFINED', nullable });

export const schemaContract = {
  sessions: { tokenHash: { type: 'bytea', nullable: false }, githubUserId: { type: 'bigint', nullable: false }, createdAt: tz, expiresAt: tz },
  projects: { id: uuid, slug: text, name: text, description: text, archivedAt: tzNull, createdAt: tz, updatedAt: tz },
  areas: { id: uuid, projectId: uuid, name: text, position: int, archivedAt: tzNull, createdAt: tz },
  people: { id: uuid, name: text, archivedAt: tzNull, createdAt: tz },
  pullRequests: { id: uuid, projectId: uuid, owner: text, repo: text, number: int, title: text, state: userEnum(), fetchedAt: tz, createdAt: tz },
  issues: {
    id: uuid, projectId: uuid, areaId: uuidNull, resolvedByPrId: uuidNull, title: text, externalUrl: textNull,
    status: userEnum(), assignedOn: date, deadline: date, resolvedOn: dateNull, createdAt: tz, updatedAt: tz,
  },
  issueAssignees: { issueId: uuid, personId: uuid },
  plans: { id: uuid, projectId: uuid, horizon: userEnum(), periodStart: date, createdAt: tz },
  planItems: {
    id: uuid, projectId: uuid, planId: uuid, areaId: uuidNull, issueId: uuidNull, title: text, status: userEnum(),
    dueDate: date, completedOn: dateNull, position: int, createdAt: tz, updatedAt: tz,
  },
  planItemAssignees: { planItemId: uuid, personId: uuid },
  planItemMoves: { id: uuid, planItemId: uuid, fromPlanId: uuid, toPlanId: uuid, fromDue: date, toDue: date, movedAt: tz },
  entries: {
    id: uuid, projectId: uuid, workDate: date, description: text, areaId: uuidNull, pullRequestId: uuidNull,
    planItemId: uuidNull, issueId: uuidNull, createdAt: tz, updatedAt: tz,
  },
  entryPeople: { entryId: uuid, personId: uuid },
  releases: {
    id: uuid, projectId: uuid, version: text, status: userEnum(), targetDate: dateNull, releasedOn: dateNull,
    notes: text, createdAt: tz, updatedAt: tz,
  },
  releasePullRequests: { projectId: uuid, releaseId: uuid, pullRequestId: uuid },
  notes: { id: uuid, projectId: uuid, releaseId: uuidNull, pullRequestId: uuidNull, title: text, body: text, createdAt: tz, updatedAt: tz },
  noteLinks: { id: uuid, noteId: uuid, label: text, url: text, position: int },
  reportNotes: { projectId: uuid, kind: userEnum(), periodStart: date, body: text, updatedAt: tz },
} as const satisfies { readonly [T in keyof Database]: { readonly [C in keyof Database[T]]-?: ColumnSpec } };
