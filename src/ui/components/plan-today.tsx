'use client';

/*
 * Client Component — justified: drag-and-drop of issues onto Today's plan (BR-38).
 * Dragging is a shortcut only: every row also has a "Plan today" button, which works
 * from the keyboard, on touch screens and without JavaScript.
 */

import { useState, useTransition } from 'react';
import type { PlainAction } from '#src/ui/view-models/forms.ts';

export const issueDragType = 'application/x-worklog-issue';

export function DraggableIssueRow({
  issueId,
  title,
  children,
}: {
  readonly issueId: string;
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <tr
      draggable
      className="cursor-grab active:cursor-grabbing"
      title="Drag onto Today’s plan"
      onDragStart={(event) => {
        event.dataTransfer.setData(issueDragType, issueId);
        event.dataTransfer.setData('text/plain', title);
        event.dataTransfer.effectAllowed = 'copy';
      }}
    >
      {children}
    </tr>
  );
}

export function TodayDropZone({ action, children }: { readonly action: PlainAction; readonly children: React.ReactNode }): React.JSX.Element {
  const [isOver, setIsOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [announcement, setAnnouncement] = useState('');
  const carriesIssue = (event: React.DragEvent): boolean => event.dataTransfer.types.includes(issueDragType);

  const accept = (event: React.DragEvent<HTMLDivElement>): void => {
    if (carriesIssue(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setIsOver(true);
    }
  };

  return (
    <div
      className="-m-1 rounded-md border-2 border-dashed border-transparent p-1 transition-colors data-[over=true]:border-accent data-[over=true]:bg-accent-soft data-[pending=true]:opacity-70"
      data-over={isOver ? 'true' : undefined}
      data-pending={isPending ? 'true' : undefined}
      onDragEnter={accept}
      onDragOver={accept}
      onDragLeave={(event) => {
        // Leaving for a child of the zone is not leaving the zone.
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
          setIsOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const issueId = event.dataTransfer.getData(issueDragType);
        const title = event.dataTransfer.getData('text/plain');
        if (issueId === '') {
          return;
        }
        const formData = new FormData();
        formData.set('issueId', issueId);
        setAnnouncement(`Adding ${title} to today’s plan…`);
        startTransition(async () => {
          await action(formData);
          setAnnouncement(`Added ${title} to today’s plan.`);
        });
      }}
    >
      <p className="mb-3 text-xs text-muted">Drag an open issue here to work on it today, or use “Plan today” next to it.</p>
      {children}
      <p className="mt-2 min-h-5 text-sm text-muted empty:mt-0 empty:min-h-0" role="status">
        {announcement}
      </p>
    </div>
  );
}
