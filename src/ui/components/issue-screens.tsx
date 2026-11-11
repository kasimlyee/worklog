import Link from 'next/link';
import type { Pickers } from '#src/ui/view-models/common.ts';
import type { FormAction, PlainAction } from '#src/ui/view-models/forms.ts';
import type { IssueDetailVM, IssueFormValues, IssueVM } from '#src/ui/view-models/issues.ts';
import { newItemHref, projectHref } from '#src/ui/routes.ts';
import { ActionButton } from './action-button.tsx';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { ExternalLink } from './external-link.tsx';
import { ActionForm, CheckboxGroupField, SelectField, TextField } from './form.tsx';
import { IssueTable } from './issue-table.tsx';
import { PageHeader, Section } from './page-header.tsx';
import { PersonList } from './person-list.tsx';
import { DeadlineLabel, StatusTag } from './status-tag.tsx';
import styles from './lists.module.css';

/** Product spec §6: issues with assignees, deadline state and a link out. */
export function IssuesScreen({
  projectId,
  open,
  resolved,
}: {
  readonly projectId: string;
  readonly open: readonly IssueVM[];
  readonly resolved: readonly IssueVM[];
}): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title="Issues"
        description="Reminders for problems tracked elsewhere: who has it, and by when."
        actions={
          <Link className="button" data-variant="primary" href={newItemHref(projectId, 'issues')}>
            New issue
          </Link>
        }
      />
      <Section title="Open">
        <IssueTable issues={open} projectId={projectId} caption="Open issues by deadline" />
      </Section>
      <Section title="Resolved">
        <IssueTable issues={resolved} projectId={projectId} caption="Resolved issues" />
      </Section>
    </div>
  );
}

function IssueFields({ pickers, values }: { readonly pickers: Pickers; readonly values: IssueFormValues }): React.JSX.Element {
  return (
    <>
      <TextField name="title" label="Short title" defaultValue={values.title} required maxLength={200} wide />
      <TextField
        name="externalUrl"
        label="Link"
        type="url"
        defaultValue={values.externalUrl}
        hint="Jira, GitHub or the testing document. The full description stays there."
        wide
      />
      <TextField name="assignedOn" label="Assigned" type="date" defaultValue={values.assignedOn} required />
      <TextField name="deadline" label="Deadline" type="date" defaultValue={values.deadline} required />
      <SelectField name="areaId" label="Area" options={pickers.areas} defaultValue={values.areaId} emptyLabel="General (no area)" />
      <CheckboxGroupField name="personIds" legend="Assignees" options={pickers.people} defaultValues={values.personIds} />
    </>
  );
}

export function NewIssueScreen({
  projectId,
  pickers,
  create,
  today,
}: {
  readonly projectId: string;
  readonly pickers: Pickers;
  readonly create: FormAction;
  readonly today: string;
}): React.JSX.Element {
  const blank: IssueFormValues = { title: '', externalUrl: '', areaId: '', personIds: [], assignedOn: today, deadline: today };
  return (
    <div>
      <PageHeader title="New issue" actions={<Link href={projectHref(projectId, 'issues')}>Back to issues</Link>} />
      <Section title="Issue">
        <ActionForm action={create} submitLabel="Create issue" label="New issue">
          <IssueFields pickers={pickers} values={blank} />
        </ActionForm>
      </Section>
    </div>
  );
}

export function IssueScreen({
  projectId,
  issue,
  pickers,
  update,
  resolve,
  setStatus,
  remove,
  today,
}: {
  readonly projectId: string;
  readonly issue: IssueDetailVM;
  readonly pickers: Pickers;
  readonly update: FormAction;
  readonly resolve: FormAction;
  readonly setStatus: PlainAction;
  readonly remove: PlainAction;
  readonly today: string;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title={issue.title}
        description={
          <span className={styles.row}>
            <StatusTag status={issue.statusTag} />
            <DeadlineLabel status={issue.deadline} />
          </span>
        }
        actions={
          <>
            <Link href={projectHref(projectId, 'issues')}>Back to issues</Link>
            <ConfirmDialog
              action={remove}
              triggerLabel="Delete"
              title="Delete this issue?"
              message="Plan items and entries that refer to it are kept, without the link."
              confirmLabel="Delete issue"
              fields={{ issueId: issue.id }}
            />
          </>
        }
      />
      <Section title="Summary">
        <div className={styles.meta}>
          <span>Assigned {issue.assignedLabel}</span>
          <span>Deadline {issue.deadlineLabel}</span>
          <PersonList people={issue.assignees} />
          {issue.area === null ? null : <span>{issue.area}</span>}
          {issue.externalUrl === null ? null : <ExternalLink href={issue.externalUrl}>Open the full issue</ExternalLink>}
          {issue.resolvedOnLabel === null ? null : <span>Resolved {issue.resolvedOnLabel}</span>}
          {issue.resolvedBy === null ? null : (
            <ExternalLink href={issue.resolvedBy.url}>
              Resolved by #{issue.resolvedBy.number} {issue.resolvedBy.title}
            </ExternalLink>
          )}
        </div>
      </Section>
      <Section title={issue.status === 'resolved' ? 'Reopen' : 'Progress'}>
        {issue.status === 'resolved' ? (
          <ActionButton action={setStatus} label="Reopen issue" fields={{ issueId: issue.id, status: 'open' }} />
        ) : (
          <div className={styles.stack}>
            {issue.status === 'open' ? (
              <div>
                <ActionButton action={setStatus} label="Mark in progress" fields={{ issueId: issue.id, status: 'in_progress' }} />
              </div>
            ) : (
              <div>
                <ActionButton action={setStatus} label="Back to open" fields={{ issueId: issue.id, status: 'open' }} />
              </div>
            )}
            <ActionForm action={resolve} submitLabel="Resolve issue" label="Resolve issue" layout="inline">
              <TextField name="resolvedOn" label="Resolved on" type="date" defaultValue={today} max={today} />
              <SelectField name="resolvedByPrId" label="Resolved by pull request" options={pickers.pullRequests} emptyLabel="None" />
            </ActionForm>
          </div>
        )}
      </Section>
      <Section title="Edit">
        <ActionForm action={update} submitLabel="Save changes" label="Edit issue">
          <IssueFields pickers={pickers} values={issue.form} />
        </ActionForm>
      </Section>
    </div>
  );
}
