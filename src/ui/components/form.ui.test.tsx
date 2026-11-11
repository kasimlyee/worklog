import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FormAction, FormState } from '#src/ui/view-models/forms.ts';
import { pickers, settings, today } from '#src/ui/fixtures/fixtures.ts';
import { ActionForm, CheckboxGroupField, SelectField, TextField } from './form.tsx';
import { QuickLog } from './entry-form.tsx';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { AreaReorder } from './area-reorder.tsx';

function returning(state: FormState): FormAction & ReturnType<typeof vi.fn> {
  return vi.fn(() => Promise.resolve(state));
}

const invalidName: FormState = {
  status: 'error',
  message: 'Please correct the highlighted fields.',
  fieldErrors: { name: 'A project with this name already exists.' },
  values: { name: 'Atlas', personIds: ['p2'] },
};

function NameForm({ action }: { readonly action: FormAction }): React.JSX.Element {
  return (
    <ActionForm action={action} submitLabel="Save" label="Project">
      <TextField name="name" label="Name" />
      <SelectField name="areaId" label="Area" options={pickers.areas} emptyLabel="None" />
      <CheckboxGroupField name="personIds" legend="People" options={pickers.people} />
    </ActionForm>
  );
}

describe('ActionForm', () => {
  it('sends the form data to its action', async () => {
    const action = returning({ status: 'success', message: 'Saved.' });
    render(<NameForm action={action} />);

    await userEvent.type(screen.getByLabelText('Name'), 'Atlas');
    await userEvent.click(screen.getByLabelText('Grace'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    const formData = action.mock.calls[0]?.[1];
    expect(formData instanceof FormData ? [formData.get('name'), formData.getAll('personIds')] : null).toEqual(['Atlas', ['p2']]);
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Saved.');
  });

  it('shows the error summary, focuses it, and links each message to its field', async () => {
    render(<NameForm action={returning(invalidName)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const summary = await screen.findByRole('alert');
    expect(summary.textContent).toContain('Please correct the highlighted fields.');
    expect(document.activeElement).toBe(summary);
    const input = screen.getByLabelText('Name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe('A project with this name already exists.');
    expect(screen.getByRole('link', { name: 'A project with this name already exists.' }).getAttribute('href')).toBe(`#${input.id}`);
  });

  it('keeps what was typed after an error', async () => {
    render(<NameForm action={returning(invalidName)} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('alert');
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Atlas');
    expect(screen.getByLabelText<HTMLInputElement>('Grace').checked).toBe(true);
  });
});

describe('QuickLog', () => {
  it('submits with the keyboard only: Ctrl+Enter in the description', async () => {
    const action = returning({ status: 'success', message: 'Logged.' });
    render(<QuickLog action={action} pickers={pickers} today={today} />);

    await userEvent.click(screen.getByText('Quick log'));
    await userEvent.keyboard('Fixed the login bug');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    const formData = action.mock.calls[0]?.[1];
    expect(formData instanceof FormData ? [formData.get('description'), formData.get('workDate')] : null).toEqual(['Fixed the login bug', today]);
  });

  it('has every field of product spec §6 with a label', () => {
    render(<QuickLog action={returning({ status: 'idle' })} pickers={pickers} today={today} />);

    for (const label of ['What was done', 'Date', 'Area', 'Pull request link', 'Plan item', 'Issue']) {
      expect(screen.getByLabelText(label)).toBeDefined();
    }
    expect(screen.getByRole('group', { name: 'People' })).toBeDefined();
  });
});

describe('ConfirmDialog', () => {
  it('BR-36: asks before acting, and Cancel returns focus to the trigger', async () => {
    const action = vi.fn(() => Promise.resolve());
    render(<ConfirmDialog action={action} triggerLabel="Delete" title="Delete this entry?" message="Gone for good." confirmLabel="Delete entry" fields={{ entryId: 'e1' }} />);
    const trigger = screen.getByRole('button', { name: 'Delete' });

    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Delete this entry?' })).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(action).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('BR-36: confirming sends the hidden fields to the action', async () => {
    const action = vi.fn((_formData: FormData) => Promise.resolve());
    render(<ConfirmDialog action={action} triggerLabel="Delete" title="Delete?" message="Sure?" confirmLabel="Yes, delete" fields={{ entryId: 'e1' }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete', hidden: true }));

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
    expect(action.mock.calls[0]?.[0].get('entryId')).toBe('e1');
  });
});

describe('AreaReorder', () => {
  it('BR-07: reorders with the keyboard and submits the new order', async () => {
    const reorder = returning({ status: 'success', message: null });
    const active = settings.areas.filter((area) => !area.isArchived);
    render(<AreaReorder areas={active} reorder={reorder} />);

    screen.getByRole('button', { name: 'Move Mobile up' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByText('Mobile moved to position 2 of 3.')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Save order' }));

    await waitFor(() => {
      expect(reorder).toHaveBeenCalledTimes(1);
    });
    const formData = reorder.mock.calls[0]?.[1];
    expect(formData instanceof FormData ? formData.getAll('areaIds') : null).toEqual(['a1', 'a3', 'a2']);
  });

  it('disables moving the first item up and the last item down', () => {
    render(<AreaReorder areas={settings.areas.slice(0, 2)} reorder={returning({ status: 'idle' })} />);

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Move Frontend up' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Move Backend down' }).disabled).toBe(true);
  });
});
