import { describe, expect, it } from 'vitest';
import { findLeaks } from './scan-client-bundle.ts';

describe('client bundle scan', () => {
  it('NF-06: finds secret variable names, token prefixes and secret values', () => {
    const bundle = 'var a="GITHUB_PR_TOKEN";var b="github_pat_11ABC";var c="postgres://user:hunter2-long@db";';

    expect(findLeaks(bundle, ['postgres://user:hunter2-long@db'])).toEqual(['GITHUB_PR_TOKEN', 'github_pat_', 'postgres://user:hunter2-long@db']);
  });

  it('NF-06: passes a clean bundle and ignores short values that would match by chance', () => {
    expect(findLeaks('function x(){return "Worklog"}', ['abc', ''])).toEqual([]);
  });
});
