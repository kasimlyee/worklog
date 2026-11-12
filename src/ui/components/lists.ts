/*
 * Tailwind class lists shared by the list, toolbar and plan layouts of several screens.
 * One place, so every screen's rows, tabs and headings look the same.
 */
export const lists = {
  list: 'm-0 list-none p-0',
  item: 'grid gap-1 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0',
  /** A row with something to do on the right (a status form); it wraps underneath on narrow screens. */
  itemWithAction: 'flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0',
  itemBody: 'grid min-w-0 gap-1',
  row: 'flex flex-wrap items-center gap-2',
  /** A row's title: reads as ink, and underlines on hover when it is a link. */
  title: 'font-semibold text-fg wrap-anywhere [&:is(a)]:decoration-transparent [&:is(a)]:hover:decoration-current',
  /** Free text a row is about (a log entry's description). */
  text: 'font-medium text-fg wrap-anywhere',
  meta: 'flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted',
  actions: 'flex flex-wrap items-center gap-2',
  tableWrap: 'relative overflow-x-auto [&_td:first-child]:min-w-44',
  dayHeading: 'mt-6 mb-2 flex items-center gap-2 border-b border-line pb-2 text-sm font-bold first:mt-0',
  toolbar: 'mb-5 flex flex-wrap items-center gap-x-4 gap-y-2',
  /** A segmented control: the current choice sits raised on a sunken track. */
  tabs: 'inline-flex gap-1 rounded-md bg-sunken p-1',
  tab: 'rounded-sm px-3 py-1 text-sm font-semibold text-muted no-underline hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:text-fg aria-[current=page]:shadow-sm',
  periodLabel: 'mx-2 text-lg font-bold tracking-tight',
  history: 'mt-1 list-decimal pl-6 text-sm text-muted',
  stack: 'grid gap-6',
  statusSelect: 'min-h-8 w-auto rounded-full py-1 pr-2 pl-3 text-sm',
  notice: 'mb-4 rounded-md border border-danger-line bg-danger-bg px-4 py-3 font-semibold text-danger-fg',
  description: 'mb-3 max-w-[70ch] whitespace-pre-line wrap-anywhere',
  weekDay: 'mt-5 first:mt-0',
  weekDayHeading: 'mb-2 border-b border-line pb-2 font-mono text-xs font-medium tracking-wide text-muted uppercase',
  weekDayEmpty: 'py-1 text-sm text-muted',
} as const;
