/**
 * A project page: the project's name and navigation beside the content on wide screens,
 * above it (with the navigation pinned while scrolling) on narrow ones.
 */
export function ProjectFrame({ side, children }: { readonly side: React.ReactNode; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Narrow: `contents` puts the side's children straight into the page, so the navigation can stay pinned. */}
      <div className="contents lg:sticky lg:top-6 lg:block">{side}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
