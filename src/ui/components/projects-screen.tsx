import { AppLink as Link } from './app-link.tsx';
import type { FormAction } from '#src/ui/view-models/forms.ts';
import type { DoneItemVM, OverviewItemVM, OverviewVM } from '#src/ui/view-models/overview.ts';
import { projectHref, projectItemHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ActionForm, TextAreaField, TextField } from './form.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { PersonList } from './person-list.tsx';
import { StatTiles, icons } from './stat-tiles.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import { lists as styles } from './lists.ts';

function itemHref(item: { readonly kind: 'plan_item' | 'issue'; readonly projectId: string; readonly id: string }): ReturnType<typeof projectHref> {
  return projectItemHref(item.projectId, item.kind === 'issue' ? 'issues' : 'plans/items', item.id);
}

/** Work from every project, each row naming its project (BR-42). */
function WorkList({ items, empty }: { readonly items: readonly OverviewItemVM[]; readonly empty: string }): React.JSX.Element {
  if (items.length === 0) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key} className={styles.item}>
          <div className={styles.row}>
            <Link className={styles.title} href={itemHref(item)}>
              {item.title}
            </Link>
            {item.priority === null ? null : <StatusTag status={item.priority} title="Priority" />}
            <DeadlineLabel status={item.deadline} />
          </div>
          <div className={styles.meta}>
            <Link href={projectHref(item.projectId)}>{item.projectName}</Link>
            <span>{item.kind === 'issue' ? 'Issue' : 'Plan item'}</span>
            <span>{item.dueLabel}</span>
            <PersonList people={item.people} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DoneList({ items }: { readonly items: readonly DoneItemVM[] }): React.JSX.Element {
  if (items.length === 0) {
    return <EmptyState>Nothing finished in the last 7 days.</EmptyState>;
  }
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key} className={styles.item}>
          <div className={styles.row}>
            <Link className={styles.title} href={itemHref(item)}>
              {item.title}
            </Link>
            <StatusTag status={{ tone: 'success', label: item.kind === 'issue' ? 'Resolved' : 'Done' }} />
          </div>
          <div className={styles.meta}>
            <Link href={projectHref(item.projectId)}>{item.projectName}</Link>
            <span>{item.doneLabel}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * BR-42: the first screen — what needs attention across every project, each project's
 * state, and what was finished recently. Product spec §6 "Project switcher", extended.
 */
export function ProjectsScreen({ overview, createProject }: { readonly overview: OverviewVM; readonly createProject: FormAction }): React.JSX.Element {
  const overdue = overview.attention.filter((item) => item.deadline.tone === 'danger').length;
  const needingAttention = overview.projects.filter((project) => project.overdueCount > 0).length;
  return (
    <div className={styles.stack}>
      <PageHeader title="Overview" description={overview.todayLabel} />
      <StatTiles
        label="Across all projects"
        tiles={[
          { label: 'Overdue', value: String(overdue), icon: icons.warning, ...(overdue > 0 ? { tone: 'danger' as const } : {}) },
          { label: 'Due soon', value: String(overview.dueSoon.length), icon: icons.clock, ...(overview.dueSoon.length > 0 ? { tone: 'warning' as const } : {}) },
          { label: 'Projects needing attention', value: `${String(needingAttention)} of ${String(overview.projects.length)}`, icon: icons.folder },
          { label: 'Done in the last 7 days', value: String(overview.recentlyDone.length), icon: icons.check },
        ]}
      />
      {overview.projects.length === 0 ? (
        <EmptyState>No projects yet. Create the first one below.</EmptyState>
      ) : (
        <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4" aria-label="Projects">
          {overview.projects.map((project) => (
            <li
              key={project.id}
              className="relative grid content-start gap-2 rounded-lg border border-line bg-surface p-5 transition hover:border-line-strong hover:shadow-md"
            >
              {/* The link's ::after covers the card, so the whole card is the target. */}
              <Link
                className="text-lg font-bold tracking-tight text-fg decoration-transparent after:absolute after:inset-0 after:rounded-lg hover:decoration-current"
                href={projectHref(project.id)}
              >
                {project.name}
              </Link>
              {project.description === '' ? null : <p className="text-sm text-muted">{project.description}</p>}
              <div className={styles.row}>
                {project.overdueCount > 0 ? (
                  <StatusTag status={{ tone: 'danger', label: `${String(project.overdueCount)} overdue` }} />
                ) : (
                  <StatusTag status={{ tone: 'neutral', label: 'Nothing overdue' }} />
                )}
                {project.today === null || project.today.total === 0 ? null : (
                  <span className="text-sm text-muted">
                    Today: {project.today.done} of {project.today.total} done
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Needs attention" id="attention">
          <WorkList items={overview.attention} empty="Nothing overdue in any project." />
        </Section>
        <Section title="Due soon">
          <WorkList items={overview.dueSoon} empty="Nothing due today or on the next working day." />
        </Section>
      </div>
      <Section title="Done in the last 7 days">
        <DoneList items={overview.recentlyDone} />
      </Section>
      <Section title="New project">
        <ActionForm action={createProject} submitLabel="Create project" label="New project">
          <TextField name="name" label="Name" required maxLength={120} />
          <TextAreaField name="description" label="Description" maxLength={2000} rows={2} />
        </ActionForm>
      </Section>
    </div>
  );
}
