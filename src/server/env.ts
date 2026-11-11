import 'server-only';
import * as z from 'zod';
import { err, ok, type Result } from '#src/lib/result.ts';

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// https:// anywhere, or plain http only for the local E2E fake (docs/04 §3.2).
function isAllowedApiUrl(value: string): boolean {
  return /^https:\/\/[^\s/]+(\/.*)?$/.test(value) || /^http:\/\/localhost:\d{1,5}$/.test(value);
}

const requiredText = z.string().trim().min(1);

// Plain http only for a local machine: production always runs on https (secure cookies).
function isAllowedAppUrl(value: string): boolean {
  const url = new URL(value);
  return url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname);
}

const envSchema = z.object({
  APP_URL: z
    .url({ protocol: /^https?$/ })
    .refine(isAllowedAppUrl, 'must be https:// (plain http is only allowed for localhost)')
    .transform((url) => url.replace(/\/+$/, '')),
  APP_TIME_ZONE: requiredText.refine(isTimeZone, 'must be an IANA time zone, e.g. Africa/Kampala'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  GITHUB_OAUTH_CLIENT_ID: requiredText,
  GITHUB_OAUTH_CLIENT_SECRET: requiredText,
  ALLOWED_GITHUB_USER_ID: z.string().regex(/^[1-9]\d{0,15}$/, 'must be a numeric GitHub user id').transform(Number),
  GITHUB_PR_TOKEN: requiredText,
  GITHUB_ALLOWED_ORGS: requiredText.transform((value) =>
    value
      .split(',')
      .map((org) => org.trim().toLowerCase())
      .filter((org) => org.length > 0),
  ),
  GITHUB_API_URL: z
    .string()
    .refine(isAllowedApiUrl, 'must be an https:// URL, or http://localhost:{port} for tests')
    .transform((url) => url.replace(/\/+$/, ''))
    .default('https://api.github.com'),
  REPORT_AUTHOR_NAME: requiredText.max(120),
});

export type Env = z.infer<typeof envSchema>;

export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Parses configuration. Returns one readable message per invalid variable; never echoes values. */
export function parseEnv(source: EnvSource): Result<Env, readonly string[]> {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
}

let cached: Env | undefined;

/** The validated configuration. Throws (stopping the request) when anything is missing or invalid. */
export function env(): Env {
  if (cached === undefined) {
    const result = parseEnv(process.env);
    if (!result.ok) {
      throw new Error(`Invalid configuration:\n  ${result.error.join('\n  ')}`);
    }
    cached = result.value;
  }
  return cached;
}
