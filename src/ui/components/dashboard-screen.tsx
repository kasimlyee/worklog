import Link from 'next/link';
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
import styles from './lists.module.css';

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
  const tiles: readonly { readonly label: string; readonly value: string; readonly tone?: 'danger' | 'warning' }[] = [
    { label: 'Overdue', value: String(pulse.overdue), ...(pulse.overdue > 0 ? { tone: 'danger' as const } : {}) },
    { label: 'Due soon', value: String(pulse.dueSoon), ...(pulse.dueSoon > 0 ? { tone: 'warning' as const } : {}) },
    {
      label: 'Today',
      value: pulse.today === null ? 'Weekend' : pulse.today.total === 0 ? 'Nothing planned' : `${String(pulse.today.done)} / ${String(pulse.today.total)} done`,
    },
    { label: 'Logged this week', value: String(pulse.loggedThisWeek) },
  ];
  return (
    <dl className={styles.pulse} aria-label="At a glance">
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.pulseTile} data-pulse-tone={tile.tone}>
          <dt>{tile.label}</dt>
          <dd>{tile.value}</dd>
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
      <div className={styles.dashboardLayout}>
        <div className={styles.column}>
          <Section title="Urgent" id="urgent">
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
                  <p className={styles.progress}>
                    <progress value={today.done} max={today.total} aria-label="Today’s plan done" />
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
        <div className={styles.column}>
          <Section title="Due soon">
            <TrackedList items={vm.dueSoon} projectId={projectId} empty="Nothing due today or on the next working day." />
          </Section>
          <Section title="Recent entries" actions={<Link href={projectHref(projectId, 'log')}>Full log</Link>}>
            <EntryList entries={vm.recentEntries} projectId={projectId} />
          </Section>
        </div>
      </div>
      <Section title="Open issues" actions={<Link href={projectHref(projectId, 'issues')}>All issues</Link>}>
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
