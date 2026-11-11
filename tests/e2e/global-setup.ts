import { prepareDatabase } from './support/database.ts';

export default async function globalSetup(): Promise<void> {
  await prepareDatabase();
}
