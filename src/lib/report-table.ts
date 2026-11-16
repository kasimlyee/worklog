/*
 * Turns a report group into a table: columns and rows. Shared by the PDF, Markdown and the
 * on-screen preview (R-02), so all three show the same cells in the same order. Structural
 * types only, so both the server model and the UI view model fit.
 */

type Tag = { readonly tone: 'success' | 'warning' | 'danger' | 'neutral'; readonly label: string };

export type TableLine = {
  readonly text: string;
  readonly tags: readonly Tag[];
  readonly detail: string | null;
  readonly people: readonly string[];
  readonly cells?: readonly { readonly label: string; readonly text: string }[];
  readonly children: readonly TableLine[];
};

export type TableColumn = {
  readonly label: string;
  readonly from: 'text' | 'tags' | 'people' | { readonly cell: string };
  /** For the text column: show the line's detail on a second line. */
  readonly withDetail?: boolean;
};

export type TableGroup = { readonly title: string | null; readonly lines: readonly TableLine[]; readonly columns?: readonly TableColumn[] };

export type TableCell =
  | { readonly kind: 'text'; readonly text: string; readonly sub: string | null }
  | { readonly kind: 'tags'; readonly tags: readonly Tag[] }
  | { readonly kind: 'plain'; readonly text: string };

/** `depth` > 0: a line under the row above (an entry under its PR, a cause under its issue). */
export type TableRow = { readonly depth: number; readonly cells: readonly TableCell[] };

export type Table = { readonly columns: readonly TableColumn[]; readonly rows: readonly TableRow[] };

function flatten(lines: readonly TableLine[], depth = 0): readonly { readonly line: TableLine; readonly depth: number }[] {
  return lines.flatMap((line) => [{ line, depth }, ...flatten(line.children, depth + 1)]);
}

/** Default columns: the item, then Status and People only when some row has them. */
function defaultColumns(lines: readonly TableLine[], firstLabel: string): readonly TableColumn[] {
  const all = flatten(lines).map((entry) => entry.line);
  return [
    { label: firstLabel, from: 'text' },
    ...(all.some((line) => line.tags.length > 0) ? [{ label: 'Status', from: 'tags' } as const] : []),
    ...(all.some((line) => line.people.length > 0) ? [{ label: 'People', from: 'people' } as const] : []),
  ];
}

/** What the first column holds, named after its section. */
const itemLabels: Readonly<Record<string, string>> = {
  'Work done': 'Work',
  Releases: 'Release',
  'Plan vs. actual': 'Plan item',
  'Completed plan items': 'Plan item',
  'Merged pull requests': 'Pull request',
  Issues: 'Issue',
  'Unplanned work': 'Work',
};

/** A group's own title wins when it says more ("Unplanned work" inside "Plan vs. actual"). */
export function itemLabelFor(sectionTitle: string, groupTitle: string | null = null): string {
  return (groupTitle === null ? undefined : itemLabels[groupTitle]) ?? itemLabels[sectionTitle] ?? 'Item';
}

function hasValue(line: TableLine, column: TableColumn): boolean {
  if (column.from === 'people') {
    return line.people.length > 0;
  }
  if (column.from === 'tags') {
    return line.tags.length > 0;
  }
  if (column.from === 'text') {
    return true;
  }
  const label = column.from.cell;
  return (line.cells?.find((cell) => cell.label === label)?.text ?? '') !== '';
}

/** The group as a table. Columns no row fills (an empty "Fixed by") are left out. */
export function tableOf(group: TableGroup, firstLabel = 'Item'): Table {
  const lines = flatten(group.lines).map((entry) => entry.line);
  const columns = (group.columns ?? defaultColumns(group.lines, firstLabel)).filter((column) => lines.some((line) => hasValue(line, column)));
  const rows = flatten(group.lines).map(({ line, depth }): TableRow => ({
    depth,
    cells: columns.map((column): TableCell => {
      if (column.from === 'text') {
        // With explicit columns the detail is carried by cells; without, it sits under the text.
        return { kind: 'text', text: line.text, sub: group.columns === undefined || column.withDetail === true ? line.detail : null };
      }
      if (column.from === 'tags') {
        return { kind: 'tags', tags: line.tags };
      }
      if (column.from === 'people') {
        return { kind: 'plain', text: line.people.join(', ') };
      }
      const label = column.from.cell;
      return { kind: 'plain', text: line.cells?.find((cell) => cell.label === label)?.text ?? '' };
    }),
  }));
  return { columns, rows };
}
