'use client';

/* Client Component — justified: marks the current section with aria-current from the URL. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { projectHref, type ProjectSection } from '#src/ui/routes.ts';
import styles from './project-nav.module.css';

const sections: readonly { readonly section: ProjectSection; readonly label: string }[] = [
  { section: '', label: 'Dashboard' },
  { section: 'plans', label: 'Plans' },
  { section: 'log', label: 'Log' },
  { section: 'issues', label: 'Issues' },
  { section: 'releases', label: 'Releases' },
  { section: 'notes', label: 'Notes' },
  { section: 'reports', label: 'Reports' },
  { section: 'settings', label: 'Settings' },
];

export function ProjectNav({ projectId }: { readonly projectId: string }): React.JSX.Element {
  const pathname = usePathname();
  const base = projectHref(projectId);
  const current = (section: ProjectSection): boolean =>
    section === '' ? pathname === base : pathname === `${base}/${section}` || pathname.startsWith(`${base}/${section}/`);
  return (
    <nav aria-label="Project" className={styles.nav}>
      <ul>
        {sections.map(({ section, label }) => (
          <li key={label}>
            <Link href={projectHref(projectId, section)} aria-current={current(section) ? 'page' : undefined}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
