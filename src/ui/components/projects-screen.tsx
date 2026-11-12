import Link from 'next/link';
import type { FormAction } from '#src/ui/view-models/forms.ts';
import type { ProjectSummaryVM } from '#src/ui/view-models/shell.ts';
import { projectHref } from '#src/ui/routes.ts';
import { EmptyState } from './empty-state.tsx';
import { ActionForm, TextAreaField, TextField } from './form.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { StatusTag } from './status-tag.tsx';
import { lists as styles } from './lists.ts';

/** Project switcher: every active project, with a red count of overdue items and issues. */
export function ProjectsScreen({
  projects,
  createProject,
}: {
  readonly projects: readonly ProjectSummaryVM[];
  readonly createProject: FormAction;
}): React.JSX.Element {
  return (
    <div className={styles.stack}>
      <PageHeader title="Projects" />
      {projects.length === 0 ? (
        <EmptyState>No projects yet. Create the first one below.</EmptyState>
      ) : (
        <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
          {projects.map((project) => (
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
              <div>
                {project.overdueCount > 0 ? (
                  <StatusTag status={{ tone: 'danger', label: `${String(project.overdueCount)} overdue` }} />
                ) : (
                  <StatusTag status={{ tone: 'neutral', label: 'Nothing overdue' }} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Section title="New project">
        <ActionForm action={createProject} submitLabel="Create project" label="New project">
          <TextField name="name" label="Name" required maxLength={120} />
          <TextAreaField name="description" label="Description" maxLength={2000} rows={2} />
        </ActionForm>
      </Section>
    </div>
  );
}
