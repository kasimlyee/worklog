/** A kebab-case slug for file names, at most 60 characters (docs/02 §5.3). */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 50)
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'project' : slug;
}

/** `base`, or `base-2`, `base-3`, … — the first not in `taken`. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  let candidate = base;
  for (let n = 2; taken.has(candidate); n += 1) {
    candidate = `${base}-${String(n)}`;
  }
  return candidate;
}
