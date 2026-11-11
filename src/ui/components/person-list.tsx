/** R-09 style: names as plain labels. */
export function PersonList({ people, empty = 'Unassigned' }: { readonly people: readonly string[]; readonly empty?: string }): React.JSX.Element {
  return people.length === 0 ? <span className="muted">{empty}</span> : <span>{people.join(', ')}</span>;
}
