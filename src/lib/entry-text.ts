/*
 * Entries written before BR-44 often carry their notes inline:
 * "Issue: … Cause: … Fix: …". Shown as labelled lines, they read like the structured notes.
 */
export type EntryNote = { readonly label: 'Issue' | 'Cause' | 'Fix'; readonly text: string };
export type EntryText = { readonly lead: string; readonly notes: readonly EntryNote[] };

const marker = /\b(Issue|Cause|Fix):\s*/g;

export function splitEntryText(text: string): EntryText {
  const matches = [...text.matchAll(marker)];
  // One stray "Fix:" is just prose; two or more labels are notes.
  if (matches.length < 2) {
    return { lead: text, notes: [] };
  }
  const first = matches[0]?.index ?? 0;
  const notes = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    return { label: match[1] as EntryNote['label'], text: text.slice(start, end).trim() };
  });
  return { lead: text.slice(0, first).trim(), notes: notes.filter((note) => note.text !== '') };
}
