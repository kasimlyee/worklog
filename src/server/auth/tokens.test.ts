import { describe, expect, it } from 'vitest';
import { hashToken, randomToken, tokensMatch } from './tokens.ts';

describe('tokens', () => {
  it('generates 32 random bytes as base64url', () => {
    const token = randomToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(token);
  });

  it('hashes with SHA-256', () => {
    expect(hashToken('abc').toString('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('compares tokens of any length without throwing', () => {
    expect(tokensMatch('same', 'same')).toBe(true);
    expect(tokensMatch('same', 'different-length')).toBe(false);
    expect(tokensMatch('', 'x')).toBe(false);
  });
});
