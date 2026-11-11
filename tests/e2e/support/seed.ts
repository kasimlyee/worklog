import { aPerson, aProject, anArea } from '#tests/fixtures/builders.ts';
import { e2eDb } from './database.ts';

/** A project with two areas and two people, as journeys 3–9 need. */
export async function seedProject(): Promise<{
  readonly projectId: string;
  readonly areas: { readonly frontend: string; readonly backend: string };
  readonly people: { readonly ali: string; readonly grace: string };
}> {
  const db = e2eDb();
  const project = await aProject(db, { name: 'Atlas', slug: 'atlas' });
  const frontend = await anArea(db, project.id, { name: 'Frontend', position: 0 });
  const backend = await anArea(db, project.id, { name: 'Backend', position: 1 });
  const ali = await aPerson(db, { name: 'Ali' });
  const grace = await aPerson(db, { name: 'Grace' });
  return { projectId: project.id, areas: { frontend: frontend.id, backend: backend.id }, people: { ali: ali.id, grace: grace.id } };
}
