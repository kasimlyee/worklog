import 'server-only';

type Level = 'info' | 'warn' | 'error';
type Fields = Readonly<Record<string, string | number | boolean | null>>;

/** One-line JSON to stdout. Never pass secrets, tokens, cookies or request bodies. */
export function log(level: Level, event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}
