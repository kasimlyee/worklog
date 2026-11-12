/* A few calm tints; a name always gets the same one. */
const tints = ['bg-accent-soft text-accent', 'bg-success-bg text-success-fg', 'bg-warning-bg text-warning-fg', 'bg-neutral-bg text-neutral-fg'] as const;

function tintOf(name: string): string {
  let sum = 0;
  for (const char of name) {
    sum += char.codePointAt(0) ?? 0;
  }
  return tints[sum % tints.length] ?? tints[0];
}

/** R-09 style: people by name. The initials are decoration; the names are the content. */
export function PersonList({ people, empty = 'Unassigned' }: { readonly people: readonly string[]; readonly empty?: string }): React.JSX.Element {
  if (people.length === 0) {
    return <span className="muted">{empty}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span className="flex -space-x-1.5" aria-hidden="true">
        {people.map((name) => (
          <span key={name} className={`grid size-5 place-items-center rounded-full text-[0.625rem] font-bold uppercase ring-2 ring-surface ${tintOf(name)}`}>
            {String.fromCodePoint(name.trim().codePointAt(0) ?? 63)}
          </span>
        ))}
      </span>
      <span>{people.join(', ')}</span>
    </span>
  );
}
