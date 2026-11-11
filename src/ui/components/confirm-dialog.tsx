'use client';

/*
 * Client Component — justified: a modal confirmation before deleting (BR-36). The native
 * <dialog> traps focus while open and returns it to the trigger when closed.
 */

import { useId, useRef } from 'react';
import type { PlainAction } from '#src/ui/view-models/forms.ts';
import styles from './confirm-dialog.module.css';

type ConfirmDialogProps = {
  readonly action: PlainAction;
  /** Visible trigger text, e.g. "Delete". */
  readonly triggerLabel: string;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  /** Hidden fields sent with the confirmed action. */
  readonly fields?: Readonly<Record<string, string>>;
  readonly variant?: 'danger' | 'default';
};

export function ConfirmDialog({ action, triggerLabel, title, message, confirmLabel, fields = {}, variant = 'danger' }: ConfirmDialogProps): React.JSX.Element {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const open = (): void => {
    dialog.current?.showModal();
    // The safe choice first: Enter or Space on open never deletes anything.
    cancel.current?.focus();
  };
  const close = (): void => {
    dialog.current?.close();
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        data-size="small"
        data-variant={variant === 'danger' ? 'danger' : undefined}
        aria-haspopup="dialog"
        onClick={open}
      >
        {triggerLabel}
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}>
        <form action={action} className={styles.body}>
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-message`}>{message}</p>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className={styles.actions}>
            <button ref={cancel} type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit" data-variant={variant === 'danger' ? 'danger' : 'primary'} onClick={() => dialog.current?.close()}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
