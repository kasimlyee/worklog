import type { StatusVM } from '#src/ui/view-models/common.ts';

/* A pill with a dot: the dot repeats the tone, and the label always says it in words too. */
const tag =
  'inline-flex items-center gap-1.5 rounded-full border py-px pr-2.5 pl-2 align-middle text-xs leading-normal font-semibold whitespace-nowrap before:size-1.5 before:flex-none before:rounded-full before:bg-current';

const tones: Readonly<Record<StatusVM['tone'], string>> = {
  success: 'border-success-line bg-success-bg text-success-fg',
  warning: 'border-warning-line bg-warning-bg text-warning-fg',
  danger: 'border-danger-line bg-danger-bg text-danger-fg',
  neutral: 'border-neutral-line bg-neutral-bg text-neutral-fg',
};

/** Product spec §5: one component for every status — colour and text, always together. */
export function StatusTag({ status, title }: { readonly status: StatusVM; readonly title?: string }): React.JSX.Element {
  return (
    <span className={`${tag} ${tones[status.tone]}`} data-tone={status.tone} title={title}>
      {status.label}
    </span>
  );
}

/** A deadline state: the same tag, announced as a deadline. */
export function DeadlineLabel({ status }: { readonly status: StatusVM }): React.JSX.Element {
  return (
    <span className="inline-flex">
      <span className="visually-hidden">Deadline: </span>
      <StatusTag status={status} />
    </span>
  );
}
