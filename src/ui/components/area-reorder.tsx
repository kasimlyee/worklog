'use client';

/*
 * Client Component — justified: reordering areas (BR-07) with Up/Down buttons, so it works
 * from the keyboard without a mouse. The order is saved with one form submission.
 */

import { useState } from 'react';
import type { AreaVM } from '#src/ui/view-models/settings.ts';
import type { FormAction } from '#src/ui/view-models/forms.ts';
import { ActionForm } from './form.tsx';

export function AreaReorder({ areas, reorder }: { readonly areas: readonly AreaVM[]; readonly reorder: FormAction }): React.JSX.Element {
  const [order, setOrder] = useState(areas);
  const [announcement, setAnnouncement] = useState('');
  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    const moving = order[index];
    const other = order[target];
    if (moving === undefined || other === undefined) {
      return;
    }
    const next = [...order];
    next[index] = other;
    next[target] = moving;
    setOrder(next);
    setAnnouncement(`${moving.name} moved to position ${String(target + 1)} of ${String(next.length)}.`);
  };
  return (
    <ActionForm action={reorder} submitLabel="Save order" label="Area order">
      <ol className="col-span-full grid list-none gap-2" data-wide="true">
        {order.map((area, index) => (
          <li key={area.id} className="flex items-center gap-2 rounded-md border border-line bg-sunken py-2 pr-2 pl-4">
            <input type="hidden" name="areaIds" value={area.id} />
            <span className="flex-1 font-semibold">{area.name}</span>
            <button type="button" data-size="small" onClick={() => { move(index, -1); }} disabled={index === 0} aria-label={`Move ${area.name} up`}>
              ↑
            </button>
            <button
              type="button"
              data-size="small"
              onClick={() => { move(index, 1); }}
              disabled={index === order.length - 1}
              aria-label={`Move ${area.name} down`}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </ActionForm>
  );
}
