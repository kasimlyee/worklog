import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './proxy.ts';

describe('content security policy', () => {
  it('uses a nonce with strict-dynamic and blocks framing, plugins and base tags', () => {
    const csp = contentSecurityPolicy('abc', { isDevelopment: false, isHttps: true });

    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc'");
    for (const directive of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'", 'upgrade-insecure-requests']) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toContain('unsafe');
  });

  it('upgrades insecure requests only on https', () => {
    expect(contentSecurityPolicy('abc', { isDevelopment: false, isHttps: false })).not.toContain('upgrade-insecure-requests');
  });

  it('relaxes only what the development server needs', () => {
    expect(contentSecurityPolicy('abc', { isDevelopment: true, isHttps: false })).toContain("'unsafe-eval'");
  });
});
