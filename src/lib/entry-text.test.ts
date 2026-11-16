import { describe, expect, it } from 'vitest';
import { changesTitle, numberedChanges, splitEntryText, summarizeEntry } from './entry-text.ts';

describe('entry text', () => {
  it('BR-44: inline "Issue: … Cause: … Fix: …" notes in older entries become labelled notes', () => {
    expect(splitEntryText('Issue: Brokers could withdraw anywhere. Cause: Used the sent number. Fix: Only the verified number. Issue: Admin saw it.')).toEqual({
      lead: '',
      notes: [
        { label: 'Issue', text: 'Brokers could withdraw anywhere.' },
        { label: 'Cause', text: 'Used the sent number.' },
        { label: 'Fix', text: 'Only the verified number.' },
        { label: 'Issue', text: 'Admin saw it.' },
      ],
    });
  });

  it('keeps plain text, and text with a single label, as it is', () => {
    expect(splitEntryText('Wired the login form')).toEqual({ lead: 'Wired the login form', notes: [] });
    expect(splitEntryText('Deployed. Fix: restart needed')).toEqual({ lead: 'Deployed. Fix: restart needed', notes: [] });
    expect(splitEntryText('Moved the domain. Cause: DNS. Fix: new record')).toEqual({
      lead: 'Moved the domain.',
      notes: [{ label: 'Cause', text: 'DNS.' }, { label: 'Fix', text: 'new record' }],
    });
  });

  it('summarises an entry in one line: its first thing and how many more', () => {
    expect(
      summarizeEntry(
        '1. Similar houses by the same broker: a tab on the listing page. 2. Regions on sales comments: comments have a region. 3. List view of sales comments: a table. 4. Drafts point of failure: a page. 5. Commission column: removed.',
      ),
    ).toEqual({ headline: 'Similar houses by the same broker', more: 4 });
    expect(summarizeEntry('Issue: Withdrawals to any number. Cause: x. Fix: y. Issue: No listings count. Fix: z.')).toEqual({ headline: 'Withdrawals to any number.', more: 1 });
    expect(summarizeEntry('Moved the domain. Cause: DNS. Fix: new record')).toEqual({ headline: 'Moved the domain.', more: 0 });
    expect(summarizeEntry('Wired the login form')).toEqual({ headline: 'Wired the login form', more: 0 });
    expect(summarizeEntry("Issue: A broker couldn't save step 2 of a new listing. Every save failed with an error about a stale revision. Fix: retry.").headline).toBe(
      "A broker couldn't save step 2 of a new listing.",
    );
    expect(summarizeEntry('Shipped 2. versions of x')).toEqual({ headline: 'Shipped 2. versions of x', more: 0 });
  });

  it('a pasted summary of plan work becomes named changes, titled by their names', () => {
    const changes = numberedChanges('1. Similar houses by the same broker: a tab shows them. 2. Regions on sales comments: comments have a region. 3. Commission column: removed. 4. Drafts: a page. 5. Tidy-ups');

    expect(changes).toEqual([
      { name: 'Similar houses by the same broker', text: 'a tab shows them.' },
      { name: 'Regions on sales comments', text: 'comments have a region.' },
      { name: 'Commission column', text: 'removed.' },
      { name: 'Drafts', text: 'a page.' },
      { name: 'Tidy-ups', text: '' },
    ]);
    expect(changesTitle(changes)).toBe('Similar houses by the same broker, Regions on sales comments and 3 more');
    expect(changesTitle(changes.slice(2, 4))).toBe('Commission column and Drafts');
    expect(numberedChanges('Wired the login form')).toEqual([]);
  });
});
