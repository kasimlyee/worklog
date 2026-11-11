import * as f from '#src/ui/fixtures/fixtures.ts';
import { DashboardScreen } from '#src/ui/components/dashboard-screen.tsx';
import { QuickLog } from '#src/ui/components/entry-form.tsx';
import { IssueScreen, IssuesScreen, NewIssueScreen } from '#src/ui/components/issue-screens.tsx';
import { EntryEditScreen, LogScreen } from '#src/ui/components/log-screen.tsx';
import { NoteEditScreen, NoteScreen, NotesScreen } from '#src/ui/components/note-screens.tsx';
import { PlanItemScreen } from '#src/ui/components/plan-item-screen.tsx';
import { PlansScreen } from '#src/ui/components/plans-screen.tsx';
import { ProjectHeader } from '#src/ui/components/project-header.tsx';
import { ProjectsScreen } from '#src/ui/components/projects-screen.tsx';
import { NewReleaseScreen, ReleaseScreen, ReleasesScreen } from '#src/ui/components/release-screens.tsx';
import { ReportsScreen } from '#src/ui/components/reports-screen.tsx';
import { PeopleScreen, PullRequestsScreen, SettingsScreen } from '#src/ui/components/settings-screens.tsx';
import { SignInScreen } from '#src/ui/components/sign-in-screen.tsx';
import { previewFormAction as form, previewPlainAction as plain } from './actions.ts';

type Preview = { readonly element: React.JSX.Element; readonly bare?: boolean };

const id = f.projectId;

/** Every screen of product spec §6, in its main fixture states (docs/04 §2.4). */
export const screens: Readonly<Record<string, Preview>> = {
  'sign-in': { element: <SignInScreen notice="expired" />, bare: true },
  projects: { element: <ProjectsScreen projects={f.projects} createProject={form} /> },
  'projects-empty': { element: <ProjectsScreen projects={[]} createProject={form} /> },
  dashboard: {
    element: (
      <>
        <ProjectHeader project={f.projectHeader} />
        <QuickLog action={form} pickers={f.pickers} today={f.today} />
        <DashboardScreen projectId={id} vm={f.dashboard} setStatus={plain} planToday={plain} />
      </>
    ),
  },
  'dashboard-empty': { element: <DashboardScreen projectId={id} vm={f.emptyDashboard} setStatus={plain} planToday={plain} /> },
  plans: { element: <PlansScreen projectId={id} vm={f.plans} pickers={f.pickers} createItem={form} setStatus={plain} /> },
  'plans-weekend': { element: <PlansScreen projectId={id} vm={f.weekendDayPlan} pickers={f.pickers} createItem={form} setStatus={plain} /> },
  'plan-item': {
    element: <PlanItemScreen projectId={id} item={f.planItemDetail} pickers={f.pickers} update={form} move={form} setStatus={plain} remove={plain} />,
  },
  log: { element: <LogScreen projectId={id} vm={f.log} pickers={f.pickers} createEntry={form} today={f.today} /> },
  'log-empty': { element: <LogScreen projectId={id} vm={f.emptyLog} pickers={f.emptyPickers} createEntry={form} today={f.today} /> },
  'entry-edit': { element: <EntryEditScreen projectId={id} entryId="e1" values={f.entryValues} pickers={f.pickers} update={form} remove={plain} /> },
  issues: { element: <IssuesScreen projectId={id} open={f.issues.slice(0, 2)} resolved={f.issues.slice(2)} /> },
  'issue-new': { element: <NewIssueScreen projectId={id} pickers={f.pickers} create={form} today={f.today} /> },
  issue: {
    element: <IssueScreen projectId={id} issue={f.issueDetail} history={f.openIssueHistory} pickers={f.pickers} update={form} resolve={form} setStatus={plain} remove={plain} today={f.today} />,
  },
  'issue-resolved': {
    element: (
      <IssueScreen projectId={id} issue={f.resolvedIssueDetail} history={f.resolvedIssueHistory} pickers={f.pickers} update={form} resolve={form} setStatus={plain} remove={plain} today={f.today} />
    ),
  },
  releases: { element: <ReleasesScreen projectId={id} releases={f.releases} /> },
  'release-new': { element: <NewReleaseScreen projectId={id} pickers={f.pickers} create={form} /> },
  release: { element: <ReleaseScreen projectId={id} release={f.releaseDetail} pickers={f.pickers} update={form} remove={plain} /> },
  notes: { element: <NotesScreen projectId={id} notes={f.notes} /> },
  note: { element: <NoteScreen projectId={id} note={f.note} remove={plain} /> },
  'note-edit': { element: <NoteEditScreen projectId={id} title="Edit note" values={f.noteValues} pickers={f.pickers} save={form} /> },
  reports: { element: <ReportsScreen projectId={id} vm={f.reports} saveNote={form} /> },
  'reports-empty': { element: <ReportsScreen projectId={id} vm={f.emptyReports} saveNote={form} /> },
  settings: {
    element: (
      <SettingsScreen
        vm={f.settings}
        updateProject={form}
        createArea={form}
        renameArea={form}
        setAreaArchived={plain}
        reorderAreas={form}
        setProjectArchived={plain}
      />
    ),
  },
  people: { element: <PeopleScreen people={f.people} create={form} rename={form} setArchived={plain} /> },
  'pull-requests': {
    element: <PullRequestsScreen projectId={id} pullRequests={f.pullRequestRows} notice="That pull request is in use." add={form} refresh={plain} remove={plain} />,
  },
};
