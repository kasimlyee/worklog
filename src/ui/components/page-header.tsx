const actionRow = 'flex flex-wrap items-center gap-3 text-sm';

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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1>{title}</h1>
        {description === undefined ? null : <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions === undefined ? null : <div className={actionRow}>{actions}</div>}
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
    <section className="section rounded-lg border border-line bg-surface p-5 sm:p-6" aria-labelledby={headingId} id={id}>
      <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-base font-bold tracking-tight">
          {title}
        </h2>
        {actions === undefined ? null : <div className={actionRow}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}
