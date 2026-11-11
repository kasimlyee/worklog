import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as f from '#src/ui/fixtures/fixtures.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import { DashboardScreen } from './dashboard-screen.tsx';
import { EntryEditScreen, LogScreen } from './log-screen.tsx';
import { IssueScreen, IssuesScreen, NewIssueScreen } from './issue-screens.tsx';
import { NewReleaseScreen, ReleaseScreen, ReleasesScreen } from './release-screens.tsx';
import { NoteEditScreen, NoteScreen, NotesScreen } from './note-screens.tsx';
import { PlanItemScreen } from './plan-item-screen.tsx';
import { PlansScreen } from './plans-screen.tsx';
import { ProjectsScreen } from './projects-screen.tsx';
import { ReportsScreen } from './reports-screen.tsx';
import { PeopleScreen, PullRequestsScreen, SettingsScreen } from './settings-screens.tsx';
import { SignInScreen } from './sign-in-screen.tsx';
import { ProjectHeader } from './project-header.tsx';
import { AppShell } from './app-shell.tsx';
import { ProjectNav } from './project-nav.tsx';

vi.mock('next/navigation', () => ({ usePathname: () => `/projects/${f.projectId}/issues/s1` }));

const formAction: FormAction = () => Promise.resolve({ status: 'idle' });
const plainAction: PlainAction = () => Promise.resolve();

/** Every screen has exactly one h1, and no heading level is skipped. */
function expectHeadingOrder(): void {
  const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)));
  expect(levels.filter((level) => level === 1)).toHaveLength(1);
  levels.forEach((level, index) => {
    expect(level - (levels[index - 1] ?? 0), `heading ${String(index)} jumps from h${String(levels[index - 1])} to h${String(level)}`).toBeLessThanOrEqual(1);
  });
}

function tagsIn(container: HTMLElement): readonly string[] {
  return [...container.querySelectorAll('[data-tone]')].map((tag) => `${tag.getAttribute('data-tone') ?? ''}:${tag.textContent}`);
}

describe('shell', () => {
  it('sign in has one GitHub button and shows a notice', () => {
    render(<SignInScreen notice="expired" />);

    expect(screen.getByRole('link', { name: 'Sign in with GitHub' }).getAttribute('href')).toBe('/auth/github');
    expect(screen.getByRole('status').textContent).toBe('Your session has ended. Please sign in again.');
    expectHeadingOrder();
  });

  it('the app shell has a skip link, main landmark and a sign-out button', () => {
    render(
      <AppShell signOut={plainAction}>
        <h1>Page</h1>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#main');
    expect(screen.getByRole('main').id).toBe('main');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('the project nav marks the current section, including sub-pages', () => {
    render(<ProjectNav projectId={f.projectId} />);

    expect(screen.getByRole('link', { name: 'Issues' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
  });

  it('BR-13: the project header shows the red overdue count and an archived note', () => {
    render(<ProjectHeader project={{ ...f.projectHeader, isArchived: true }} />);

    expect(tagsIn(document.body)).toEqual(['danger:3 overdue']);
    expect(screen.getByRole('note').textContent).toContain('archived');
  });
});

describe('project switcher', () => {
  it('BR-13: shows each project with its red overdue count', () => {
    render(<ProjectsScreen projects={f.projects} createProject={formAction} />);

    expect(screen.getByRole('link', { name: 'Atlas' })).toBeDefined();
    expect(tagsIn(document.body)).toEqual(['danger:3 overdue', 'neutral:Nothing overdue']);
    expectHeadingOrder();
  });

  it('shows an empty state with no projects', () => {
    render(<ProjectsScreen projects={[]} createProject={formAction} />);

    expect(screen.getByText('No projects yet. Create the first one below.')).toBeDefined();
  });
});

describe('dashboard', () => {
  it('BR-13: urgent lists overdue items in red, with their labels', () => {
    render(<DashboardScreen projectId={f.projectId} vm={f.dashboard} setStatus={plainAction} />);

    const urgent = screen.getByRole('region', { name: 'Urgent' });
    expect(within(urgent).getAllByRole('link').map((link) => link.textContent)).toEqual(['Crash on save', 'Migrate billing tables']);
    expect(tagsIn(urgent)).toEqual(['danger:Urgent', 'danger:3 days overdue', 'danger:3 days overdue']);
    expectHeadingOrder();
  });

  it('BR-14: due soon is yellow', () => {
    render(<DashboardScreen projectId={f.projectId} vm={f.dashboard} setStatus={plainAction} />);

    expect(tagsIn(screen.getByRole('region', { name: 'Due soon' }))).toEqual(['warning:Due tomorrow']);
  });

  it('shows every section’s empty state, and the weekend message instead of today’s plan', () => {
    render(<DashboardScreen projectId={f.projectId} vm={f.emptyDashboard} setStatus={plainAction} />);

    for (const message of ['Nothing overdue.', 'Nothing due today or on the next working day.', 'It is the weekend: there is no day plan today.', 'No issues.', 'No work logged yet.']) {
      expect(screen.getByText(message)).toBeDefined();
    }
  });
});

describe('plans', () => {
  it('BR-10: lists items with status, deadline state and assignees; status is changeable', () => {
    render(<PlansScreen projectId={f.projectId} vm={f.plans} pickers={f.pickers} createItem={formAction} setStatus={plainAction} />);

    expect(screen.getByRole('heading', { name: 'Week of 9–13 Nov 2026' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Week' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByLabelText<HTMLSelectElement>('Status of Ship login').value).toBe('in_progress');
    expect(tagsIn(document.body)).toContain('danger:Blocked');
    expect(tagsIn(document.body)).toContain('danger:3 days overdue');
    expect(screen.getByText('Moved 1×')).toBeDefined();
    expectHeadingOrder();
  });

  it('BR-11: the due date input is limited to the plan period', () => {
    render(<PlansScreen projectId={f.projectId} vm={f.plans} pickers={f.pickers} createItem={formAction} setStatus={plainAction} />);

    const due = screen.getByLabelText('Due date');
    expect([due.getAttribute('min'), due.getAttribute('max')]).toEqual(['2026-11-09', '2026-11-13']);
  });

  it('BR-03: a weekend day plan cannot take items', () => {
    render(<PlansScreen projectId={f.projectId} vm={f.weekendDayPlan} pickers={f.pickers} createItem={formAction} setStatus={plainAction} />);

    expect(screen.getByText('Day plans cover working days only. Pick a weekday to plan.')).toBeDefined();
    expect(screen.getByText('Nothing planned for this period yet.')).toBeDefined();
  });

  it('BR-15: a plan item shows its move form and its history', () => {
    render(
      <PlanItemScreen projectId={f.projectId} item={f.planItemDetail} pickers={f.pickers} update={formAction} move={formAction} setStatus={plainAction} remove={plainAction} />,
    );

    expect(screen.getByLabelText('New due date')).toBeDefined();
    expect(screen.getByText(/Moved from Wed 4 Nov to Fri 6 Nov/)).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>('Wanjiru').checked).toBe(true);
    expectHeadingOrder();
  });

  it('BR-15: a done item cannot be moved until reopened', () => {
    const done = { ...f.planItemDetail, status: 'done' as const, deadline: null, moves: [] };
    render(<PlanItemScreen projectId={f.projectId} item={done} pickers={f.pickers} update={formAction} move={formAction} setStatus={plainAction} remove={plainAction} />);

    expect(screen.queryByLabelText('New due date')).toBeNull();
    expect(screen.getByText('Never moved.')).toBeDefined();
  });
});

describe('log', () => {
  it('BR-18: groups entries by day, newest first, labelling weekend work', () => {
    render(<LogScreen projectId={f.projectId} vm={f.log} pickers={f.pickers} createEntry={formAction} today={f.today} />);

    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Tuesday 10 Nov 2026',
      'Sunday 8 Nov 2026Weekend',
      'Friday 6 Nov 2026',
    ]);
    expect(screen.getByRole('link', { name: 'Older entries' })).toBeDefined();
    expectHeadingOrder();
  });

  it('BR-17: shows PR state, people, plan item and issue for an entry; long text wraps', () => {
    render(<LogScreen projectId={f.projectId} vm={f.log} pickers={f.pickers} createEntry={formAction} today={f.today} />);

    expect(screen.getByText('Ali, Grace')).toBeDefined();
    expect(screen.getByText('Plan: Ship login')).toBeDefined();
    expect(screen.getByText('Issue: Crash on save')).toBeDefined();
    expect(tagsIn(document.body)).toEqual(expect.arrayContaining(['success:Merged', 'danger:Closed']));
    expect(screen.getByText(f.longText)).toBeDefined();
  });

  it('filters by area, person and PR, and shows the filtered empty state', () => {
    render(<LogScreen projectId={f.projectId} vm={f.emptyLog} pickers={f.pickers} createEntry={formAction} today={f.today} />);

    const filters = screen.getByRole('form', { name: 'Filter entries' });
    expect(within(filters).getByLabelText<HTMLSelectElement>('Area').value).toBe('a1');
    expect(within(filters).getByLabelText('Person')).toBeDefined();
    expect(within(filters).getByLabelText('Pull request')).toBeDefined();
    expect(screen.getByText('No entries match these filters.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toBeDefined();
  });

  it('prefills the entry edit form', () => {
    render(<EntryEditScreen projectId={f.projectId} entryId="e1" values={f.entryValues} pickers={f.pickers} update={formAction} remove={plainAction} />);

    expect(screen.getByLabelText<HTMLTextAreaElement>('What was done').value).toBe(f.entryValues.description);
    expect(screen.getByLabelText<HTMLInputElement>('Pull request link').value).toBe(f.entryValues.prUrl);
    expect(screen.getByLabelText<HTMLInputElement>('Grace').checked).toBe(true);
    expectHeadingOrder();
  });
});

describe('issues', () => {
  it('BR-31: shows every deadline state with its colour and label', () => {
    render(<IssuesScreen projectId={f.projectId} open={f.issues.slice(0, 2)} resolved={f.issues.slice(2)} />);

    expect(tagsIn(document.body)).toEqual([
      'danger:Urgent', 'danger:3 days overdue', 'neutral:Open',
      'warning:High', 'warning:Due tomorrow', 'warning:In progress',
      'neutral:Low', 'danger:Resolved 2 days late', 'success:Resolved',
    ]);
    expect(screen.getByRole('link', { name: /Open link/ }).getAttribute('rel')).toBe('noopener noreferrer');
    expectHeadingOrder();
  });

  it('BR-37: filters and sorts by priority from a plain GET form', () => {
    render(<IssuesScreen projectId={f.projectId} open={f.issues.slice(0, 2)} resolved={[]} controls={{ priority: 'urgent', sortBy: 'priority' }} />);

    const controls = screen.getByRole('form', { name: 'Filter and sort issues' });
    expect(within(controls).getByLabelText<HTMLSelectElement>('Priority').value).toBe('urgent');
    expect(within(controls).getByLabelText<HTMLSelectElement>('Sort by').value).toBe('priority');
    expect(screen.getByRole('link', { name: 'Clear' })).toBeDefined();
  });

  it('BR-37: the issue form offers the four priorities, medium for a new issue', () => {
    render(<NewIssueScreen projectId={f.projectId} pickers={f.pickers} create={formAction} today={f.today} />);

    const select = screen.getByLabelText<HTMLSelectElement>('Priority');
    expect(select.value).toBe('medium');
    expect([...select.options].map((o) => o.text)).toEqual(['Urgent', 'High', 'Medium', 'Low']);
  });

  it('shows empty tables', () => {
    render(<IssuesScreen projectId={f.projectId} open={[]} resolved={[]} />);

    expect(screen.getAllByText('No issues.')).toHaveLength(2);
  });

  it('BR-27: the new issue form has the required fields, dated today', () => {
    render(<NewIssueScreen projectId={f.projectId} pickers={f.pickers} create={formAction} today={f.today} />);

    expect(screen.getByLabelText<HTMLInputElement>('Assigned').value).toBe(f.today);
    expect(screen.getByLabelText<HTMLInputElement>('Deadline').value).toBe(f.today);
    expect(screen.getByRole('group', { name: 'Assignees' })).toBeDefined();
    expectHeadingOrder();
  });

  it('BR-29: an open issue offers resolve with an editable date; BR-30 the resolving PR', () => {
    render(
      <IssueScreen projectId={f.projectId} issue={f.issueDetail} pickers={f.pickers} update={formAction} resolve={formAction} setStatus={plainAction} remove={plainAction} today={f.today} />,
    );

    expect(screen.getByLabelText<HTMLInputElement>('Resolved on').value).toBe(f.today);
    expect(screen.getByLabelText('Resolved by pull request')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mark in progress' })).toBeDefined();
    expectHeadingOrder();
  });

  it('BR-29: a resolved issue offers reopen and shows who resolved it', () => {
    render(
      <IssueScreen projectId={f.projectId} issue={f.resolvedIssueDetail} pickers={f.pickers} update={formAction} resolve={formAction} setStatus={plainAction} remove={plainAction} today={f.today} />,
    );

    expect(screen.getByRole('button', { name: 'Reopen issue' })).toBeDefined();
    expect(screen.queryByLabelText('Resolved on')).toBeNull();
    expect(screen.getByText(/Resolved by #12 Add login/)).toBeDefined();
  });
});

describe('releases and notes', () => {
  it('BR-32: lists releases with their status', () => {
    render(<ReleasesScreen projectId={f.projectId} releases={f.releases} />);

    expect(tagsIn(document.body)).toEqual(['neutral:Planned', 'success:Released']);
    expectHeadingOrder();
  });

  it('shows the empty releases and notes states', () => {
    render(
      <>
        <ReleasesScreen projectId={f.projectId} releases={[]} />
      </>,
    );
    expect(screen.getByText('No releases yet.')).toBeDefined();
  });

  it('BR-32: a release shows linked PRs, notes and attached notes', () => {
    render(<ReleaseScreen projectId={f.projectId} release={f.releaseDetail} pickers={f.pickers} update={formAction} remove={plainAction} />);

    expect(screen.getByRole('link', { name: /#12 Add login/ })).toBeDefined();
    expect(screen.getByLabelText('Release notes').textContent.trim()).toBe('Highlights: sign-in with GitHub.');
    expect(screen.getByRole('link', { name: 'Rollout checklist' })).toBeDefined();
    expectHeadingOrder();
  });

  it('the new release form starts planned', () => {
    render(<NewReleaseScreen projectId={f.projectId} pickers={f.pickers} create={formAction} />);

    expect(screen.getByLabelText<HTMLSelectElement>('Status').value).toBe('planned');
    expectHeadingOrder();
  });

  it('BR-33: a note renders its Markdown with HTML shown as text; BR-35 its release and PR', () => {
    render(<NoteScreen projectId={f.projectId} note={f.note} remove={plainAction} />);

    expect(screen.getByLabelText('Note body').textContent).toContain('<script>alert(1)</script>');
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByRole('link', { name: '1.4.0' })).toBeDefined();
    expectHeadingOrder();
  });

  it('lists notes, or the empty state', () => {
    const { rerender } = render(<NotesScreen projectId={f.projectId} notes={f.notes} />);
    expect(screen.getByRole('link', { name: 'Rollout checklist' })).toBeDefined();

    rerender(<NotesScreen projectId={f.projectId} notes={[]} />);
    expect(screen.getByText('No notes yet.')).toBeDefined();
  });

  it('BR-34: the note editor has existing links plus two blank rows', () => {
    render(<NoteEditScreen projectId={f.projectId} title="Edit note" values={f.noteValues} pickers={f.pickers} save={formAction} />);

    expect(screen.getByLabelText<HTMLInputElement>('Link 1 URL').value).toBe('https://docs.example.com/runbook');
    expect(screen.getByLabelText<HTMLInputElement>('Link 3 URL').value).toBe('');
    expect(screen.queryByLabelText('Link 4 URL')).toBeNull();
    expectHeadingOrder();
  });
});

describe('reports', () => {
  it('R-02: previews the report model and links both exports', () => {
    render(<ReportsScreen projectId={f.projectId} vm={f.reports} saveNote={formAction} />);

    const preview = screen.getByRole('article', { name: 'Report preview' });
    expect(within(preview).getByRole('heading', { level: 2 }).textContent).toBe('Atlas — Weekly report');
    expect(within(preview).getByText('Short week: public holiday on Friday.')).toBeDefined();
    expect(tagsIn(preview)).toEqual(['success:Merged']);
    expect(within(preview).getByText('— Ali, Grace')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Export PDF' }).getAttribute('href')).toBe(f.reports.pdfHref);
    expect(screen.getByRole('link', { name: 'Export Markdown' }).getAttribute('href')).toBe(f.reports.markdownHref);
    expectHeadingOrder();
  });

  it('R-08: an empty report says no work was recorded', () => {
    render(<ReportsScreen projectId={f.projectId} vm={f.emptyReports} saveNote={formAction} />);

    expect(screen.getByText('No work recorded for this period.')).toBeDefined();
  });

  it('R-04: the report note is editable on the page', () => {
    render(<ReportsScreen projectId={f.projectId} vm={f.reports} saveNote={formAction} />);

    expect(screen.getByLabelText<HTMLTextAreaElement>('Note shown under the header').value).toBe(f.reports.note);
  });
});

describe('settings, people, pull requests', () => {
  it('BR-06: settings lists active areas to rename and archived ones to restore', () => {
    render(
      <SettingsScreen
        vm={f.settings}
        updateProject={formAction}
        createArea={formAction}
        renameArea={formAction}
        setAreaArchived={plainAction}
        reorderAreas={formAction}
        setProjectArchived={plainAction}
      />,
    );

    expect(screen.getAllByLabelText('Area name').map((input) => (input instanceof HTMLInputElement ? input.value : ''))).toEqual(['Frontend', 'Backend', 'Mobile', '']);
    expect(screen.getByRole('button', { name: 'Restore Legacy' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Move Frontend up' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Archive project' })).toBeDefined();
    expectHeadingOrder();
  });

  it('BR-06: people can be renamed, archived and restored', () => {
    render(<PeopleScreen people={f.people} create={formAction} rename={formAction} setArchived={plainAction} />);

    expect(screen.getByRole('button', { name: 'Archive Ali' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restore Former Dev' })).toBeDefined();
    expectHeadingOrder();
  });

  it('BR-24: pull requests can be refreshed and BR-36 deleted', () => {
    render(<PullRequestsScreen projectId={f.projectId} pullRequests={f.pullRequestRows} add={formAction} refresh={plainAction} remove={plainAction} />);

    expect(screen.getByRole('button', { name: 'Refresh from GitHub: #12' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
    expectHeadingOrder();
  });
});

describe('markup validity', () => {
  it('never nests a form inside another form', () => {
    render(
      <>
        <SettingsScreen
          vm={f.settings}
          updateProject={formAction}
          createArea={formAction}
          renameArea={formAction}
          setAreaArchived={plainAction}
          reorderAreas={formAction}
          setProjectArchived={plainAction}
        />
        <PeopleScreen people={f.people} create={formAction} rename={formAction} setArchived={plainAction} />
        <PullRequestsScreen projectId={f.projectId} pullRequests={f.pullRequestRows} add={formAction} refresh={plainAction} remove={plainAction} />
      </>,
    );

    expect(document.querySelectorAll('form form')).toHaveLength(0);
  });
});
