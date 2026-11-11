import 'server-only';
import { env } from '#src/server/env.ts';
import { createDb, type Db } from './client.ts';

let instance: Db | undefined;

/** The application's database, created once per function instance (docs/02 §5.1). */
export function appDb(): Db {
  instance ??= createDb({ connectionString: env().DATABASE_URL });
  return instance;
}
