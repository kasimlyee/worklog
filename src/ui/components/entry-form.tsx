'use client';

/*
 * Client Component — justified: the quick log submits from the keyboard alone
 * (Enter in a field, Ctrl/⌘+Enter in the description) — product spec §6.
 */

import type { Pickers } from '#src/ui/view-models/common.ts';
import type { EntryFormValues } from '#src/ui/view-models/entries.ts';
import type { FormAction } from '#src/ui/view-models/forms.ts';
import { ActionForm, CheckboxGroupField, SelectField, TextAreaField, TextField } from './form.tsx';

function submitOnModEnter(event: React.KeyboardEvent<HTMLFormElement>): void {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }
}

const resolveOption = [{ value: 'on', label: 'Resolve the linked issues' }] as const;

type EntryFormProps = {
  readonly action: FormAction;
  readonly pickers: Pickers;
  readonly values: EntryFormValues;
  readonly submitLabel: string;
  readonly label: string;
  readonly autoFocus?: boolean;
  /** BR-41: offer to resolve the linked issues when the work is logged (new entries only). */
  readonly canResolve?: boolean;
};

/** BR-17: date, description, area, people, PR link, any plan items and issues. */
export function EntryForm({ action, pickers, values, submitLabel, label, autoFocus = false, canResolve = false }: EntryFormProps): React.JSX.Element {
  return (
    <ActionForm action={action} submitLabel={submitLabel} label={label} onKeyDown={submitOnModEnter}>
      <TextAreaField
        name="description"
        label="What was done"
        defaultValue={values.description}
        required
        maxLength={2000}
        rows={2}
        autoFocus={autoFocus}
        hint="Ctrl+Enter or ⌘+Enter saves."
      />
      <TextField name="workDate" label="Date" type="date" defaultValue={values.workDate} required />
      <SelectField name="areaId" label="Area" options={pickers.areas} defaultValue={values.areaId} emptyLabel="General (no area)" />
      <TextField
        name="prUrl"
        label="Pull request link"
        type="url"
        defaultValue={values.prUrl}
        placeholder="https://github.com/org/repo/pull/123"
      />
      <CheckboxGroupField name="issueIds" legend="Issues it fixes or works on" options={pickers.issues} defaultValues={values.issueIds} scrollable />
      {canResolve && pickers.issues.length > 0 ? (
        <CheckboxGroupField
          name="resolveIssues"
          legend="When this fixes them"
          options={resolveOption}
          hint="Marks the ticked issues resolved on this date, by this pull request."
        />
      ) : null}
      <CheckboxGroupField name="planItemIds" legend="Plan items it fulfils" options={pickers.planItems} defaultValues={values.planItemIds} scrollable />
      <CheckboxGroupField name="personIds" legend="People" options={pickers.people} defaultValues={values.personIds} />
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
  const values: EntryFormValues = { workDate: today, description: '', areaId: '', personIds: [], prUrl: '', planItemIds: [], issueIds: [] };
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
      <EntryForm action={action} pickers={pickers} values={values} submitLabel="Log work" label="Quick log" canResolve />
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
