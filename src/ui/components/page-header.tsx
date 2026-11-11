import styles from './page-header.module.css';

export function PageHeader({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description?: React.ReactNode;
  readonly actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.header}>
      <div>
        <h1>{title}</h1>
        {description === undefined ? null : <p className={styles.description}>{description}</p>}
      </div>
      {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  children,
  actions,
  id,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly id?: string;
}): React.JSX.Element {
  const headingId = `${id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-heading`;
  return (
    <section className={styles.section} aria-labelledby={headingId} id={id}>
      <div className={styles.sectionHeader}>
        <h2 id={headingId}>{title}</h2>
        {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}
