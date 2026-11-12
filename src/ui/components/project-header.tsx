import type { ProjectHeaderVM } from '#src/ui/view-models/shell.ts';
import { StatusTag } from './status-tag.tsx';

export function ProjectHeader({ project }: { readonly project: ProjectHeaderVM }): React.JSX.Element {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 lg:mb-5 lg:px-3">
      <p className="text-lg font-[750] tracking-tight wrap-anywhere lg:basis-full">
        {/* Says what the sidebar belongs to; the name alone is enough on narrow screens. */}
        <span className="hidden font-mono text-xs font-medium tracking-wide text-muted uppercase lg:block">Project</span>
        {project.name}
      </p>
      {project.overdueCount > 0 ? (
        <StatusTag status={{ tone: 'danger', label: `${String(project.overdueCount)} overdue` }} />
      ) : null}
      {project.isArchived ? (
        <p className="basis-full rounded-md bg-neutral-bg px-3 py-2 text-sm text-neutral-fg" role="note">
          This project is archived. Its history and reports stay available.
        </p>
      ) : null}
    </div>
  );
}
