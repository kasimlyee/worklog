/**
 * NF-06: fails if anything secret could reach the browser. Scans every file Next.js serves
 * to clients (.next/static) for secret variable names, GitHub token prefixes, and the
 * actual values of the secret variables in the current environment.
 *
 *   npm run build && node scripts/scan-client-bundle.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const staticDir = join(import.meta.dirname, '..', '.next', 'static');

export const secretNames = [
  'DATABASE_URL',
  'DATABASE_URL_DIRECT',
  'GITHUB_OAUTH_CLIENT_SECRET',
  'GITHUB_PR_TOKEN',
  'ALLOWED_GITHUB_USER_ID',
] as const;

// Prefixes of GitHub tokens: fine-grained PAT, OAuth access token, classic PAT, app tokens.
export const tokenPrefixes = ['github_pat_', 'gho_', 'ghp_', 'ghu_', 'ghs_', 'ghr_'] as const;

export function findLeaks(contents: string, secretValues: readonly string[]): readonly string[] {
  const needles = [...secretNames, ...tokenPrefixes, ...secretValues.filter((value) => value.length >= 8)];
  return needles.filter((needle) => contents.includes(needle));
}

function main(): void {
  const values = secretNames.map((name) => process.env[name] ?? '');
  const files = readdirSync(staticDir, { recursive: true, encoding: 'utf8' }).filter((file) => /\.(js|css|json|map|html)$/.test(file));
  let leaks = 0;
  for (const file of files) {
    for (const leak of findLeaks(readFileSync(join(staticDir, file), 'utf8'), values)) {
      // Never print a secret value itself.
      const label = (secretNames as readonly string[]).includes(leak) || (tokenPrefixes as readonly string[]).includes(leak) ? leak : '<secret value>';
      console.error(`${file}: contains ${label}`);
      leaks += 1;
    }
  }
  console.log(`Scanned ${String(files.length)} client files: ${leaks === 0 ? 'no secrets found' : `${String(leaks)} leak(s)`}.`);
  if (leaks > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
