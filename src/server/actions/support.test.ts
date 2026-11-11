import { describe, expect, it, vi } from 'vitest';
import { echoValues, formObject, toFormState } from './support.ts';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function form(entries: readonly (readonly [string, string])[]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) {
    data.append(name, value);
  }
  return data;
}

describe('formObject', () => {
  it('turns form fields into a plain object, with array fields always arrays', () => {
    const data = form([['title', 'x'], ['personIds', 'p1'], ['personIds', 'p2'], ['$ACTION_ID_abc', '']]);

    expect(formObject(data, ['personIds', 'pullRequestIds'])).toEqual({ title: 'x', personIds: ['p1', 'p2'], pullRequestIds: [] });
  });

  it('collects links.N.label / links.N.url rows in order', () => {
    const data = form([['links.1.url', 'https://b'], ['links.0.label', 'A'], ['links.0.url', 'https://a'], ['links.1.label', 'B']]);

    expect(formObject(data)).toEqual({ links: [{ label: 'A', url: 'https://a' }, { label: 'B', url: 'https://b' }] });
  });

  it('ignores files', () => {
    const data = new FormData();
    data.append('upload', new Blob(['x']), 'x.txt');

    expect(formObject(data)).toEqual({});
  });
});

describe('toFormState', () => {
  it('maps success, with its message', () => {
    expect(toFormState({ ok: true, value: 1 }, form([]), 'Saved.')).toEqual({ status: 'success', message: 'Saved.' });
  });

  it('maps field errors and echoes the submitted values', () => {
    const data = form([['name', 'Atlas'], ['personIds', 'p1'], ['personIds', 'p2']]);

    expect(toFormState({ ok: false, error: { code: 'invalid', fieldErrors: { name: 'Taken.' } } }, data, null)).toEqual({
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors: { name: 'Taken.' },
      values: { name: 'Atlas', personIds: ['p1', 'p2'] },
    });
  });

  it('maps not found and conflicts to a form-level message', () => {
    expect(toFormState({ ok: false, error: { code: 'not_found' } }, form([]), null)).toMatchObject({
      message: 'That item no longer exists. It may have been deleted.',
      fieldErrors: {},
    });
    expect(toFormState({ ok: false, error: { code: 'conflict', message: 'In use.' } }, form([]), null)).toMatchObject({ message: 'In use.' });
  });

  it('echoes single and repeated values', () => {
    expect(echoValues(form([['a', '1'], ['b', '2'], ['b', '3'], ['b', '4']]))).toEqual({ a: '1', b: ['2', '3', '4'] });
  });
});
