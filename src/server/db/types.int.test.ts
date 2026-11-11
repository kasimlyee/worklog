import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { testDb } from '#tests/setup/test-db.ts';
import { schemaContract } from './types.ts';

type ColumnRow = { tableName: string; columnName: string; dataType: string; isNullable: 'YES' | 'NO' };

const toCamel = (name: string): string => name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

describe('schema contract', () => {
  it('db/types.ts matches information_schema exactly', async () => {
    const { rows } = await sql<ColumnRow>`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name NOT LIKE 'kysely_%'
    `.execute(testDb());

    const actual: Record<string, Record<string, { type: string; nullable: boolean }>> = {};
    for (const row of rows) {
      const table = (actual[toCamel(row.tableName)] ??= {});
      table[toCamel(row.columnName)] = { type: row.dataType, nullable: row.isNullable === 'YES' };
    }

    expect(actual).toEqual(schemaContract);
  });
});
