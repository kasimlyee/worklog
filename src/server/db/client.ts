import 'server-only';
import { CamelCasePlugin, Kysely, PostgresDialect, type KyselyConfig } from 'kysely';
import pg from 'pg';
import type { Database } from './types.ts';

export type Db = Kysely<Database>;

// docs/02 §5.1: a `date` must stay the exact `YYYY-MM-DD` string. The pg default builds
// a JavaScript Date at local midnight, which shifts the day in some server time zones.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);
// bigint ids (GitHub user id) stay strings: no silent precision loss.
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => value);

type CreateDbOptions = {
  readonly connectionString: string;
  /** Per function instance. Requests run several queries at once (dashboard, reports). */
  readonly maxConnections?: number;
  readonly log?: KyselyConfig['log'];
};

export function createDb({ connectionString, maxConnections = 8, log }: CreateDbOptions): Db {
  const pool = new pg.Pool({
    connectionString,
    max: maxConnections,
    // Keep connections between clicks: a new TLS connection to Neon costs several round trips.
    idleTimeoutMillis: 300_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  });
  // A connection can die while a serverless instance is frozen. The pool then drops it and
  // opens a new one; without this listener the error would crash the process.
  pool.on('error', () => undefined);
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    plugins: [new CamelCasePlugin()],
    ...(log === undefined ? {} : { log }),
  });
}
