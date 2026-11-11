import type { StatusVM } from '#src/ui/view-models/common.ts';
import styles from './status-tag.module.css';

/** Product spec §5: one component for every status — colour and text, always together. */
export function StatusTag({ status, title }: { readonly status: StatusVM; readonly title?: string }): React.JSX.Element {
  return (
    <span className={styles.tag} data-tone={status.tone} title={title}>
      {status.label}
    </span>
  );
}

/** A deadline state: the same tag, announced as a deadline. */
export function DeadlineLabel({ status }: { readonly status: StatusVM }): React.JSX.Element {
  return (
    <span className={styles.deadline}>
      <span className="visually-hidden">Deadline: </span>
      <StatusTag status={status} />
    </span>
  );
}
