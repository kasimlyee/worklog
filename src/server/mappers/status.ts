import 'server-only';
import type { IssuePriority, IssueStatus, PlanItemStatus, PrState, ReleaseStatus } from '#src/server/db/types.ts';
import type { Deadline, IssueDeadlineState } from '#src/server/domain/deadlines.ts';
import type { StatusVM } from '#src/ui/view-models/common.ts';

/* Product spec §5: one place decides the colour of every status. */

export const planStatusTag: Readonly<Record<PlanItemStatus, StatusVM>> = {
  planned: { tone: 'neutral', label: 'Planned' },
  in_progress: { tone: 'warning', label: 'In progress' },
  done: { tone: 'success', label: 'Done' },
  blocked: { tone: 'danger', label: 'Blocked' },
};

export const issueStatusTag: Readonly<Record<IssueStatus, StatusVM>> = {
  open: { tone: 'neutral', label: 'Open' },
  in_progress: { tone: 'warning', label: 'In progress' },
  resolved: { tone: 'success', label: 'Resolved' },
};

/** BR-37 */
export const issuePriorityTag: Readonly<Record<IssuePriority, StatusVM>> = {
  urgent: { tone: 'danger', label: 'Urgent' },
  high: { tone: 'warning', label: 'High' },
  medium: { tone: 'neutral', label: 'Medium' },
  low: { tone: 'neutral', label: 'Low' },
};

export const prStateTag: Readonly<Record<PrState, StatusVM>> = {
  open: { tone: 'neutral', label: 'Open' },
  merged: { tone: 'success', label: 'Merged' },
  closed: { tone: 'danger', label: 'Closed' },
};

export const releaseStatusTag: Readonly<Record<ReleaseStatus, StatusVM>> = {
  planned: { tone: 'neutral', label: 'Planned' },
  released: { tone: 'success', label: 'Released' },
};

const deadlineTones: Readonly<Record<IssueDeadlineState, StatusVM['tone']>> = {
  overdue: 'danger',
  due_soon: 'warning',
  on_track: 'neutral',
  on_time: 'success',
  late: 'danger',
};

/** BR-31 colours: overdue and late red, due soon yellow, on time green, on track neutral. */
export function deadlineTag(deadline: Deadline<IssueDeadlineState>): StatusVM {
  return { tone: deadlineTones[deadline.state], label: deadline.label };
}
