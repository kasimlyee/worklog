import { describe, expect, it } from 'vitest';
import { sanitizeForPdf } from './pdf-sanitize.ts';

describe('sanitizeForPdf', () => {
  it('keeps ASCII, Latin-1 and Windows-1252 punctuation', () => {
    expect(sanitizeForPdf('Café – “quoted” … €5 · naïve')).toBe('Café – “quoted” … €5 · naïve');
  });

  it('drops accents that WinAnsi cannot encode when the base letter can be', () => {
    expect(sanitizeForPdf('Erdős Łódź')).toBe('Erdos ?ódz');
  });

  it('replaces emoji, CJK and other scripts with the fallback, one per character', () => {
    expect(sanitizeForPdf('ok 😀 中文')).toBe('ok ? ??');
  });

  it('turns tabs, newlines and Unicode separators into spaces', () => {
    expect(sanitizeForPdf('a\tb\nc d')).toBe('a b c d');
  });

  it('replaces control characters', () => {
    expect(sanitizeForPdf('a\u0000b\u0007')).toBe('a?b?');
  });
});
