import type { EntryFormValues } from '#src/ui/view-models/entries.ts';

/** A blank entry for `today`. Plain module: used by server and client components alike. */
export function emptyEntryValues(today: string): EntryFormValues {
  return { workDate: today, description: '', areaId: '', personIds: [], prUrls: '', planItems: [], issues: [] };
}
