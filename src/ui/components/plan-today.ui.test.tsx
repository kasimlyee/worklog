import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as f from '#src/ui/fixtures/fixtures.ts';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import { DashboardScreen } from './dashboard-screen.tsx';
import { issueDragType } from './plan-today.tsx';

function dataTransfer(issueId: string, title: string) {
  const data: Record<string, string> = { [issueDragType]: issueId, 'text/plain': title };
  return { types: Object.keys(data), getData: (type: string) => data[type] ?? '', setData: vi.fn(), dropEffect: 'none', effectAllowed: 'all' };
}

describe('planning issues for today (BR-38)', () => {
  it('BR-38: open issue rows can be dragged, and each has a keyboard-usable “Plan today” button', () => {
    render(<DashboardScreen projectId={f.projectId} vm={f.dashboard} setStatus={vi.fn<PlainAction>()} planToday={vi.fn<PlainAction>()} />);

    const table = screen.getByRole('table', { name: 'Open issues by deadline' });
    expect(table.querySelectorAll('tr[draggable="true"]')).toHaveLength(f.dashboard.openIssues.length);
    expect(screen.getByRole('button', { name: 'Plan today: Crash on save' })).toBeDefined();
    expect(screen.getByText(/Drag an open issue here/)).toBeDefined();
  });

  it('BR-38: dropping an issue on Today’s plan sends its id to the action and announces it', async () => {
    const planToday = vi.fn<PlainAction>(() => Promise.resolve());
    render(<DashboardScreen projectId={f.projectId} vm={f.dashboard} setStatus={vi.fn<PlainAction>()} planToday={planToday} />);
    const zone = screen.getByText(/Drag an open issue here/).parentElement;
    if (zone === null) {
      throw new Error('no drop zone');
    }

    fireEvent.dragOver(zone, { dataTransfer: dataTransfer('s1', 'Crash on save') });
    expect(zone.dataset['over']).toBe('true');
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: dataTransfer('s1', 'Crash on save') });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(planToday).toHaveBeenCalledTimes(1);
    });
    expect(planToday.mock.calls[0]?.[0].get('issueId')).toBe('s1');
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Added Crash on save to today’s plan.');
    });
    expect(zone.dataset['over']).toBeUndefined();
  });

  it('BR-38: ignores drags that are not issues (files, text)', () => {
    const planToday = vi.fn<PlainAction>();
    render(<DashboardScreen projectId={f.projectId} vm={f.dashboard} setStatus={vi.fn<PlainAction>()} planToday={planToday} />);
    const zone = screen.getByText(/Drag an open issue here/).parentElement;
    if (zone === null) {
      throw new Error('no drop zone');
    }
    const notAnIssue = { types: ['Files'], getData: () => '', dropEffect: 'none' };

    fireEvent.dragOver(zone, { dataTransfer: notAnIssue });
    fireEvent.drop(zone, { dataTransfer: notAnIssue });

    expect(zone.dataset['over']).toBeUndefined();
    expect(planToday).not.toHaveBeenCalled();
  });

  it('BR-38: at the weekend there is no drop zone, no dragging and no “Plan today”', () => {
    render(<DashboardScreen projectId={f.projectId} vm={{ ...f.dashboard, todaysPlan: null }} setStatus={vi.fn<PlainAction>()} planToday={vi.fn<PlainAction>()} />);

    expect(screen.queryByText(/Drag an open issue here/)).toBeNull();
    expect(document.querySelectorAll('tr[draggable="true"]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Plan today/ })).toBeNull();
  });
});
