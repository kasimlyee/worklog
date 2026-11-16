/** One number with its words — colour is never the only signal (product spec §5). */
export type StatTile = {
  readonly label: string;
  readonly value: string;
  /** An SVG path in a 24×24 box. */
  readonly icon: string;
  readonly tone?: 'danger' | 'warning';
};

export const icons = {
  warning: 'M12 4 3 19h18zM12 10v4M12 16.5v.01',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2',
  check: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.5l2.5 2.5 4.5-5',
  lines: 'M4 6h16M4 12h16M4 18h10',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
} as const;

/** A row of numbers at the top of a page: what needs attention, at a glance. */
export function StatTiles({ tiles, label }: { readonly tiles: readonly StatTile[]; readonly label: string }): React.JSX.Element {
  return (
    <dl className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={label}>
      {tiles.map((tile) => (
        // Only <dt> and <dd> inside, as a description list needs; the icon belongs to the term.
        <div
          key={tile.label}
          className="group relative flex flex-col-reverse justify-center rounded-lg border border-line bg-surface p-4 shadow-sm sm:min-h-21 sm:py-5 sm:pr-5 sm:pl-20"
          data-pulse-tone={tile.tone}
        >
          <dt className="text-sm text-muted">
            <span
              className="absolute top-1/2 left-5 hidden size-11 -translate-y-1/2 place-items-center rounded-md bg-accent-soft text-accent group-data-[pulse-tone=danger]:bg-danger-bg group-data-[pulse-tone=danger]:text-danger-fg group-data-[pulse-tone=warning]:bg-warning-bg group-data-[pulse-tone=warning]:text-warning-fg sm:grid"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
                <path d={tile.icon} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {tile.label}
          </dt>
          <dd className="text-xl font-bold tracking-tight tabular-nums group-data-[pulse-tone=danger]:text-danger-fg group-data-[pulse-tone=warning]:text-warning-fg">
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
