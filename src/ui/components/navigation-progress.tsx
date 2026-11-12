'use client';

/*
 * Client Component — justified: a click on a link shows progress at once, while the server
 * renders the next page. Without JavaScript the browser's own indicator does this job.
 */

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

function isInAppNavigation(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const link = event.target instanceof Element ? event.target.closest('a') : null;
  if (link?.target !== '' || link.hasAttribute('download') || link.origin !== window.location.origin) {
    return false;
  }
  // Same page (e.g. a #fragment) is not a navigation.
  return link.pathname + link.search !== window.location.pathname + window.location.search;
}

export function NavigationProgress(): React.JSX.Element | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const here = `${pathname}?${searchParams.toString()}`;
  // The page a navigation started from; once the location changes, it is no longer `here`.
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (isInAppNavigation(event)) {
        setLeaving(`${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`);
      }
    };
    // Capture phase: Next.js links cancel the native navigation in their own handler.
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return leaving === here ? <div className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left animate-page-load bg-accent motion-reduce:scale-x-60 motion-reduce:animate-none" role="progressbar" aria-label="Loading page" /> : null;
}
