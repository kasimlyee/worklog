import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import { PersonList } from './person-list.tsx';
import { ExternalLink } from './external-link.tsx';
import { MarkdownView } from './markdown-view.tsx';

describe('StatusTag', () => {
  it.each(['success', 'warning', 'danger', 'neutral'] as const)('R-10: shows the %s colour and the text label together', (tone) => {
    render(<StatusTag status={{ tone, label: `Label ${tone}` }} />);

    const tag = screen.getByText(`Label ${tone}`);
    expect(tag.dataset['tone']).toBe(tone);
  });

  it('BR-31: a deadline label is announced as a deadline', () => {
    render(<DeadlineLabel status={{ tone: 'danger', label: '3 days overdue' }} />);

    expect(screen.getByText('Deadline:')).toBeDefined();
    expect(screen.getByText('3 days overdue').dataset['tone']).toBe('danger');
  });
});

describe('small components', () => {
  it('R-09: lists people by name, or says unassigned', () => {
    const { rerender } = render(<PersonList people={['Ali', 'Grace']} />);
    expect(screen.getByText('Ali, Grace')).toBeDefined();

    rerender(<PersonList people={[]} />);
    expect(screen.getByText('Unassigned')).toBeDefined();
  });

  it('BR-34: external links open in a new tab without the referrer', () => {
    render(<ExternalLink href="https://jira.example.com/x">Ticket</ExternalLink>);

    const link = screen.getByRole('link', { name: /^Ticket\s*\(opens in a new tab\)$/ });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('BR-33: the Markdown view renders the server’s safe HTML', () => {
    render(<MarkdownView html={'<p>&lt;script&gt;x&lt;/script&gt; <strong>ok</strong></p>'} label="Body" />);

    const body = screen.getByLabelText('Body');
    expect(body.querySelector('script')).toBeNull();
    expect(body.textContent).toBe('<script>x</script> ok');
  });
});
