import 'server-only';

/** Postgres unique violation (23505), optionally on one named constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === '23505' &&
    (constraint === undefined || ('constraint' in error && error.constraint === constraint))
  );
}

/** Postgres foreign key violation (23503). */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === '23503';
}
