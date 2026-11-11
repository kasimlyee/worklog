import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug.ts';

describe('slugify', () => {
  it.each([
    ['Atlas Mobile App', 'atlas-mobile-app'],
    ['  Café — Ops!! ', 'cafe-ops'],
    ['日本', 'project'],
    ['a'.repeat(80), 'a'.repeat(50)],
  ])('%j → %j', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});

describe('uniqueSlug', () => {
  it('adds the first free numeric suffix', () => {
    expect(uniqueSlug('atlas', new Set())).toBe('atlas');
    expect(uniqueSlug('atlas', new Set(['atlas', 'atlas-2']))).toBe('atlas-3');
  });
});
