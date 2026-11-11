'use client';

/*
 * Client Component — justified: shows server validation errors next to fields without a
 * page reload (useActionState), keeping input after React's automatic form reset. Forms
 * still post natively before hydration (docs/02 §10).
 */

import { createContext, use, useActionState, useEffect, useId, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { idleForm, type FormAction, type FormState, type FormValues } from '#src/ui/view-models/forms.ts';
import type { Option } from '#src/ui/view-models/common.ts';
import styles from './form.module.css';

type FieldContext = {
  readonly formId: string;
  readonly errors: Readonly<Record<string, string>>;
  readonly values: FormValues | null;
  /** Changes with every result, so fields remount with the echoed values. */
  readonly version: number;
};

const FormContext = createContext<FieldContext>({ formId: 'form', errors: {}, values: null, version: 0 });

function fieldId(formId: string, name: string): string {
  return `${formId}-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function useField(name: string): { readonly id: string; readonly errorId: string; readonly error: string | undefined; readonly echoed: string | readonly string[] | undefined; readonly key: string } {
  const context = use(FormContext);
  const id = fieldId(context.formId, name);
  return {
    id,
    errorId: `${id}-error`,
    error: context.errors[name],
    echoed: context.values?.[name],
    key: `${name}-${String(context.version)}`,
  };
}

function SubmitButton({ label, pendingLabel }: { readonly label: string; readonly pendingLabel: string }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" data-variant="primary" disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Top-of-form summary with links to each invalid field; takes focus when it appears. */
export function ErrorSummary({ formId, state }: { readonly formId: string; readonly state: FormState }): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === 'error') {
      ref.current?.focus();
    }
  }, [state]);
  if (state.status !== 'error') {
    return null;
  }
  const fields = Object.entries(state.fieldErrors).filter(([name]) => name !== 'form');
  return (
    <div ref={ref} className={styles.summary} role="alert" tabIndex={-1}>
      <p className={styles.summaryTitle}>{state.message}</p>
      {fields.length > 0 ? (
        <ul>
          {fields.map(([name, message]) => (
            <li key={name}>
              <a href={`#${fieldId(formId, name)}`}>{message}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type Versioned = { readonly state: FormState; readonly version: number };
const initial: Versioned = { state: idleForm, version: 0 };

type ActionFormProps = {
  readonly action: FormAction;
  readonly submitLabel: string;
  readonly pendingLabel?: string;
  readonly children: React.ReactNode;
  /** Accessible name for the form landmark. */
  readonly label: string;
  readonly layout?: 'stack' | 'inline';
  readonly extraActions?: React.ReactNode;
  readonly onKeyDown?: React.KeyboardEventHandler<HTMLFormElement>;
};

export function ActionForm({
  action,
  submitLabel,
  pendingLabel = 'Saving…',
  children,
  label,
  layout = 'stack',
  extraActions,
  onKeyDown,
}: ActionFormProps): React.JSX.Element {
  const [{ state, version }, formAction] = useActionState(
    async (previous: Versioned, formData: FormData): Promise<Versioned> => ({
      state: await action(previous.state, formData),
      version: previous.version + 1,
    }),
    initial,
  );
  const formId = useId().replace(/:/g, '');
  const context: FieldContext = {
    formId,
    errors: state.status === 'error' ? state.fieldErrors : {},
    values: state.status === 'error' ? state.values : null,
    version,
  };
  return (
    <form action={formAction} aria-label={label} className={styles.form} data-layout={layout} noValidate onKeyDown={onKeyDown}>
      <ErrorSummary formId={formId} state={state} />
      {state.status === 'success' && state.message !== null ? (
        <p className={styles.success} role="status">
          {state.message}
        </p>
      ) : null}
      <FormContext value={context}>
        <div className={styles.fields}>{children}</div>
      </FormContext>
      <div className={styles.actions}>
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
        {extraActions}
      </div>
    </form>
  );
}

function FieldShell({
  id,
  errorId,
  label,
  hint,
  error,
  children,
  wide,
}: {
  readonly id: string;
  readonly errorId: string;
  readonly label: string;
  readonly hint: string | undefined;
  readonly error: string | undefined;
  readonly children: React.ReactNode;
  readonly wide: boolean | undefined;
}): React.JSX.Element {
  return (
    <div className={styles.field} data-wide={wide === true ? 'true' : undefined}>
      <label htmlFor={id}>{label}</label>
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {children}
      {error === undefined ? null : (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint: string | undefined, error: string | undefined): string | undefined {
  const ids = [hint === undefined ? null : `${id}-hint`, error === undefined ? null : `${id}-error`].filter((value) => value !== null);
  return ids.length === 0 ? undefined : ids.join(' ');
}

function asText(value: string | readonly string[] | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

type TextFieldProps = {
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: string;
  readonly type?: 'text' | 'date' | 'url' | 'search';
  readonly hint?: string;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly autoFocus?: boolean;
  readonly placeholder?: string;
  readonly min?: string;
  readonly max?: string;
  readonly wide?: boolean;
};

export function TextField({ name, label, defaultValue = '', type = 'text', hint, wide, ...rest }: TextFieldProps): React.JSX.Element {
  const field = useField(name);
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} hint={hint} error={field.error} wide={wide}>
      <input
        key={field.key}
        id={field.id}
        name={name}
        type={type}
        defaultValue={asText(field.echoed, defaultValue)}
        aria-invalid={field.error === undefined ? undefined : true}
        aria-describedby={describedBy(field.id, hint, field.error)}
        {...rest}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = {
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly rows?: number;
  readonly autoFocus?: boolean;
  readonly onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
};

export function TextAreaField({ name, label, defaultValue = '', hint, ...rest }: TextAreaFieldProps): React.JSX.Element {
  const field = useField(name);
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} hint={hint} error={field.error} wide>
      <textarea
        key={field.key}
        id={field.id}
        name={name}
        defaultValue={asText(field.echoed, defaultValue)}
        aria-invalid={field.error === undefined ? undefined : true}
        aria-describedby={describedBy(field.id, hint, field.error)}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = {
  readonly name: string;
  readonly label: string;
  readonly options: readonly Option[];
  readonly defaultValue?: string;
  /** Label of the empty choice; omit to require a choice. */
  readonly emptyLabel?: string;
  readonly hint?: string;
};

export function SelectField({ name, label, options, defaultValue = '', emptyLabel, hint }: SelectFieldProps): React.JSX.Element {
  const field = useField(name);
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} hint={hint} error={field.error} wide={false}>
      <select
        key={field.key}
        id={field.id}
        name={name}
        defaultValue={asText(field.echoed, defaultValue)}
        aria-invalid={field.error === undefined ? undefined : true}
        aria-describedby={describedBy(field.id, hint, field.error)}
      >
        {emptyLabel === undefined ? null : <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type CheckboxGroupProps = {
  readonly name: string;
  readonly legend: string;
  readonly options: readonly Option[];
  readonly defaultValues?: readonly string[];
  readonly hint?: string;
};

export function CheckboxGroupField({ name, legend, options, defaultValues = [], hint }: CheckboxGroupProps): React.JSX.Element {
  const field = useField(name);
  const echoed = field.echoed;
  const checked = new Set(echoed === undefined ? defaultValues : typeof echoed === 'string' ? [echoed] : echoed);
  return (
    <fieldset
      id={field.id}
      className={styles.field}
      data-wide="true"
      aria-invalid={field.error === undefined ? undefined : true}
      aria-describedby={describedBy(field.id, hint, field.error)}
    >
      <legend>{legend}</legend>
      {hint === undefined ? null : (
        <p id={`${field.id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {options.length === 0 ? <p className="muted">Nothing to choose yet.</p> : null}
      <div className={styles.checkboxes} key={field.key}>
        {options.map((option) => (
          <label key={option.value} className={styles.checkbox}>
            <input type="checkbox" name={name} value={option.value} defaultChecked={checked.has(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {field.error === undefined ? null : (
        <p id={field.errorId} className={styles.error}>
          {field.error}
        </p>
      )}
    </fieldset>
  );
}

/** A hidden value that travels with the form (ids, period starts). */
export function HiddenField({ name, value }: { readonly name: string; readonly value: string }): React.JSX.Element {
  return <input type="hidden" name={name} value={value} />;
}
