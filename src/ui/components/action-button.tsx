import type { PlainAction } from '#src/ui/view-models/forms.ts';

/** A one-button form for a one-click action. Works without JavaScript. */
export function ActionButton({
  action,
  label,
  fields = {},
  variant,
  accessibleLabel,
}: {
  readonly action: PlainAction;
  readonly label: string;
  readonly fields?: Readonly<Record<string, string>>;
  readonly variant?: 'primary' | 'ghost';
  readonly accessibleLabel?: string;
}): React.JSX.Element {
  return (
    <form action={action} className="inline-form">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" data-size="small" data-variant={variant} aria-label={accessibleLabel}>
        {label}
      </button>
    </form>
  );
}
