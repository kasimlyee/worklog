import { describe, expect, it } from 'vitest';
import { classNames, declaration } from './css-module-types.ts';

describe('css module types', () => {
  it('collects class selectors, ignoring comments and decimals', () => {
    const css = '/* .ignored */ .card { padding: 0.5rem; } .card a, .row:hover .title-x { margin: .25em }';

    expect(classNames(css)).toEqual(['card', 'row', 'title-x']);
  });

  it('declares each class as a string property', () => {
    expect(declaration(['a', 'b-c'])).toContain('  readonly "b-c": string;');
  });
});
