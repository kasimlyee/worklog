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

export type NoteRow = { readonly issue: string; readonly cause: string; readonly fix: string };

/** Notes as Issue / Cause / Fix rows: each "Issue" starts a row; a Cause or Fix fills the current one. */
export function noteRows(notes: readonly EntryNote[]): readonly NoteRow[] {
  const rows: { issue: string; cause: string; fix: string }[] = [];
  for (const note of notes) {
    const current = rows.at(-1);
    if (note.label === 'Issue' || current === undefined || (note.label === 'Cause' ? current.cause : current.fix) !== '') {
      rows.push({ issue: '', cause: '', fix: '' });
    }
    const row = rows.at(-1);
    if (row !== undefined) {
      row[note.label === 'Issue' ? 'issue' : note.label === 'Cause' ? 'cause' : 'fix'] = note.text;
    }
  }
  return rows;
}

export type EntrySummary = { readonly headline: string; readonly more: number };

/** "1. First thing … 2. Second thing …" as separate items (at least two to count as a list). */
function numberedItems(text: string): readonly string[] {
  const parts = text.split(/(?:^|\s)\d{1,2}[.)]\s+/).map((part) => part.trim()).filter((part) => part !== '');
  return /^\s*1[.)]\s/.test(text) && parts.length >= 2 ? parts : [];
}

export type NumberedChange = { readonly name: string; readonly text: string };

/**
 * A pasted summary of finished work — "1. Similar houses: a tab that… 2. Regions: …" — as
 * one change per item, its name before the colon. Empty when the text is not such a list.
 */
export function numberedChanges(description: string): readonly NumberedChange[] {
  return numberedItems(description).map((item) => {
    const named = /^([^:]{3,80}):\s+([\s\S]+)$/.exec(item);
    return named === null ? { name: item, text: '' } : { name: named[1] ?? item, text: named[2] ?? '' };
  });
}

/** A title for several changes: their names, or the first ones and how many more. */
export function changesTitle(changes: readonly NumberedChange[]): string {
  const names = changes.map((change) => change.name);
  if (names.length <= 2 || names.join(', ').length <= 90) {
    return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
  }
  return `${names.slice(0, 2).join(', ')} and ${String(names.length - 2)} more`;
}

/**
 * One line for a list: the first thing an entry did and how many more. Notes count by their
 * "Issue" lines; a numbered description by its items; plain text is its own headline.
 */
export function summarizeEntry(description: string): EntrySummary {
  const summary = summarizeRaw(description);
  return { ...summary, headline: firstSentence(summary.headline) };
}

/** A long headline stops at the end of its first sentence; the rest is in the log. */
function firstSentence(text: string): string {
  if (text.length <= 90) {
    return text;
  }
  const end = /^(.{20,}?[.!?])\s/.exec(text);
  return end?.[1] ?? text;
}

function summarizeRaw(description: string): EntrySummary {
  const { lead, notes } = splitEntryText(description);
  if (notes.length > 0) {
    const whats = noteRows(notes).filter((row) => row.issue !== '');
    const headline = lead !== '' ? lead : (whats[0]?.issue ?? notes[0]?.text ?? description);
    return { headline, more: Math.max(0, whats.length - (lead !== '' ? 0 : 1)) };
  }
  const items = numberedItems(description);
  if (items.length > 0) {
    const [first = description] = items;
    // "Similar houses by the same broker: a tab that…" reads best as its name.
    const name = /^([^:]{3,80}):\s/.exec(first)?.[1] ?? first;
    return { headline: name, more: items.length - 1 };
  }
  return { headline: description, more: 0 };
}
