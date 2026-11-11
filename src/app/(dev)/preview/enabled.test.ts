import { describe, expect, it } from 'vitest';
import { isPreviewEnabled } from './enabled.ts';

describe('preview routes', () => {
  it('return 404 in production', () => {
    expect(isPreviewEnabled('production')).toBe(false);
  });

  it('are available in development and test', () => {
    expect(isPreviewEnabled('development')).toBe(true);
    expect(isPreviewEnabled('test')).toBe(true);
  });
});
