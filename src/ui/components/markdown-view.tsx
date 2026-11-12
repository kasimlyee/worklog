/**
 * The only component that renders HTML unescaped. Its input is markdown-it output produced
 * on the server with `html: false` and an http(s)/mailto-only link policy (BR-33, BR-34).
 */
export function MarkdownView({ html, label }: { readonly html: string; readonly label?: string }): React.JSX.Element {
  return <div className="markdown" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
}
