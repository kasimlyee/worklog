import { describe, expect, it } from 'vitest';
import { splitEntryText } from './entry-text.ts';

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
});
