/** docs/04 §2.4: preview routes exist only outside production. */
export function isPreviewEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}
