import { AppLink as Link } from './app-link.tsx';
import type { DashboardVM, PulseVM, TrackedVM } from '#src/ui/view-models/dashboard.ts';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import { projectHref, projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { EntryList } from './entry-list.tsx';
import { IssueTable } from './issue-table.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { PersonList } from './person-list.tsx';
import { PlanItemList } from './plan-item-list.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import { TodayDropZone } from './plan-today.tsx';
import { OpenQuickLog } from './entry-form.tsx';
import { lists as styles } from './lists.ts';

function TrackedList({ items, projectId, empty }: { readonly items: readonly TrackedVM[]; readonly projectId: string; readonly empty: string }): React.JSX.Element {
  if (items.length === 0) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className={styles.item}>
          <div className={styles.row}>
            <Link className={styles.title} href={projectItemHref(projectId, item.kind === 'issue' ? 'issues' : 'plans/items', item.id)}>
              {item.title}
            </Link>
            {item.priority === null ? null : <StatusTag status={item.priority} title="Priority" />}
            <DeadlineLabel status={item.deadline} />
          </div>
          <div className={styles.meta}>
            <span>{item.kind === 'issue' ? 'Issue' : 'Plan item'}</span>
            <span>{item.dueLabel}</span>
            <PersonList people={item.people} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Product spec §6: urgent, due soon, today's plan, open issues, recent entries. */
/** What needs attention, at a glance. Every number also has its words (never colour alone). */
function Pulse({ pulse }: { readonly pulse: PulseVM }): React.JSX.Element {
  const tiles: readonly { readonly label: string; readonly value: string; readonly icon: string; readonly tone?: 'danger' | 'warning' }[] = [
    {
      label: 'Overdue',
      value: String(pulse.overdue),
      icon: 'M12 4 3 19h18zM12 10v4M12 16.5v.01',
      ...(pulse.overdue > 0 ? { tone: 'danger' as const } : {}),
    },
    {
      label: 'Due soon',
      value: String(pulse.dueSoon),
      icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2',
      ...(pulse.dueSoon > 0 ? { tone: 'warning' as const } : {}),
    },
    {
      label: 'Today',
      value: pulse.today === null ? 'Weekend' : pulse.today.total === 0 ? 'Nothing planned' : `${String(pulse.today.done)} / ${String(pulse.today.total)} done`,
      icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.5l2.5 2.5 4.5-5',
    },
    { label: 'Logged this week', value: String(pulse.loggedThisWeek), icon: 'M4 6h16M4 12h16M4 18h10' },
  ];
  return (
    <dl className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="At a glance">
      {tiles.map((tile) => (
        // Only <dt> and <dd> inside, as a description list needs; the icon belongs to the term.
        <div
          key={tile.label}
          className="group relative flex flex-col-reverse justify-center rounded-lg border border-line bg-surface p-4 shadow-sm sm:min-h-21 sm:py-5 sm:pr-5 sm:pl-20"
          data-pulse-tone={tile.tone}
        >
          <dt className="text-sm text-muted">
            <span
              className="absolute top-1/2 left-5 hidden size-11 -translate-y-1/2 place-items-center rounded-md bg-accent-soft text-accent group-data-[pulse-tone=danger]:bg-danger-bg group-data-[pulse-tone=danger]:text-danger-fg group-data-[pulse-tone=warning]:bg-warning-bg group-data-[pulse-tone=warning]:text-warning-fg sm:grid"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
                <path d={tile.icon} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {tile.label}
          </dt>
          <dd className="text-xl font-bold tracking-tight tabular-nums group-data-[pulse-tone=danger]:text-danger-fg group-data-[pulse-tone=warning]:text-warning-fg">
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DashboardScreen({
  projectId,
  vm,
  setStatus,
  planToday,
}: {
  readonly projectId: string;
  readonly vm: DashboardVM;
  readonly setStatus: PlainAction;
  /** BR-38: put an issue on today's plan. */
  readonly planToday: PlainAction;
}): React.JSX.Element {
  const today = vm.pulse.today;
  return (
    <div>
      <PageHeader title="Dashboard" description={vm.todayLabel} />
      <Pulse pulse={vm.pulse} />
      <div className="mb-6 grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid min-w-0 gap-6 [&>section+section]:mt-0">
          <Section title="Urgent" id="urgent" count={vm.urgent.length}>
            <TrackedList items={vm.urgent} projectId={projectId} empty="Nothing overdue." />
          </Section>
          <Section
            title="Today’s plan"
            actions={
              <>
                <OpenQuickLog />
                <Link href={projectHref(projectId, 'plans', 'horizon=day')}>Open plans</Link>
              </>
            }
          >
            {vm.todaysPlan === null || today === null ? (
              <EmptyState>It is the weekend: there is no day plan today.</EmptyState>
            ) : (
              <>
                {today.total === 0 ? null : (
                  <p className="mb-3 flex items-center gap-3 text-sm text-muted">
                    <progress className="max-w-56 flex-1" value={today.done} max={today.total} aria-label="Today’s plan done" />
                    <span>
                      {today.done} of {today.total} done
                    </span>
                  </p>
                )}
                <TodayDropZone action={planToday}>
                  <PlanItemList items={vm.todaysPlan} projectId={projectId} setStatus={setStatus} empty="Nothing planned for today." />
                </TodayDropZone>
              </>
            )}
          </Section>
        </div>
        <div className="grid min-w-0 gap-6 [&>section+section]:mt-0">
          <Section title="Due soon" count={vm.dueSoon.length}>
            <TrackedList items={vm.dueSoon} projectId={projectId} empty="Nothing due today or on the next working day." />
          </Section>
          <Section title="Recent entries" actions={<Link href={projectHref(projectId, 'log')}>Full log</Link>}>
            <EntryList entries={vm.recentEntries} projectId={projectId} />
          </Section>
        </div>
      </div>
      <Section title="Open issues" count={vm.openIssues.length} actions={<Link href={projectHref(projectId, 'issues')}>All issues</Link>}>
        {/* At the weekend there is no day plan, so no dragging and no "Plan today". */}
        <IssueTable
          issues={vm.openIssues}
          projectId={projectId}
          caption="Open issues by deadline"
          draggable={vm.todaysPlan !== null}
          {...(vm.todaysPlan === null ? {} : { planToday })}
        />
      </Section>
    </div>
  );
}
