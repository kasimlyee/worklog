import { AppLink as Link } from './app-link.tsx';
import { noteRows, numberedChanges, splitEntryText, summarizeEntry, type NoteRow } from '#src/lib/entry-text.ts';
import type { EntryVM } from '#src/ui/view-models/entries.ts';
import { projectHref } from '#src/ui/routes.ts';

/** BR-44: the notes of each linked issue, then any written into the description, as What / Why / Change rows. */
export function changeRows(entry: EntryVM): readonly NoteRow[] {
  const structured = entry.issues
    .filter((issue) => issue.summary !== '' || issue.cause !== '' || issue.fix !== '')
    .map((issue) => ({ issue: issue.summary === '' ? issue.title : issue.summary, cause: issue.cause, fix: issue.fix }));
  return [...structured, ...noteRows(splitEntryText(entry.description).notes)];
}

const plural = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;

/** What one line of the list says about an entry. */
export function entrySummary(entry: EntryVM): {
  readonly headline: string;
  readonly more: number;
  readonly changes: number;
  readonly closed: readonly string[];
} {
  const { headline, more } = summarizeEntry(entry.description);
  const numbered = numberedChanges(entry.description).length;
  const fixed = entry.issues.filter((issue) => issue.resolves).length;
  const finished = entry.planItems.filter((item) => item.completes).length;
  return {
    headline,
    more,
    // A pasted summary of plan work counts its numbered items; notes count their fixes.
    changes: numbered > 0 ? numbered : changeRows(entry).filter((row) => row.fix !== '').length,
    closed: [...(fixed === 0 ? [] : [`Fixed ${plural(fixed, 'issue', 'issues')}`]), ...(finished === 0 ? [] : [`Finished ${plural(finished, 'plan item', 'plan items')}`])],
  };
}

export function entryHref(projectId: string, listQuery: string, entryId: string): ReturnType<typeof projectHref> {
  return projectHref(projectId, 'log', `${listQuery === '' ? '' : `${listQuery}&`}entry=${entryId}`);
}

/** One entry as one line and a row of facts; the whole row opens it in the log. */
export function EntrySummaryRow({
  entry,
  href,
  current = false,
  showDate = false,
}: {
  readonly entry: EntryVM;
  readonly href: ReturnType<typeof projectHref>;
  readonly current?: boolean;
  readonly showDate?: boolean;
}): React.JSX.Element {
  const summary = entrySummary(entry);
  return (
    <Link
      href={href}
      aria-current={current ? 'true' : undefined}
      className="grid gap-1.5 border-l-[3px] border-transparent px-4 py-3 text-fg no-underline hover:bg-sunken aria-[current=true]:border-accent aria-[current=true]:bg-accent-soft"
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="line-clamp-2 text-sm font-semibold wrap-anywhere">{summary.headline}</span>
        {summary.more === 0 ? null : <span className="shrink-0 rounded-sm bg-sunken px-1.5 text-xs font-semibold text-muted">+{summary.more} more</span>}
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
        {showDate ? <span>{entry.dateLabel}</span> : null}
        <span>{entry.area ?? 'General'}</span>
        {summary.changes === 0 ? null : <span className="font-semibold text-success-fg">{plural(summary.changes, 'change', 'changes')}</span>}
        {summary.closed.map((label) => (
          <span key={label} className="font-semibold text-success-fg">
            {label}
          </span>
        ))}
        {entry.pullRequests.map((pr) => (
          <span key={pr.id} className="font-mono">
            #{pr.number}
          </span>
        ))}
        <span>{entry.people.join(', ')}</span>
      </span>
    </Link>
  );
}
