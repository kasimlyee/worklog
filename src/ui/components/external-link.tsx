/** BR-34: external links open in a new tab and never pass the referrer. */
export function ExternalLink({ href, children }: { readonly href: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}
