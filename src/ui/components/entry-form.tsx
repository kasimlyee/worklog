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

/** BR-17: date, description, area, people, PR link, plan item, issue. */
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
      <SelectField name="planItemId" label="Plan item" options={pickers.planItems} defaultValue={values.planItemId} emptyLabel="None" />
      <SelectField name="issueId" label="Issue" options={pickers.issues} defaultValue={values.issueId} emptyLabel="None" />
      <CheckboxGroupField name="personIds" legend="People" options={pickers.people} defaultValues={values.personIds} />
    </ActionForm>
  );
}

/** Reachable from every project page (product spec §6). */
export function QuickLog({ action, pickers, today }: { readonly action: FormAction; readonly pickers: Pickers; readonly today: string }): React.JSX.Element {
  const values: EntryFormValues = { workDate: today, description: '', areaId: '', personIds: [], prUrl: '', planItemId: '', issueId: '' };
  // Opening the panel puts the cursor in the description, so logging needs no mouse.
  const focusDescription = (event: React.SyntheticEvent<HTMLDetailsElement>): void => {
    if (event.currentTarget.open) {
      event.currentTarget.querySelector('textarea')?.focus();
    }
  };
  return (
    <details className="quick-log" onToggle={focusDescription}>
      <summary>Quick log</summary>
      <EntryForm action={action} pickers={pickers} values={values} submitLabel="Log work" label="Quick log" />
    </details>
  );
}
