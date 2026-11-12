'use client';

/* Client Component — justified: marks the current section with aria-current from the URL. */

import { AppLink as Link } from './app-link.tsx';
import { usePathname } from 'next/navigation';
import { projectHref, type ProjectSection } from '#src/ui/routes.ts';

/* Simple line icons (24px grid), drawn with the link's own colour. */
const sections: readonly { readonly section: ProjectSection; readonly label: string; readonly icon: string }[] = [
  { section: '', label: 'Dashboard', icon: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z' },
  { section: 'plans', label: 'Plans', icon: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5' },
  { section: 'log', label: 'Log', icon: 'M4 6h16M4 12h16M4 18h10' },
  { section: 'issues', label: 'Issues', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5v5.5M12 16.5v.01' },
  { section: 'releases', label: 'Releases', icon: 'M4 4h7.5L20 12.5 12.5 20 4 11.5zM8.5 8.5v.01' },
  { section: 'notes', label: 'Notes', icon: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6' },
  { section: 'reports', label: 'Reports', icon: 'M5 20V11M12 20V4M19 20v-6' },
  { section: 'settings', label: 'Settings', icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5' },
];

/* Tabs with an underline on narrow screens; a list in the dark sidebar on wide ones. */
const link = [
  'group flex items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm font-semibold whitespace-nowrap text-muted no-underline',
  'hover:text-fg aria-[current=page]:border-ink aria-[current=page]:text-fg',
  'lg:gap-3 lg:rounded-sm lg:border-b-0 lg:text-side-muted lg:hover:bg-side-hover lg:hover:text-side-fg',
  'lg:aria-[current=page]:bg-side-active lg:aria-[current=page]:text-side-fg',
].join(' ');

export function ProjectNav({ projectId }: { readonly projectId: string }): React.JSX.Element {
  const pathname = usePathname();
  const base = projectHref(projectId);
  const current = (section: ProjectSection): boolean =>
    section === '' ? pathname === base : pathname === `${base}/${section}` || pathname.startsWith(`${base}/${section}/`);
  return (
    <nav
      aria-label="Project"
      className="sticky top-0 z-5 -mx-4 mb-6 overflow-x-auto border-b border-line bg-page px-4 sm:-mx-8 sm:px-8 lg:static lg:m-0 lg:overflow-visible lg:border-b-0 lg:bg-transparent lg:p-0"
    >
      <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
        {sections.map(({ section, label, icon }) => (
          <li key={label}>
            <Link className={link} href={projectHref(projectId, section)} aria-current={current(section) ? 'page' : undefined}>
              <svg className="flex-none group-aria-[current=page]:text-accent lg:group-aria-[current=page]:text-side-fg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                <path d={icon} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
