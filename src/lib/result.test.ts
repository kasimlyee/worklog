import { describe, expect, it } from 'vitest';
import { assertNever } from './assert-never.ts';
import { err, ok } from './result.ts';

describe('Result', () => {
  it('ok wraps a value', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  it('err wraps an error', () => {
    expect(err({ code: 'x' })).toEqual({ ok: false, error: { code: 'x' } });
  });
});

describe('assertNever', () => {
  it('throws with the unexpected value', () => {
    // @ts-expect-error -- deliberately passing a value the type system says is impossible
    expect(() => assertNever('surprise')).toThrow('Unexpected value: "surprise"');
  });
});
