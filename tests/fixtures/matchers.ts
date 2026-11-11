import { expect } from 'vitest';

/* Vitest's asymmetric matchers are typed `any`; these wrappers keep `any` out of tests. */

export const anyString: unknown = expect.any(String);

export function anyInstanceOf(constructor: abstract new (...args: never[]) => unknown): unknown {
  const matcher: unknown = expect.any(constructor);
  return matcher;
}

export function objectContaining(shape: Readonly<Record<string, unknown>>): unknown {
  const matcher: unknown = expect.objectContaining(shape);
  return matcher;
}
