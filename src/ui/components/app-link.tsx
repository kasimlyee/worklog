'use client';

/*
 * Client Component — justified: fetches the next page as soon as the pointer, a finger or
 * the keyboard focus lands on a link, so the click that follows shows it at once (D-15).
 * Pages here are rendered per request, which Next.js does not prefetch on its own.
 * Without JavaScript this is a plain link.
 */

import Link from 'next/link';
import { useState } from 'react';

type LinkProps = React.ComponentProps<typeof Link>;

export function AppLink({ onPointerEnter, onFocus, onTouchStart, ...props }: Omit<LinkProps, 'prefetch'>): React.JSX.Element {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      // Nothing is fetched for links nobody goes near; one request for the one about to be used.
      prefetch={intent}
      onPointerEnter={(event) => {
        setIntent(true);
        onPointerEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
