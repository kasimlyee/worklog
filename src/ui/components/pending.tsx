'use client';

/*
 * Client Component — justified: immediate feedback while a one-click action runs, so a
 * click never looks ignored. The forms still post natively before hydration.
 */

import { useFormStatus } from 'react-dom';

type PendingSubmitProps = {
  readonly label: string;
  readonly pendingLabel?: string;
  readonly variant?: 'primary' | 'ghost' | 'danger';
  readonly accessibleLabel?: string;
};

/** A submit button that says what it is doing while its form's action runs. */
export function PendingSubmit({ label, pendingLabel = 'Saving…', variant, accessibleLabel }: PendingSubmitProps): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" data-size="small" data-variant={variant} aria-label={accessibleLabel} aria-disabled={pending} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

type AutoSubmitSelectProps = {
  readonly id: string;
  readonly name: string;
  readonly defaultValue: string;
  readonly className?: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
};

/** Saves as soon as a new value is chosen; the form's own button remains for keyboard and no-JavaScript use. */
export function AutoSubmitSelect({ id, name, defaultValue, className, options }: AutoSubmitSelectProps): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className={className}
      aria-busy={pending}
      onChange={(event) => {
        event.currentTarget.form?.requestSubmit();
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
