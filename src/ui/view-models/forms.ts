/* docs/04 §2.3: forms receive their action as `(state, formData) => Promise<State>`. */

export type FormValues = Readonly<Record<string, string | readonly string[]>>;

export type FormState =
  | { readonly status: 'idle' }
  | { readonly status: 'success'; readonly message: string | null }
  | {
      readonly status: 'error';
      /** Shown at the top of the form, e.g. "Please correct the highlighted fields." */
      readonly message: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
      /** What was submitted, so fields keep their input after React resets the form. */
      readonly values: FormValues;
    };

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** A one-click action (status change, delete, archive). Failures surface on the error page. */
export type PlainAction = (formData: FormData) => Promise<void>;

export const idleForm: FormState = { status: 'idle' };
