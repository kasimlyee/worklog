'use client';

/*
 * Client Component — justified: the quick log submits from the keyboard alone
 * (Enter in a field, Ctrl/⌘+Enter in the description) — product spec §6.
 */

import type { IssueOption, Pickers } from '#src/ui/view-models/common.ts';
import type { EntryFormValues, EntryIssueLinkVM, EntryPlanItemLinkVM } from '#src/ui/view-models/entries.ts';
import type { FormAction } from '#src/ui/view-models/forms.ts';
import { ActionForm, CheckboxGroupField, SelectField, TextAreaField, TextField, useFormField, type FormField } from './form.tsx';
import { emptyEntryValues } from './entry-values.ts';
import { StatusTag } from './status-tag.tsx';

function submitOnModEnter(event: React.KeyboardEvent<HTMLFormElement>): void {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
}

/* Field names the entries service reads (BR-44/BR-45). */
const issueField = (issueId: string, name: 'summary' | 'cause' | 'fix' | 'resolves'): string => `issue.${issueId}.${name}`;
const planItemField = (planItemId: string): string => `planItem.${planItemId}.completes`;

/** Ticked when the entry had it, or — after a failed submit — when it was sent ticked. */
function isTicked(field: FormField, value: string, initially: boolean): boolean {
  if (!field.submitted) {
    return initially;
  }
  const echoed = field.echoed;
  return echoed === value || (Array.isArray(echoed) && echoed.includes(value));
}

const panel = 'grid content-start gap-2';
// Long lists scroll inside a box on wider screens; on a phone the page itself scrolls.
const listBox = 'grid list-none gap-1 rounded-md border border-line bg-surface p-1.5 md:max-h-[30rem] md:overflow-y-auto';
const row =
  'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-md px-2.5 py-2 has-[[data-link]:checked]:bg-sunken hover:bg-sunken/60';
const revealed = 'col-start-2 hidden gap-3 pt-2 pb-1 peer-checked:grid';
const smallCheck = 'inline-flex min-h-8 items-center gap-2 text-sm font-semibold';

function NoteField({ issueId, name, label, title, initial, placeholder }: {
  readonly issueId: string;
  readonly name: 'summary' | 'cause' | 'fix';
  readonly label: string;
  readonly title: string;
  readonly initial: string;
  readonly placeholder: string;
}): React.JSX.Element {
  const field = useFormField(issueField(issueId, name));
  return (
    <div className="grid content-start gap-1">
      <label htmlFor={field.id} className="text-sm">
        {label}
        <span className="visually-hidden"> — {title}</span>
      </label>
      <textarea
        key={field.key}
        id={field.id}
        name={issueField(issueId, name)}
        rows={2}
        maxLength={1000}
        placeholder={placeholder}
        defaultValue={typeof field.echoed === 'string' ? field.echoed : initial}
        aria-invalid={field.error === undefined ? undefined : true}
        aria-describedby={field.error === undefined ? undefined : field.errorId}
      />
      {field.error === undefined ? null : (
        <p id={field.errorId} className="text-sm font-semibold text-danger-fg">
          {field.error}
        </p>
      )}
    </div>
  );
}

type IssueChoice = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly context: IssueOption | null;
  readonly link: EntryIssueLinkVM | null;
};

function IssueRow({ issue, field }: { readonly issue: IssueChoice; readonly field: FormField }): React.JSX.Element {
  const box = useFormField(`issueIds.${issue.id}`);
  const resolves = useFormField(issueField(issue.id, 'resolves'));
  const link = issue.link;
  return (
    <li className={row}>
      <input
        id={box.id}
        className="peer mt-1"
        type="checkbox"
        name="issueIds"
        value={issue.id}
        data-link=""
        defaultChecked={isTicked(field, issue.id, link !== null)}
        aria-describedby={issue.context === null ? undefined : `${box.id}-context`}
      />
      <label htmlFor={box.id} className="font-semibold">
        {issue.title}
      </label>
      {issue.context === null ? null : (
        <span id={`${box.id}-context`} className="col-start-2 flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
          <StatusTag status={issue.context.priority} title="Priority" />
          <span>{issue.context.deadlineLabel}</span>
        </span>
      )}
      {/* BR-44: shown once the issue is ticked — its context, then what this work found. */}
      <div className={revealed}>
        {issue.description === '' ? null : <p className="line-clamp-4 text-sm whitespace-pre-line text-muted">{issue.description}</p>}
        <div className="grid gap-3 md:grid-cols-3">
          <NoteField issueId={issue.id} name="summary" label="Issue" title={issue.title} initial={link?.summary ?? ''} placeholder="What was wrong" />
          <NoteField issueId={issue.id} name="cause" label="Cause" title={issue.title} initial={link?.cause ?? ''} placeholder="Why it happened" />
          <NoteField issueId={issue.id} name="fix" label="Fix" title={issue.title} initial={link?.fix ?? ''} placeholder="What changed" />
        </div>
        <label className={smallCheck}>
          <input
            key={resolves.key}
            type="checkbox"
            name={issueField(issue.id, 'resolves')}
            defaultChecked={isTicked(resolves, 'on', link?.resolves ?? false)}
          />
          <span>
            This fixes it<span className="visually-hidden"> — {issue.title}</span>
            <span className="font-normal text-muted"> · closes the issue on this date</span>
          </span>
        </label>
      </div>
    </li>
  );
}

/** BR-17, BR-44: issues the work was on; ticking one opens its Issue / Cause / Fix. */
function IssueLinks({ choices }: { readonly choices: readonly IssueChoice[] }): React.JSX.Element {
  const field = useFormField('issueIds');
  return (
    <fieldset id={field.id} className={panel} aria-describedby={`${field.id}-hint`}>
      <legend>Issues</legend>
      <p id={`${field.id}-hint`} className="text-xs text-muted">
        Tick the issues this work was on. Short notes are enough — the full story is on the pull requests.
      </p>
      {choices.length === 0 ? (
        <p className="muted">No open issues.</p>
      ) : (
        <ul className={listBox} key={field.key}>
          {choices.map((issue) => (
            <IssueRow key={issue.id} issue={issue} field={field} />
          ))}
        </ul>
      )}
      {field.error === undefined ? null : <p className="text-sm font-semibold text-danger-fg">{field.error}</p>}
    </fieldset>
  );
}

type PlanChoice = { readonly id: string; readonly title: string; readonly link: EntryPlanItemLinkVM | null };

function PlanItemRow({ item, field }: { readonly item: PlanChoice; readonly field: FormField }): React.JSX.Element {
  const box = useFormField(`planItemIds.${item.id}`);
  const completes = useFormField(planItemField(item.id));
  return (
    <li className={row}>
      <input
        id={box.id}
        className="peer mt-1"
        type="checkbox"
        name="planItemIds"
        value={item.id}
        data-link=""
        defaultChecked={isTicked(field, item.id, item.link !== null)}
      />
      <label htmlFor={box.id} className="font-normal">
        {item.title}
      </label>
      <div className={revealed}>
        <label className={smallCheck}>
          <input key={completes.key} type="checkbox" name={planItemField(item.id)} defaultChecked={isTicked(completes, 'on', item.link?.completes ?? false)} />
          <span>
            This finishes it<span className="visually-hidden"> — {item.title}</span>
          </span>
        </label>
      </div>
    </li>
  );
}

/** BR-17, BR-45 */
function PlanItemLinks({ choices }: { readonly choices: readonly PlanChoice[] }): React.JSX.Element {
  const field = useFormField('planItemIds');
  return (
    <fieldset id={field.id} className={panel}>
      <legend>Plan items</legend>
      {choices.length === 0 ? (
        <p className="muted">Nothing planned.</p>
      ) : (
        <ul className={`${listBox} md:max-h-64`} key={field.key}>
          {choices.map((item) => (
            <PlanItemRow key={item.id} item={item} field={field} />
          ))}
        </ul>
      )}
      {field.error === undefined ? null : <p className="text-sm font-semibold text-danger-fg">{field.error}</p>}
    </fieldset>
  );
}

/** The open issues to choose from, plus any the entry already links (they may be resolved now). */
function issueChoices(pickers: Pickers, values: EntryFormValues): readonly IssueChoice[] {
  const links = new Map(values.issues.map((link) => [link.id, link]));
  const open = pickers.issues.map((option) => ({
    id: option.value,
    title: option.label,
    description: option.description,
    context: option,
    link: links.get(option.value) ?? null,
  }));
  const seen = new Set(open.map((choice) => choice.id));
  const linkedOnly = values.issues.filter((link) => !seen.has(link.id)).map((link) => ({ id: link.id, title: link.title, description: '', context: null, link }));
  return [...linkedOnly, ...open];
}

function planChoices(pickers: Pickers, values: EntryFormValues): readonly PlanChoice[] {
  const links = new Map(values.planItems.map((link) => [link.id, link]));
  const open = pickers.planItems.map((option) => ({ id: option.value, title: option.label, link: links.get(option.value) ?? null }));
  const seen = new Set(open.map((choice) => choice.id));
  return [...values.planItems.filter((link) => !seen.has(link.id)).map((link) => ({ id: link.id, title: link.title, link })), ...open];
}

type EntryFormProps = {
  readonly action: FormAction;
  readonly pickers: Pickers;
  readonly values: EntryFormValues;
  readonly submitLabel: string;
  readonly label: string;
  readonly autoFocus?: boolean;
};

/**
 * BR-17, BR-44…BR-46: a wide two-column form. Left: what was done and the issues it was on,
 * each with its Issue / Cause / Fix. Right: when, where, the pull requests, who, the plan.
 */
export function EntryForm({ action, pickers, values, submitLabel, label, autoFocus = false }: EntryFormProps): React.JSX.Element {
  return (
    <ActionForm action={action} submitLabel={submitLabel} label={label} onKeyDown={submitOnModEnter}>
      <div className="col-span-full grid items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <div className="grid content-start gap-6">
          <TextAreaField
            name="description"
            label="What was done"
            defaultValue={values.description}
            required
            maxLength={2000}
            rows={3}
            autoFocus={autoFocus}
            hint="Ctrl+Enter or ⌘+Enter saves."
          />
          <IssueLinks choices={issueChoices(pickers, values)} />
        </div>
        <div className="grid content-start gap-x-4 gap-y-5 sm:grid-cols-2">
          <TextField name="workDate" label="Date" type="date" defaultValue={values.workDate} required />
          <SelectField name="areaId" label="Area" options={pickers.areas} defaultValue={values.areaId} emptyLabel="General (no area)" />
          <TextAreaField
            name="prUrls"
            label="Pull request links"
            defaultValue={values.prUrls}
            rows={2}
            maxLength={2000}
            hint="One per line — front end and back end can be separate PRs."
          />
          <CheckboxGroupField name="personIds" legend="People" options={pickers.people} defaultValues={values.personIds} />
          <div className="col-span-full">
            <PlanItemLinks choices={planChoices(pickers, values)} />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}

type Remembered = { readonly areaId: string; readonly personIds: readonly string[] };

/*
 * The quick log remembers the area and people of the last entry in this project, in this
 * browser only. A convenience: if storage is unavailable, the form simply starts empty.
 */
function storageKey(projectId: string): string {
  return `worklog:quick-log:${projectId}`;
}

function rememberChoices(projectId: string, form: HTMLFormElement): void {
  const data = new FormData(form);
  const area = data.get('areaId');
  const remembered: Remembered = {
    areaId: typeof area === 'string' ? area : '',
    personIds: data.getAll('personIds').filter((value): value is string => typeof value === 'string'),
  };
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(remembered));
  } catch {
    // Private mode or storage blocked: nothing to remember.
  }
}

function readChoices(projectId: string): Remembered | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(projectId)) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const areaId: unknown = Reflect.get(parsed, 'areaId');
    const personIds: unknown = Reflect.get(parsed, 'personIds');
    return {
      areaId: typeof areaId === 'string' ? areaId : '',
      personIds: Array.isArray(personIds) ? personIds.filter((id): id is string => typeof id === 'string') : [],
    };
  } catch {
    return null;
  }
}

/** Fills area and people from the last entry — only into a form not yet started. */
function applyChoices(projectId: string, panel: HTMLElement): void {
  const form = panel.querySelector('form');
  const remembered = readChoices(projectId);
  if (form === null || remembered === null || (form.querySelector('textarea')?.value ?? '') !== '') {
    return;
  }
  const area = form.querySelector<HTMLSelectElement>('select[name="areaId"]');
  if (area !== null && Array.from(area.options).some((option) => option.value === remembered.areaId)) {
    area.value = remembered.areaId;
  }
  for (const box of form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="personIds"]')) {
    box.checked = remembered.personIds.includes(box.value);
  }
}

/** Reachable from every project page (product spec §6). */
export function QuickLog({
  action,
  pickers,
  today,
  projectId,
}: {
  readonly action: FormAction;
  readonly pickers: Pickers;
  readonly today: string;
  readonly projectId: string;
}): React.JSX.Element {
  const values = emptyEntryValues(today);
  // Opening the panel fills in the last area and people, and puts the cursor in the description.
  const onToggle = (event: React.SyntheticEvent<HTMLDetailsElement>): void => {
    if (event.currentTarget.open) {
      applyChoices(projectId, event.currentTarget);
      event.currentTarget.querySelector('textarea')?.focus();
    }
  };
  return (
    <details
      className="quick-log"
      id="quick-log"
      onToggle={onToggle}
      onSubmitCapture={(event) => {
        if (event.target instanceof HTMLFormElement) {
          rememberChoices(projectId, event.target);
        }
      }}
      onResetCapture={(event) => {
        // After a save React resets the form; fill the remembered choices back in.
        const panel = event.currentTarget;
        window.setTimeout(() => {
          applyChoices(projectId, panel);
        }, 0);
      }}
    >
      <summary>Quick log</summary>
      <EntryForm action={action} pickers={pickers} values={values} submitLabel="Log work" label="Quick log" />
    </details>
  );
}

/** What a new entry should start out linked to: one issue or one plan item. */
export type QuickLogLink = { readonly field: 'issueIds' | 'planItemIds'; readonly id: string };

/**
 * Opens the Quick log at the top of the page (an anchor jump without JavaScript). With
 * `link`, the entry starts out linked to that issue or plan item — logging work from the
 * thing you worked on, without finding it in the list again.
 */
export function OpenQuickLog({ link, label = 'Log work' }: { readonly link?: QuickLogLink; readonly label?: string }): React.JSX.Element {
  return (
    <a
      className="button"
      data-size="small"
      data-variant="primary"
      href="#quick-log"
      onClick={(event) => {
        const panel = document.getElementById('quick-log');
        if (panel instanceof HTMLDetailsElement) {
          event.preventDefault();
          panel.open = true;
          if (link !== undefined) {
            for (const box of panel.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${link.field}"]`)) {
              if (box.value === link.id) {
                box.checked = true;
              }
            }
          }
          panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
          panel.querySelector('textarea')?.focus({ preventScroll: true });
        }
      }}
    >
      {label}
    </a>
  );
}
