import type { ProjectHeaderVM } from '#src/ui/view-models/shell.ts';
import { StatusTag } from './status-tag.tsx';
import styles from './project-header.module.css';

export function ProjectHeader({ project }: { readonly project: ProjectHeaderVM }): React.JSX.Element {
  return (
    <div className={styles.header}>
      <p className={styles.name}>{project.name}</p>
      {project.overdueCount > 0 ? (
        <StatusTag status={{ tone: 'danger', label: `${String(project.overdueCount)} overdue` }} />
      ) : null}
      {project.isArchived ? (
        <p className={styles.archived} role="note">
          This project is archived. Its history and reports stay available.
        </p>
      ) : null}
    </div>
  );
}
