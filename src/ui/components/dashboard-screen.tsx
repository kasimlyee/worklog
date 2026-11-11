import Link from 'next/link';
import type { DashboardVM, TrackedVM } from '#src/ui/view-models/dashboard.ts';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import { projectHref, projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { EntryList } from './entry-list.tsx';
import { IssueTable } from './issue-table.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { PersonList } from './person-list.tsx';
import { PlanItemList } from './plan-item-list.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
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
export function DashboardScreen({
  projectId,
  vm,
  setStatus,
}: {
  readonly projectId: string;
  readonly vm: DashboardVM;
  readonly setStatus: PlainAction;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader title="Dashboard" description={vm.todayLabel} />
      <Section title="Urgent" id="urgent">
        <TrackedList items={vm.urgent} projectId={projectId} empty="Nothing overdue." />
      </Section>
      <div className={styles.dashboardGrid}>
        <Section title="Due soon">
          <TrackedList items={vm.dueSoon} projectId={projectId} empty="Nothing due today or on the next working day." />
        </Section>
        <Section title="Today’s plan" actions={<Link href={projectHref(projectId, 'plans', 'horizon=day')}>Open plans</Link>}>
          {vm.todaysPlan === null ? (
            <EmptyState>It is the weekend: there is no day plan today.</EmptyState>
          ) : (
            <PlanItemList items={vm.todaysPlan} projectId={projectId} setStatus={setStatus} empty="Nothing planned for today." />
          )}
        </Section>
      </div>
      <Section title="Open issues" actions={<Link href={projectHref(projectId, 'issues')}>All issues</Link>}>
        <IssueTable issues={vm.openIssues} projectId={projectId} caption="Open issues by deadline" />
      </Section>
      <Section title="Recent entries" actions={<Link href={projectHref(projectId, 'log')}>Full log</Link>}>
        <EntryList entries={vm.recentEntries} projectId={projectId} />
      </Section>
    </div>
  );
}
