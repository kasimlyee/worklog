import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});

// jsdom has <dialog> but not its methods. Minimal stand-ins: open/close toggle the attribute.
if (!Reflect.has(HTMLDialogElement.prototype, 'showModal')) {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    },
  });
}
