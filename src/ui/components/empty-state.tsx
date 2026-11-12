export function EmptyState({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <p className="rounded-md border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">{children}</p>;
}
