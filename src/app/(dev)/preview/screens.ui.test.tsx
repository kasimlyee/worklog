import { cleanup, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { screens } from './screens.tsx';

vi.mock('next/navigation', () => ({ usePathname: () => '/projects' }));

/* docs/04 §2: every screen of product spec §6 has a preview, and each one is well-formed. */

describe('every preview screen', () => {
  it.each(Object.keys(screens))('%s has one h1 and no nested forms', (name) => {
    const preview = screens[name];
    if (preview === undefined) {
      throw new Error(`missing ${name}`);
    }
    render(preview.element);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.querySelectorAll('form form')).toHaveLength(0);
    // Every form control has an accessible name.
    for (const control of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
      expect(control.labels?.length ?? 0, `${name}: ${control.outerHTML.slice(0, 80)}`).toBeGreaterThan(0);
    }
    cleanup();
  });

  it('covers every screen of product spec §6', () => {
    const required = ['sign-in', 'projects', 'dashboard', 'plans', 'log', 'issues', 'releases', 'notes', 'reports', 'settings', 'people'];

    expect(Object.keys(screens)).toEqual(expect.arrayContaining(required));
  });
});
