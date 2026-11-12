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

type EntryFormProps = {
  readonly action: FormAction;
  readonly pickers: Pickers;
  readonly values: EntryFormValues;
  readonly submitLabel: string;
  readonly label: string;
  readonly autoFocus?: boolean;
};

/** BR-17: date, description, area, people, PR link, any plan items and issues. */
export function EntryForm({ action, pickers, values, submitLabel, label, autoFocus = false }: EntryFormProps): React.JSX.Element {
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
      <CheckboxGroupField name="planItemIds" legend="Plan items it fulfils" options={pickers.planItems} defaultValues={values.planItemIds} scrollable />
      <CheckboxGroupField name="personIds" legend="People" options={pickers.people} defaultValues={values.personIds} />
    </ActionForm>
  );
}

/** Reachable from every project page (product spec §6). */
export function QuickLog({ action, pickers, today }: { readonly action: FormAction; readonly pickers: Pickers; readonly today: string }): React.JSX.Element {
  const values: EntryFormValues = { workDate: today, description: '', areaId: '', personIds: [], prUrl: '', planItemIds: [], issueIds: [] };
  // Opening the panel puts the cursor in the description, so logging needs no mouse.
  const focusDescription = (event: React.SyntheticEvent<HTMLDetailsElement>): void => {
    if (event.currentTarget.open) {
      event.currentTarget.querySelector('textarea')?.focus();
    }
  };
  return (
    <details className="quick-log" id="quick-log" onToggle={focusDescription}>
      <summary>Quick log</summary>
      <EntryForm action={action} pickers={pickers} values={values} submitLabel="Log work" label="Quick log" />
    </details>
  );
}

/** Opens the Quick log at the top of the page (an anchor jump without JavaScript). */
export function OpenQuickLog(): React.JSX.Element {
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
          panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
          panel.querySelector('textarea')?.focus({ preventScroll: true });
        }
      }}
    >
      Log work
    </a>
  );
}
